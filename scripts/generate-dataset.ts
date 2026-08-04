/**
 * Dataset generator. docs/02-dataset-spec.md §5
 *
 * Writes `src/data/courses.json` and `src/data/instructors.json`, then never
 * runs again in production: the app imports the committed JSON at build time.
 * No runtime data generation (CLAUDE.md).
 *
 * Determinism is a hard requirement: running this twice must produce
 * byte-identical files. There is no `Date.now()` anywhere — every date is
 * derived from `DATASET_AS_OF`, and every "random" number comes from a
 * seeded xorshift32 PRNG, so the same seed always produces the same bytes.
 *
 * Shape of the work (docs/04-build-brief.md Phase 2):
 *   1. The ~18 planted courses from docs/02-dataset-spec.md §4, as literals,
 *      exactly as specified — these numbers are load-bearing.
 *   2. The remaining ~46 courses from the seeded PRNG, following the
 *      correlations in §4.
 *   3. Every invariant in §5, both blocks, asserted before anything is
 *      written. On any failure, throw and write nothing.
 *   4. The demo-integrity assertions that depend on the ranking engine
 *      (§5, "position-dependent") are stubbed here — the engine does not
 *      exist until Phase 3. `assertPositionDependentInvariants` documents
 *      what they must check and is wired up and called at the end of
 *      Phase 3, when the generator is re-run.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CATEGORIES, type CategoryId, type SubcategoryId } from '@/data/categories';
import {
  DATASET_AS_OF,
  DEFAULT_FILTERS,
  DEFAULT_TOGGLES,
  LANGUAGES,
  LEVELS,
  MIN_RATING_COUNT,
  PROMO_MAX_CONTENT_AGE_MONTHS,
  SHRINKAGE_M,
  SMALL_BASIS_THRESHOLD,
  WEIGHT_PRESETS,
} from '@/lib/ranking/constants';
import { rank } from '@/lib/ranking/pipeline';
import type { Course, Instructor, Language, Level, RatingDistribution } from '@/lib/ranking/types';

// ---------------------------------------------------------------------------
// Seeded PRNG — xorshift32. No dependency, fully deterministic.
// ---------------------------------------------------------------------------

const SEED = 0x5eed_2026;

function createRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return function next(): number {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4_294_967_296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const item = arr[randInt(rng, 0, arr.length - 1)];
  if (item === undefined) {
    throw new Error('pick: called on an empty array');
  }
  return item;
}

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isoDaysBefore(asOfIso: string, days: number): string {
  const date = new Date(`${asOfIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  const iso = date.toISOString().slice(0, 10);
  return iso;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return (to - from) / 86_400_000;
}

function monthsSince(fromIso: string, asOfIso: string): number {
  return daysBetween(fromIso, asOfIso) / 30.4368;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Builds a J-shaped 1★→5★ distribution summing to `count` whose weighted
 * mean is within 0.05 of `avg` (docs/02-dataset-spec.md §3 field notes).
 *
 * Deterministic by construction — not PRNG-driven — because it is solving an
 * equation (find the exponential tilt `k` that produces the target mean),
 * not sampling. Real course ratings are J-shaped, not bell-shaped: modelling
 * star probability as proportional to `exp(k * star)` produces exactly that
 * shape for any `k > 0`, and the tilt is what lets one formula cover both a
 * 5.00-average course (extreme positive `k`) and a 3.90-average one.
 */
function buildRatingDistribution(avg: number, count: number): RatingDistribution {
  const stars = [1, 2, 3, 4, 5];

  function meanForK(k: number): number {
    const weights = stars.map((s) => Math.exp(k * s));
    const sumW = weights.reduce((a, b) => a + b, 0);
    const weightedSum = weights.reduce((acc, w, i) => acc + w * stars[i]!, 0);
    return weightedSum / sumW;
  }

  let lo = -8;
  let hi = 8;
  for (let iter = 0; iter < 80; iter += 1) {
    const mid = (lo + hi) / 2;
    if (meanForK(mid) < avg) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const k = (lo + hi) / 2;
  const weights = stars.map((s) => Math.exp(k * s));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sumW) * count);
  const floors = raw.map((r) => Math.floor(r));
  const used = floors.reduce((a, b) => a + b, 0);
  const remainder = count - used;

  const byFraction = raw
    .map((r, i) => ({ i, frac: r - floors[i]! }))
    .sort((a, b) => b.frac - a.frac);

  for (let j = 0; j < remainder; j += 1) {
    const target = byFraction[j % byFraction.length]!.i;
    floors[target] = floors[target]! + 1;
  }

  // The exponential-tilt solve gets close, but integer rounding can still
  // leave the mean outside the 0.05 tolerance (docs/02 §3 field notes),
  // especially at low counts. Hill-climb: move one rating at a time from
  // one star bucket to another when that strictly reduces the error.
  function meanOf(dist: number[]): number {
    return dist.reduce((acc, n, i) => acc + n * stars[i]!, 0) / count;
  }

  for (let iter = 0; iter < 500; iter += 1) {
    const currentMean = meanOf(floors);
    if (Math.abs(currentMean - avg) <= 0.01) break;

    let bestMove: { from: number; to: number; error: number } | null = null;
    for (let from = 0; from < 5; from += 1) {
      if (floors[from]! <= 0) continue;
      for (let to = 0; to < 5; to += 1) {
        if (to === from) continue;
        const delta = (stars[to]! - stars[from]!) / count;
        const candidateMean = currentMean + delta;
        const error = Math.abs(candidateMean - avg);
        if (bestMove === null || error < bestMove.error) {
          bestMove = { from, to, error };
        }
      }
    }
    if (bestMove === null || bestMove.error >= Math.abs(currentMean - avg)) break;
    floors[bestMove.from] = floors[bestMove.from]! - 1;
    floors[bestMove.to] = floors[bestMove.to]! + 1;
  }

  return [floors[0]!, floors[1]!, floors[2]!, floors[3]!, floors[4]!];
}

function computeAdjustedRating(raw: number, count: number, categoryMean: number): number {
  return (count * raw + SHRINKAGE_M * categoryMean) / (count + SHRINKAGE_M);
}

// ---------------------------------------------------------------------------
// Instructors — docs/02-dataset-spec.md §3
// ---------------------------------------------------------------------------

interface InstructorSeed {
  readonly id: string;
  readonly name: string;
  readonly headline: string;
  readonly historicalRatingAvg: number;
}

/**
 * 22 instructors. `i-01` (Marcus Webb) carries all 5 of case 8's diversity-cap
 * courses and appears nowhere else. `i-07` (Dr. Elena Marsh) is the schema
 * example instructor from docs/02 §3, reused verbatim for case 5's course.
 * Every other instructor may also pick up generated courses.
 */
const INSTRUCTOR_SEEDS: readonly InstructorSeed[] = [
  {
    id: 'i-01',
    name: 'Marcus Webb',
    headline: 'Full-stack instructor and course-production veteran',
    historicalRatingAvg: 4.42,
  },
  {
    id: 'i-02',
    name: 'Dr. Priya Nandakumar',
    headline: 'Applied ML lead, former recommender-systems engineer',
    historicalRatingAvg: 4.68,
  },
  {
    id: 'i-03',
    name: 'Tomasz Zieliński',
    headline: 'Data engineer turned educator',
    historicalRatingAvg: 4.35,
  },
  {
    id: 'i-04',
    name: 'Sofia Vargas',
    headline: 'Cybersecurity consultant, ex-red team',
    historicalRatingAvg: 4.51,
  },
  {
    id: 'i-05',
    name: 'Jonas Weber',
    headline: 'iOS and backend engineer, 12 years in industry',
    historicalRatingAvg: 4.4,
  },
  {
    id: 'i-06',
    name: 'Dr. Hannah Kim',
    headline: 'Cognitive scientist studying human-in-the-loop ML',
    historicalRatingAvg: 4.72,
  },
  {
    id: 'i-07',
    name: 'Dr. Elena Marsh',
    headline: 'ML engineer, ex-search infrastructure',
    historicalRatingAvg: 4.61,
  },
  {
    id: 'i-08',
    name: 'Idris Bello',
    headline: 'Growth marketer and paid-acquisition specialist',
    historicalRatingAvg: 4.1,
  },
  {
    id: 'i-09',
    name: 'Claire Dubois',
    headline: 'UX researcher and design systems lead',
    historicalRatingAvg: 4.66,
  },
  {
    id: 'i-10',
    name: 'Ravi Chandran',
    headline: 'Cloud infrastructure architect, AWS and Kubernetes',
    historicalRatingAvg: 4.58,
  },
  {
    id: 'i-11',
    name: 'Dr. Mei Lin',
    headline: 'Statistician, applied Bayesian methods',
    historicalRatingAvg: 4.7,
  },
  {
    id: 'i-12',
    name: 'Oskar Lindqvist',
    headline: 'Frontend engineer, design-engineering hybrid',
    historicalRatingAvg: 4.44,
  },
  {
    id: 'i-13',
    name: 'Naledi Mokoena',
    headline: 'Business analyst turned course creator',
    historicalRatingAvg: 4.3,
  },
  {
    id: 'i-14',
    name: 'Diego Fernández',
    headline: 'Penetration tester and security trainer',
    historicalRatingAvg: 4.53,
  },
  {
    id: 'i-15',
    name: 'Dr. Wen Zhao',
    headline: 'Deep learning researcher, ex-academia',
    historicalRatingAvg: 4.75,
  },
  {
    id: 'i-16',
    name: 'Grace Okafor',
    headline: 'Product designer, ex-FAANG',
    historicalRatingAvg: 4.62,
  },
  {
    id: 'i-17',
    name: 'Bartłomiej Nowak',
    headline: 'DevOps and platform engineering instructor',
    historicalRatingAvg: 4.38,
  },
  {
    id: 'i-18',
    name: 'Fatima Al-Sayed',
    headline: 'Data analyst and BI consultant',
    historicalRatingAvg: 4.47,
  },
  {
    id: 'i-19',
    name: 'Lucas Meyer',
    headline: 'Marketing strategist, ex-agency founder',
    historicalRatingAvg: 4.15,
  },
  {
    id: 'i-20',
    name: 'Dr. Ana Torres',
    headline: 'Applied NLP researcher',
    historicalRatingAvg: 4.64,
  },
  {
    id: 'i-21',
    name: 'Jack Sullivan',
    headline: 'Career changer turned prolific course creator',
    historicalRatingAvg: 4.25,
  },
  {
    id: 'i-22',
    name: 'Ingrid Larsen',
    headline: 'UX writer and content strategist',
    historicalRatingAvg: 4.55,
  },
];

const RANDOM_INSTRUCTOR_POOL: readonly string[] = INSTRUCTOR_SEEDS.filter(
  (seed) => seed.id !== 'i-01',
).map((seed) => seed.id);

// ---------------------------------------------------------------------------
// Planted courses — docs/02-dataset-spec.md §4
// ---------------------------------------------------------------------------

type DraftCourse = Omit<Course, 'id'>;

const HERO: CategoryId = 'ai-ml';
const HERO_TARGET_MEAN = 4.31;

/**
 * The 15 hero-category planted courses whose raw ratings are fixed by the
 * spec or chosen freely. Course "Webb-3" (case 8's third course) is *not*
 * here — its rating is solved below so the 16-course hero mean lands on
 * exactly 4.31, which is what makes case 6's R_adj land on exactly 3.97
 * (docs/01 §3.1 worked example; docs/02 §5).
 */
const heroExceptFiller: DraftCourse[] = [
  // Case 1 — Bayesian shrinkage. R_adj should land at 4.38 (docs/01 §10, Course A).
  {
    slug: 'machine-learning-fundamentals-reloaded',
    title: 'Machine Learning Fundamentals Reloaded',
    subtitle: 'A from-scratch rebuild of the original bestseller',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['machine-learning', 'fundamentals', 'statistics'],
    instructorId: 'i-11',
    level: 'intermediate',
    language: 'en',
    durationHours: 9,
    lessonsCount: 40,
    hasCertificate: true,
    price: 49,
    originalPrice: 89,
    publishedAt: '2023-05-10',
    lastContentUpdateAt: '2026-07-01',
    ratingAvg: 5.0,
    ratingCount: 6,
    ratingDistribution: buildRatingDistribution(5.0, 6),
    enrollments: 210,
    enrollments30d: 15,
    completionRate: 0.41,
    medianWatchPercent: 0.55,
    refundRate: 0.03,
    promo: null,
    policyFlags: [],
  },
  // Case 2 — Outcome layer. Top popularity percentile, still not first (docs/01 §10, Course B).
  {
    slug: 'the-complete-ai-and-machine-learning-bootcamp',
    title: 'The Complete AI & Machine Learning Bootcamp',
    subtitle: 'Zero to job-ready, the original flagship course',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['machine-learning', 'bootcamp', 'career'],
    instructorId: 'i-02',
    level: 'beginner',
    language: 'en',
    durationHours: 42,
    lessonsCount: 180,
    hasCertificate: true,
    price: 89,
    originalPrice: 199,
    publishedAt: '2021-02-15',
    lastContentUpdateAt: '2024-06-01',
    ratingAvg: 4.6,
    ratingCount: 5400,
    ratingDistribution: buildRatingDistribution(4.6, 5400),
    enrollments: 96_000,
    enrollments30d: 1200,
    completionRate: 0.22,
    medianWatchPercent: 0.31,
    refundRate: 0.11,
    promo: null,
    policyFlags: [],
  },
  // Case 3 — Freshness decay. Well-reviewed, visibly demoted for being stale.
  {
    slug: 'deep-learning-with-tensorflow-2',
    title: 'Deep Learning with TensorFlow 2',
    subtitle: 'Neural networks from first principles to production',
    categoryId: HERO,
    subcategoryId: 'deep-learning',
    tags: ['deep-learning', 'tensorflow', 'neural-networks'],
    instructorId: 'i-15',
    level: 'intermediate',
    language: 'en',
    durationHours: 22,
    lessonsCount: 95,
    hasCertificate: true,
    price: 69,
    originalPrice: 129,
    publishedAt: '2021-09-01',
    lastContentUpdateAt: '2023-10-01',
    ratingAvg: 4.81,
    ratingCount: 3100,
    ratingDistribution: buildRatingDistribution(4.81, 3100),
    enrollments: 20_000,
    enrollments30d: 400,
    completionRate: 0.62,
    medianWatchPercent: 0.74,
    refundRate: 0.02,
    promo: null,
    policyFlags: [],
  },
  // Case 4 — Cold start. Good but unproven; mid-table.
  {
    slug: 'prompt-engineering-for-product-teams',
    title: 'Prompt Engineering for Product Teams',
    subtitle: 'Shipping reliable LLM features, not just clever prompts',
    categoryId: HERO,
    subcategoryId: 'prompt-engineering',
    tags: ['prompt-engineering', 'product', 'llm'],
    instructorId: 'i-20',
    level: 'intermediate',
    language: 'en',
    durationHours: 6,
    lessonsCount: 24,
    hasCertificate: false,
    price: 39,
    originalPrice: null,
    publishedAt: '2026-06-20',
    lastContentUpdateAt: '2026-06-20',
    ratingAvg: 4.9,
    ratingCount: 11,
    ratingDistribution: buildRatingDistribution(4.9, 11),
    enrollments: 780,
    enrollments30d: 210,
    completionRate: 0.35,
    medianWatchPercent: 0.55,
    refundRate: 0.01,
    promo: null,
    policyFlags: [],
  },
  // Case 5 — Promo, gate passed. Verbatim schema example, docs/02 §3 and §4.
  {
    slug: 'applied-ml-for-analysts',
    title: 'Applied ML for Analysts',
    subtitle: 'From spreadsheets to a deployed model in 8 weeks',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['python', 'scikit-learn', 'feature-engineering'],
    instructorId: 'i-07',
    level: 'intermediate',
    language: 'en',
    durationHours: 14.5,
    lessonsCount: 62,
    hasCertificate: true,
    price: 79,
    originalPrice: 129,
    publishedAt: '2024-03-11',
    lastContentUpdateAt: '2026-03-01',
    ratingAvg: 4.75,
    ratingCount: 310,
    ratingDistribution: [2, 3, 8, 45, 252],
    enrollments: 14_300,
    enrollments30d: 940,
    completionRate: 0.58,
    medianWatchPercent: 0.71,
    refundRate: 0.02,
    promo: { type: 'sponsored', priority: 0.8, predictedCtr: 0.061 },
    policyFlags: [],
  },
  // Case 6 — The quality gate. Paid promotion refused a slot. R_adj must round to 3.97.
  {
    slug: 'ai-growth-hacking-masterclass-2026',
    title: 'AI Growth Hacking Masterclass 2026',
    subtitle: 'Ride the AI wave to explosive user growth',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['marketing', 'ai-tools', 'growth'],
    instructorId: 'i-08',
    level: 'beginner',
    language: 'en',
    durationHours: 11,
    lessonsCount: 48,
    hasCertificate: true,
    price: 59,
    originalPrice: 149,
    publishedAt: '2025-01-10',
    lastContentUpdateAt: '2025-11-01',
    ratingAvg: 3.9,
    ratingCount: 243,
    ratingDistribution: buildRatingDistribution(3.9, 243),
    enrollments: 22_000,
    enrollments30d: 900,
    completionRate: 0.3,
    medianWatchPercent: 0.4,
    refundRate: 0.08,
    // priority/predictedCtr are not load-bearing (unlike R_adj and ratingCount
    // above). Set high — a flashy growth-hacking sales page plausibly predicts
    // a strong click-through — so that disabling the promo quality gate (PRD
    // §7, criterion 7) actually surfaces this course at slot 1 instead of
    // losing the slot-1 contest to case 5, which remains eligible regardless.
    promo: { type: 'sponsored', priority: 1, predictedCtr: 0.15 },
    policyFlags: [],
  },
  // Case 7 — Featured vs sponsored. Editorial, passes the gate, takes slot 6.
  {
    slug: 'ai-product-management-essentials',
    title: 'AI Product Management Essentials',
    subtitle: "Editor's pick: shipping AI features as a PM",
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['product-management', 'ai', 'strategy'],
    instructorId: 'i-13',
    level: 'intermediate',
    language: 'en',
    durationHours: 8,
    lessonsCount: 32,
    hasCertificate: true,
    price: 49,
    originalPrice: null,
    publishedAt: '2024-09-01',
    lastContentUpdateAt: '2026-06-01',
    ratingAvg: 4.42,
    ratingCount: 150,
    ratingDistribution: buildRatingDistribution(4.42, 150),
    enrollments: 17_000,
    enrollments30d: 500,
    completionRate: 0.85,
    medianWatchPercent: 0.9,
    refundRate: 0.01,
    promo: { type: 'featured', priority: 0.6, predictedCtr: 0.05 },
    policyFlags: [],
  },
  // Case 9 — Free-only filter, price sorting with zeros first.
  {
    slug: 'intro-to-python-for-ml',
    title: 'Intro to Python for ML',
    subtitle: 'The free on-ramp into the AI & Machine Learning track',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['python', 'beginner', 'free'],
    instructorId: 'i-21',
    level: 'beginner',
    language: 'en',
    durationHours: 5,
    lessonsCount: 22,
    hasCertificate: true,
    price: 0,
    originalPrice: null,
    publishedAt: '2022-03-01',
    lastContentUpdateAt: '2025-05-01',
    ratingAvg: 4.55,
    ratingCount: 2800,
    ratingDistribution: buildRatingDistribution(4.55, 2800),
    enrollments: 41_000,
    enrollments30d: 900,
    completionRate: 0.35,
    medianWatchPercent: 0.42,
    refundRate: 0.05,
    promo: null,
    policyFlags: [],
  },
  // Case 10 — The Outcome caveat. Low completion that is normal for the level.
  {
    slug: 'advanced-mlops-on-kubernetes',
    title: 'Advanced MLOps on Kubernetes',
    subtitle: 'Productionising models at scale',
    categoryId: HERO,
    subcategoryId: 'mlops',
    tags: ['mlops', 'kubernetes', 'deployment'],
    instructorId: 'i-10',
    level: 'advanced',
    language: 'en',
    durationHours: 31,
    lessonsCount: 78,
    hasCertificate: true,
    price: 99,
    originalPrice: 179,
    publishedAt: '2024-05-01',
    lastContentUpdateAt: '2026-06-01',
    ratingAvg: 4.72,
    ratingCount: 220,
    ratingDistribution: buildRatingDistribution(4.72, 220),
    enrollments: 18_000,
    enrollments30d: 400,
    completionRate: 0.34,
    medianWatchPercent: 0.68,
    refundRate: 0.01,
    promo: null,
    policyFlags: [],
  },
  // Case 11 — Language filter, visible effect in the default view.
  {
    slug: 'maschinelles-lernen-mit-python',
    title: 'Maschinelles Lernen mit Python',
    subtitle: 'Ein praxisorientierter Einstieg in maschinelles Lernen',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['python', 'machine-learning', 'deutsch'],
    instructorId: 'i-06',
    level: 'intermediate',
    language: 'de',
    durationHours: 15,
    lessonsCount: 60,
    hasCertificate: true,
    price: 59,
    originalPrice: 99,
    publishedAt: '2023-02-01',
    lastContentUpdateAt: '2026-05-01',
    ratingAvg: 4.35,
    ratingCount: 85,
    ratingDistribution: buildRatingDistribution(4.35, 85),
    enrollments: 19_500,
    enrollments30d: 500,
    completionRate: 0.87,
    medianWatchPercent: 0.97,
    refundRate: 0.005,
    promo: null,
    policyFlags: [],
  },
  // Case 12 — Third sub-20-rating course, so the gate note reports a count above 2.
  {
    slug: 'reinforcement-learning-crash-course',
    title: 'Reinforcement Learning Crash Course',
    subtitle: 'Policy gradients, Q-learning and where they break',
    categoryId: HERO,
    subcategoryId: 'deep-learning',
    tags: ['reinforcement-learning', 'ai', 'crash-course'],
    instructorId: 'i-06',
    level: 'intermediate',
    language: 'en',
    durationHours: 10,
    lessonsCount: 38,
    hasCertificate: false,
    price: 49,
    originalPrice: null,
    publishedAt: '2026-02-01',
    lastContentUpdateAt: '2026-05-01',
    ratingAvg: 4.6,
    ratingCount: 14,
    ratingDistribution: buildRatingDistribution(4.6, 14),
    enrollments: 15_000,
    enrollments30d: 500,
    completionRate: 0.85,
    medianWatchPercent: 0.9,
    refundRate: 0.01,
    promo: null,
    policyFlags: [],
  },
  // Case 8 (1/5) — Marcus Webb, diversity cap. Strong: good outcome/popularity/freshness.
  {
    slug: 'kubernetes-for-machine-learning-pipelines',
    title: 'Kubernetes for Machine Learning Pipelines',
    subtitle: 'Orchestrating training and inference at scale',
    categoryId: HERO,
    subcategoryId: 'mlops',
    tags: ['mlops', 'kubernetes', 'pipelines'],
    instructorId: 'i-01',
    level: 'intermediate',
    language: 'en',
    durationHours: 18,
    lessonsCount: 70,
    hasCertificate: true,
    price: 79,
    originalPrice: 139,
    publishedAt: '2024-02-01',
    lastContentUpdateAt: '2026-06-01',
    ratingAvg: 4.2,
    ratingCount: 380,
    ratingDistribution: buildRatingDistribution(4.2, 380),
    enrollments: 19_000,
    enrollments30d: 400,
    completionRate: 0.75,
    medianWatchPercent: 0.85,
    refundRate: 0.01,
    promo: null,
    policyFlags: [],
  },
  // Case 8 (2/5) — Marcus Webb, strong.
  {
    slug: 'computer-vision-with-pytorch',
    title: 'Computer Vision with PyTorch',
    subtitle: 'From convolutions to deployed vision models',
    categoryId: HERO,
    subcategoryId: 'deep-learning',
    tags: ['computer-vision', 'pytorch', 'deep-learning'],
    instructorId: 'i-01',
    level: 'intermediate',
    language: 'en',
    durationHours: 20,
    lessonsCount: 82,
    hasCertificate: true,
    price: 79,
    originalPrice: 139,
    publishedAt: '2023-12-01',
    lastContentUpdateAt: '2026-07-15',
    ratingAvg: 4.1,
    ratingCount: 340,
    ratingDistribution: buildRatingDistribution(4.1, 340),
    enrollments: 17_000,
    enrollments30d: 400,
    completionRate: 0.88,
    medianWatchPercent: 0.94,
    refundRate: 0.003,
    promo: null,
    policyFlags: [],
  },
  // Case 8 (4/5) — Marcus Webb, weak: stale, low completion, low rating.
  {
    slug: 'excel-to-ai-a-gentle-introduction',
    title: 'Excel to AI: A Gentle Introduction',
    subtitle: 'For spreadsheet users curious about AI',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['excel', 'ai', 'beginner'],
    instructorId: 'i-01',
    level: 'beginner',
    language: 'en',
    durationHours: 7,
    lessonsCount: 28,
    hasCertificate: false,
    price: 29,
    originalPrice: null,
    publishedAt: '2021-01-15',
    lastContentUpdateAt: '2023-05-01',
    ratingAvg: 3.3,
    ratingCount: 500,
    ratingDistribution: buildRatingDistribution(3.3, 500),
    enrollments: 6000,
    enrollments30d: 90,
    completionRate: 0.28,
    medianWatchPercent: 0.32,
    refundRate: 0.09,
    promo: null,
    policyFlags: [],
  },
  // Case 8 (5/5) — Marcus Webb, weak: very stale, lowest rating.
  {
    slug: 'ai-for-absolute-beginners',
    title: 'AI for Absolute Beginners',
    subtitle: 'What AI actually is, with no jargon',
    categoryId: HERO,
    subcategoryId: 'applied-ml',
    tags: ['ai', 'beginner', 'overview'],
    instructorId: 'i-01',
    level: 'beginner',
    language: 'en',
    durationHours: 4,
    lessonsCount: 18,
    hasCertificate: false,
    price: 19,
    originalPrice: null,
    publishedAt: '2020-05-20',
    lastContentUpdateAt: '2022-04-01',
    ratingAvg: 3.1,
    ratingCount: 600,
    ratingDistribution: buildRatingDistribution(3.1, 600),
    enrollments: 7000,
    enrollments30d: 100,
    completionRate: 0.24,
    medianWatchPercent: 0.28,
    refundRate: 0.11,
    promo: null,
    policyFlags: [],
  },
];

const heroSumExceptFiller = heroExceptFiller.reduce((acc, c) => acc + c.ratingAvg, 0);
/**
 * Case 8 (3/5) — Marcus Webb, strong. Its rating is solved, not chosen, so
 * that the 16-course hero mean lands on exactly 4.31 (docs/02 §5): this is
 * what makes case 6's R_adj round to exactly 3.97 (docs/01 §3.1).
 */
const webbFillerRawRating = round2(HERO_TARGET_MEAN * 16 - heroSumExceptFiller);
const webbFillerCourse: DraftCourse = {
  slug: 'time-series-forecasting-with-python',
  title: 'Time Series Forecasting with Python',
  subtitle: 'Classical and deep-learning approaches, side by side',
  categoryId: HERO,
  subcategoryId: 'applied-ml',
  tags: ['time-series', 'forecasting', 'python'],
  instructorId: 'i-01',
  level: 'intermediate',
  language: 'en',
  durationHours: 16,
  lessonsCount: 64,
  hasCertificate: true,
  price: 69,
  originalPrice: 119,
  publishedAt: '2023-09-01',
  lastContentUpdateAt: '2026-06-15',
  ratingAvg: webbFillerRawRating,
  ratingCount: 300,
  ratingDistribution: buildRatingDistribution(webbFillerRawRating, 300),
  enrollments: 19_000,
  enrollments30d: 400,
  completionRate: 0.85,
  medianWatchPercent: 0.9,
  refundRate: 0.005,
  promo: null,
  policyFlags: [],
};

const heroCourses: DraftCourse[] = [...heroExceptFiller, webbFillerCourse];

// Case 15 — promo is a platform-wide mechanism, not a hero-category prop.
const case15: DraftCourse = {
  slug: 'the-full-stack-typescript-path',
  title: 'The Full-Stack TypeScript Path',
  subtitle: 'One language, frontend to backend to deployment',
  categoryId: 'web-dev',
  subcategoryId: 'fullstack-typescript',
  tags: ['typescript', 'fullstack', 'react', 'node'],
  instructorId: 'i-12',
  level: 'intermediate',
  language: 'en',
  durationHours: 36,
  lessonsCount: 140,
  hasCertificate: true,
  price: 89,
  originalPrice: 179,
  publishedAt: '2024-06-01',
  lastContentUpdateAt: '2026-03-01',
  ratingAvg: 4.6,
  ratingCount: 210,
  ratingDistribution: buildRatingDistribution(4.6, 210),
  enrollments: 9000,
  enrollments30d: 300,
  completionRate: 0.55,
  medianWatchPercent: 0.62,
  refundRate: 0.02,
  promo: { type: 'sponsored', priority: 0.65, predictedCtr: 0.055 },
  policyFlags: [],
};

// Case 14 — gate removal. Present in the data, absent from results.
const case14: DraftCourse = {
  slug: 'ethical-hacking-bootcamp',
  title: 'Ethical Hacking Bootcamp',
  subtitle: 'Offensive security fundamentals for defenders',
  categoryId: 'cybersecurity',
  subcategoryId: 'ethical-hacking',
  tags: ['ethical-hacking', 'penetration-testing', 'security'],
  instructorId: 'i-14',
  level: 'intermediate',
  language: 'en',
  durationHours: 14,
  lessonsCount: 55,
  hasCertificate: true,
  price: 59,
  originalPrice: 99,
  publishedAt: '2023-01-01',
  lastContentUpdateAt: '2025-06-01',
  ratingAvg: 4.2,
  ratingCount: 60,
  ratingDistribution: buildRatingDistribution(4.2, 60),
  enrollments: 2000,
  enrollments30d: 60,
  completionRate: 0.45,
  medianWatchPercent: 0.55,
  refundRate: 0.04,
  promo: null,
  policyFlags: ['under-review'],
};

// Case 16a — language filter outside the hero category.
const case16a: DraftCourse = {
  slug: 'data-storytelling',
  title: 'Data Storytelling',
  subtitle: 'Kommunizieren Sie Daten so, dass Entscheidungen folgen',
  categoryId: 'data-analytics',
  subcategoryId: 'data-visualization',
  tags: ['data-storytelling', 'visualization', 'communication'],
  instructorId: 'i-18',
  level: 'beginner',
  language: 'de',
  durationHours: 9,
  lessonsCount: 36,
  hasCertificate: true,
  price: 49,
  originalPrice: 79,
  publishedAt: '2023-07-01',
  lastContentUpdateAt: '2025-12-01',
  ratingAvg: 4.3,
  ratingCount: 150,
  ratingDistribution: buildRatingDistribution(4.3, 150),
  enrollments: 5000,
  enrollments30d: 120,
  completionRate: 0.5,
  medianWatchPercent: 0.58,
  refundRate: 0.03,
  promo: null,
  policyFlags: [],
};

// Case 16b — language filter outside the hero category.
const case16b: DraftCourse = {
  slug: 'ux-research-foundations',
  title: 'UX Research Foundations',
  subtitle: 'Fundamentos de la investigación centrada en el usuario',
  categoryId: 'design-ux',
  subcategoryId: 'ux-research',
  tags: ['ux-research', 'usability', 'interviews'],
  instructorId: 'i-09',
  level: 'beginner',
  language: 'es',
  durationHours: 8,
  lessonsCount: 30,
  hasCertificate: true,
  price: 39,
  originalPrice: null,
  publishedAt: '2023-04-01',
  lastContentUpdateAt: '2025-10-01',
  ratingAvg: 4.45,
  ratingCount: 180,
  ratingDistribution: buildRatingDistribution(4.45, 180),
  enrollments: 6000,
  enrollments30d: 180,
  completionRate: 0.6,
  medianWatchPercent: 0.68,
  refundRate: 0.02,
  promo: null,
  policyFlags: [],
};

// ---------------------------------------------------------------------------
// Generated fillers — the remaining ~44 courses, seeded PRNG
// ---------------------------------------------------------------------------

interface FillerSpec {
  readonly title: string;
  readonly subcategoryId: SubcategoryId;
  readonly tags: readonly string[];
}

const WEB_DEV_FILLERS: readonly FillerSpec[] = [
  {
    title: 'Modern React from First Principles',
    subcategoryId: 'frontend',
    tags: ['react', 'javascript', 'frontend'],
  },
  { title: 'Node.js APIs at Scale', subcategoryId: 'backend', tags: ['nodejs', 'api', 'backend'] },
  {
    title: 'CSS Layout Mastery: Grid and Flexbox',
    subcategoryId: 'frontend',
    tags: ['css', 'layout', 'frontend'],
  },
  {
    title: 'Building Progressive Web Apps',
    subcategoryId: 'frontend',
    tags: ['pwa', 'javascript', 'performance'],
  },
  {
    title: 'GraphQL for Frontend Engineers',
    subcategoryId: 'frontend',
    tags: ['graphql', 'api', 'frontend'],
  },
  {
    title: 'iOS Development with SwiftUI',
    subcategoryId: 'mobile',
    tags: ['ios', 'swift', 'mobile'],
  },
  {
    title: 'Android Development with Kotlin',
    subcategoryId: 'mobile',
    tags: ['android', 'kotlin', 'mobile'],
  },
  {
    title: 'Docker and CI/CD for Web Teams',
    subcategoryId: 'devops-web',
    tags: ['docker', 'ci-cd', 'devops'],
  },
  {
    title: 'Vue 3 Composition API in Practice',
    subcategoryId: 'frontend',
    tags: ['vue', 'javascript', 'frontend'],
  },
  {
    title: 'Web Accessibility for Engineers',
    subcategoryId: 'frontend',
    tags: ['accessibility', 'a11y', 'frontend'],
  },
  {
    title: 'Serverless Web Applications',
    subcategoryId: 'backend',
    tags: ['serverless', 'cloud', 'backend'],
  },
  {
    title: 'TypeScript Design Patterns',
    subcategoryId: 'fullstack-typescript',
    tags: ['typescript', 'patterns', 'fullstack'],
  },
];

const CYBERSECURITY_FILLERS: readonly FillerSpec[] = [
  {
    title: 'Network Security Fundamentals',
    subcategoryId: 'network-security',
    tags: ['networking', 'security', 'fundamentals'],
  },
  {
    title: 'Cloud Security on AWS',
    subcategoryId: 'cloud-security',
    tags: ['aws', 'cloud', 'security'],
  },
  {
    title: 'Web Application Penetration Testing',
    subcategoryId: 'ethical-hacking',
    tags: ['pentesting', 'web-security', 'ethical-hacking'],
  },
  {
    title: 'Security Fundamentals for Developers',
    subcategoryId: 'security-fundamentals',
    tags: ['secure-coding', 'fundamentals', 'developers'],
  },
];

const DATA_ANALYTICS_FILLERS: readonly FillerSpec[] = [
  {
    title: 'SQL for Data Analysis',
    subcategoryId: 'sql-analytics',
    tags: ['sql', 'analytics', 'data'],
  },
  {
    title: 'Data Visualization with Tableau',
    subcategoryId: 'data-visualization',
    tags: ['tableau', 'visualization', 'data'],
  },
  {
    title: 'Modern Data Engineering with Airflow',
    subcategoryId: 'data-engineering',
    tags: ['airflow', 'data-engineering', 'pipelines'],
  },
  {
    title: 'Business Intelligence with Power BI',
    subcategoryId: 'business-intelligence',
    tags: ['power-bi', 'bi', 'dashboards'],
  },
  {
    title: 'Statistics for Data Analysts',
    subcategoryId: 'sql-analytics',
    tags: ['statistics', 'analytics', 'data'],
  },
  {
    title: 'Python for Data Analysis',
    subcategoryId: 'sql-analytics',
    tags: ['python', 'pandas', 'data'],
  },
  {
    title: 'Data Warehousing Fundamentals',
    subcategoryId: 'data-engineering',
    tags: ['data-warehouse', 'etl', 'data-engineering'],
  },
  {
    title: 'A/B Testing and Experimentation',
    subcategoryId: 'business-intelligence',
    tags: ['experimentation', 'statistics', 'product'],
  },
  {
    title: 'Excel to SQL: A Practical Bridge',
    subcategoryId: 'sql-analytics',
    tags: ['excel', 'sql', 'data'],
  },
];

const DESIGN_UX_FILLERS: readonly FillerSpec[] = [
  {
    title: 'UI Design Foundations',
    subcategoryId: 'ui-design',
    tags: ['ui', 'visual-design', 'fundamentals'],
  },
  {
    title: 'Design Systems at Scale',
    subcategoryId: 'design-systems',
    tags: ['design-systems', 'components', 'ui'],
  },
  {
    title: 'Product Design Portfolio Bootcamp',
    subcategoryId: 'product-design',
    tags: ['portfolio', 'product-design', 'career'],
  },
  {
    title: 'User Interviews and Usability Testing',
    subcategoryId: 'ux-research',
    tags: ['research', 'usability', 'interviews'],
  },
  {
    title: 'Figma for Product Designers',
    subcategoryId: 'ui-design',
    tags: ['figma', 'ui', 'tools'],
  },
  {
    title: 'Typography and Visual Hierarchy',
    subcategoryId: 'ui-design',
    tags: ['typography', 'visual-design', 'ui'],
  },
  {
    title: 'Design Thinking Workshop',
    subcategoryId: 'product-design',
    tags: ['design-thinking', 'process', 'workshop'],
  },
  {
    title: 'Mobile App Design Principles',
    subcategoryId: 'ui-design',
    tags: ['mobile', 'ui', 'design'],
  },
  {
    title: 'Accessibility in Design',
    subcategoryId: 'ux-research',
    tags: ['accessibility', 'a11y', 'research'],
  },
];

const BUSINESS_MARKETING_FILLERS: readonly FillerSpec[] = [
  {
    title: 'Digital Marketing Fundamentals',
    subcategoryId: 'digital-marketing',
    tags: ['marketing', 'fundamentals', 'digital'],
  },
  {
    title: 'Growth Marketing Playbook',
    subcategoryId: 'growth-marketing',
    tags: ['growth', 'marketing', 'experiments'],
  },
  {
    title: 'Product Management Foundations',
    subcategoryId: 'product-management',
    tags: ['product-management', 'fundamentals', 'strategy'],
  },
  {
    title: 'Startup Fundraising 101',
    subcategoryId: 'entrepreneurship',
    tags: ['fundraising', 'startups', 'entrepreneurship'],
  },
  {
    title: 'Content Marketing Strategy',
    subcategoryId: 'digital-marketing',
    tags: ['content', 'marketing', 'strategy'],
  },
  {
    title: 'SEO for Marketers',
    subcategoryId: 'digital-marketing',
    tags: ['seo', 'marketing', 'organic'],
  },
  {
    title: 'Email Marketing that Converts',
    subcategoryId: 'digital-marketing',
    tags: ['email', 'marketing', 'conversion'],
  },
  {
    title: 'Financial Modeling for Startups',
    subcategoryId: 'entrepreneurship',
    tags: ['finance', 'startups', 'modeling'],
  },
  {
    title: 'Negotiation Skills for Managers',
    subcategoryId: 'product-management',
    tags: ['negotiation', 'management', 'skills'],
  },
  {
    title: 'Brand Strategy Essentials',
    subcategoryId: 'growth-marketing',
    tags: ['branding', 'strategy', 'marketing'],
  },
];

function generateFillerCourses(
  rng: () => number,
  categoryId: CategoryId,
  specs: readonly FillerSpec[],
  durationRange: readonly [number, number],
): DraftCourse[] {
  const nonEnglish = LANGUAGES.filter((l): l is Language => l !== 'en');

  return specs.map((spec) => {
    const level: Level = pick(rng, LEVELS);
    const language: Language = rng() < 0.88 ? 'en' : pick(rng, nonEnglish);
    const durationHours = round2(randFloat(rng, durationRange[0], durationRange[1]));
    const lessonsCount = Math.max(6, Math.round(durationHours * randFloat(rng, 3, 5)));
    const hasCertificate = rng() < 0.85;

    const levelFactor = level === 'beginner' ? 0.7 : level === 'advanced' ? 1.3 : 1;
    const price = Math.round(((19 + durationHours * 2.6) * levelFactor) / 5) * 5;
    const originalPrice =
      rng() < 0.55 ? Math.round((price * randFloat(rng, 1.4, 1.9)) / 5) * 5 : null;

    const publishedDaysAgo = randInt(rng, 60, 1900);
    const publishedAt = isoDaysBefore(DATASET_AS_OF, publishedDaysAgo);
    const updateDaysAgo = randInt(rng, 10, Math.min(publishedDaysAgo, 1100));
    const lastContentUpdateAt = isoDaysBefore(DATASET_AS_OF, updateDaysAgo);

    // Raw ratings concentrated 4.1–4.8, with an occasional lower outlier for realism.
    const ratingAvg = round2(rng() < 0.85 ? randFloat(rng, 4.1, 4.8) : randFloat(rng, 3.5, 4.1));
    // Log-normal-ish: sampling uniformly in log-space spans several orders of magnitude.
    const ratingCount = Math.max(
      15,
      Math.round(Math.exp(randFloat(rng, Math.log(15), Math.log(3200)))),
    );
    const enrollments = Math.round(ratingCount * randFloat(rng, 12, 140) + randFloat(rng, 0, 400));
    const enrollments30d = Math.round(enrollments * randFloat(rng, 0.015, 0.05));

    // Completion is inversely related to duration (docs/02 §4).
    const durationPenalty = Math.min(0.5, durationHours / 70);
    const completionRate = round2(
      clamp(0.78 - durationPenalty - randFloat(rng, 0, 0.15), 0.12, 0.82),
    );
    const medianWatchPercent = round2(
      clamp(completionRate + randFloat(rng, 0.05, 0.18), 0.15, 0.95),
    );
    const refundRate = round2(randFloat(rng, 0.01, 0.09));

    const instructorId = pick(rng, RANDOM_INSTRUCTOR_POOL);

    return {
      slug: slugify(spec.title),
      title: spec.title,
      subtitle: `A practical, project-based course in ${spec.tags[0] ?? spec.subcategoryId}.`,
      categoryId,
      subcategoryId: spec.subcategoryId,
      tags: spec.tags,
      instructorId,
      level,
      language,
      durationHours,
      lessonsCount,
      hasCertificate,
      price,
      originalPrice,
      publishedAt,
      lastContentUpdateAt,
      ratingAvg,
      ratingCount,
      ratingDistribution: buildRatingDistribution(ratingAvg, ratingCount),
      enrollments,
      enrollments30d,
      completionRate,
      medianWatchPercent,
      refundRate,
      promo: null,
      policyFlags: [],
    };
  });
}

const rng = createRng(SEED);

// Fixed call order — required for byte-identical reruns from the same seed.
const webDevFillers = generateFillerCourses(rng, 'web-dev', WEB_DEV_FILLERS, [4, 40]);
const dataAnalyticsFillers = generateFillerCourses(
  rng,
  'data-analytics',
  DATA_ANALYTICS_FILLERS,
  [5, 25],
);
const designUxFillers = generateFillerCourses(rng, 'design-ux', DESIGN_UX_FILLERS, [4, 18]);
const businessMarketingFillers = generateFillerCourses(
  rng,
  'business-marketing',
  BUSINESS_MARKETING_FILLERS,
  [3, 15],
);
const cybersecurityFillers = generateFillerCourses(
  rng,
  'cybersecurity',
  CYBERSECURITY_FILLERS,
  [6, 20],
);

// ---------------------------------------------------------------------------
// Assembly — category order matches `CATEGORIES` (docs/02 §2)
// ---------------------------------------------------------------------------

const draftCourses: DraftCourse[] = [
  ...heroCourses, // ai-ml: 16
  case15,
  ...webDevFillers, // web-dev: 13
  case16a,
  ...dataAnalyticsFillers, // data-analytics: 10
  case16b,
  ...designUxFillers, // design-ux: 10
  ...businessMarketingFillers, // business-marketing: 10
  case14,
  ...cybersecurityFillers, // cybersecurity: 5
];

/**
 * Sequential ids, except case 5 which must be `c-042` — it is the schema
 * example course in docs/02 §3, quoted verbatim there with that id.
 */
function assignIds(courses: readonly DraftCourse[]): Course[] {
  let counter = 0;
  return courses.map((course) => {
    if (course.slug === 'applied-ml-for-analysts') {
      return { ...course, id: 'c-042' };
    }
    counter += 1;
    if (counter === 42) {
      counter += 1;
    }
    return { ...course, id: `c-${String(counter).padStart(3, '0')}` };
  });
}

const courses: Course[] = assignIds(draftCourses);

const instructors: Instructor[] = INSTRUCTOR_SEEDS.map((seed) => ({
  ...seed,
  coursesCount: courses.filter((c) => c.instructorId === seed.id).length,
}));

// ---------------------------------------------------------------------------
// Invariants — docs/02-dataset-spec.md §5
// ---------------------------------------------------------------------------

const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
  }
}

function categoryMeanRawRating(categoryId: CategoryId, gatedOnly: boolean): number {
  const inCategory = courses.filter(
    (c) => c.categoryId === categoryId && (!gatedOnly || c.policyFlags.length === 0),
  );
  return inCategory.reduce((acc, c) => acc + c.ratingAvg, 0) / inCategory.length;
}

// --- Data integrity ---------------------------------------------------------

const subcategoriesByCategory = new Map<CategoryId, Set<SubcategoryId>>(
  CATEGORIES.map((c) => [c.id, new Set(c.subcategories.map((s) => s.id))]),
);
const instructorIds = new Set(instructors.map((i) => i.id));
const categoryIds = new Set(CATEGORIES.map((c) => c.id));

for (const course of courses) {
  check(
    course.lastContentUpdateAt >= course.publishedAt,
    `${course.id} (${course.title}): lastContentUpdateAt before publishedAt`,
  );
  const distSum = course.ratingDistribution.reduce((a, b) => a + b, 0);
  check(
    distSum === course.ratingCount,
    `${course.id} (${course.title}): ratingDistribution sums to ${distSum}, not ratingCount ${course.ratingCount}`,
  );
  const weightedMean =
    course.ratingDistribution.reduce((acc, n, i) => acc + n * (i + 1), 0) / course.ratingCount;
  check(
    Math.abs(weightedMean - course.ratingAvg) <= 0.05,
    `${course.id} (${course.title}): ratingDistribution mean ${weightedMean.toFixed(3)} vs ratingAvg ${course.ratingAvg}`,
  );
  check(
    course.completionRate >= 0 && course.completionRate <= 1,
    `${course.id}: completionRate out of [0,1]`,
  );
  check(
    course.medianWatchPercent >= 0 && course.medianWatchPercent <= 1,
    `${course.id}: medianWatchPercent out of [0,1]`,
  );
  check(course.refundRate >= 0 && course.refundRate <= 1, `${course.id}: refundRate out of [0,1]`);
  check(course.durationHours > 0, `${course.id}: durationHours not > 0`);
  check(course.price >= 0, `${course.id}: price not >= 0`);
  check(
    instructorIds.has(course.instructorId),
    `${course.id}: instructorId ${course.instructorId} does not resolve`,
  );
  check(
    categoryIds.has(course.categoryId),
    `${course.id}: categoryId ${course.categoryId} does not resolve`,
  );
  check(
    subcategoriesByCategory.get(course.categoryId)?.has(course.subcategoryId) ?? false,
    `${course.id}: subcategoryId ${course.subcategoryId} does not resolve in ${course.categoryId}`,
  );
}

const EXPECTED_CATEGORY_COUNTS: Readonly<Record<CategoryId, number>> = {
  'ai-ml': 16,
  'web-dev': 13,
  'data-analytics': 10,
  'design-ux': 10,
  'business-marketing': 10,
  cybersecurity: 5,
};
const countsByCategory = new Map<CategoryId, number>();
for (const course of courses) {
  countsByCategory.set(course.categoryId, (countsByCategory.get(course.categoryId) ?? 0) + 1);
}
for (const [categoryId, expected] of Object.entries(EXPECTED_CATEGORY_COUNTS) as [
  CategoryId,
  number,
][]) {
  check(
    countsByCategory.get(categoryId) === expected,
    `category ${categoryId}: expected ${expected} courses, got ${countsByCategory.get(categoryId)}`,
  );
}
check(courses.length === 64, `expected 64 courses total, got ${courses.length}`);
const belowThreshold = [...countsByCategory.entries()].filter(([, n]) => n < SMALL_BASIS_THRESHOLD);
check(
  belowThreshold.length === 1,
  `expected exactly one category below ${SMALL_BASIS_THRESHOLD} courses, got ${belowThreshold.length}`,
);

// --- Demo integrity — standalone ---------------------------------------------

const heroMean = categoryMeanRawRating('ai-ml', false);
check(
  round2(heroMean) === HERO_TARGET_MEAN,
  `hero category mean raw rating rounds to ${round2(heroMean)}, not ${HERO_TARGET_MEAN}`,
);

for (const category of CATEGORIES) {
  if (category.id === 'ai-ml') continue;
  const mean = categoryMeanRawRating(category.id, false);
  check(
    mean >= 3.9 && mean <= 4.7,
    `${category.id}: mean raw rating ${mean.toFixed(3)} outside [3.9, 4.7]`,
  );
}

const promoCourses = courses.filter((c) => c.promo !== null);
check(promoCourses.length === 4, `expected exactly 4 promo courses, got ${promoCourses.length}`);

interface GateEvaluation {
  readonly course: Course;
  readonly adjustedRating: number;
  readonly categoryMean: number;
  readonly passed: boolean;
}

function evaluatePromoGate(course: Course): GateEvaluation {
  const categoryMean = categoryMeanRawRating(course.categoryId, true);
  const adjustedRating = computeAdjustedRating(course.ratingAvg, course.ratingCount, categoryMean);
  const passed =
    adjustedRating >= categoryMean &&
    course.ratingCount >= MIN_RATING_COUNT &&
    course.policyFlags.length === 0 &&
    monthsSince(course.lastContentUpdateAt, DATASET_AS_OF) <= PROMO_MAX_CONTENT_AGE_MONTHS;
  return { course, adjustedRating, categoryMean, passed };
}

const gateEvaluations = promoCourses.map(evaluatePromoGate);
const gatePassed = gateEvaluations.filter((e) => e.passed);
const gateFailed = gateEvaluations.filter((e) => !e.passed);
check(
  gatePassed.length === 3,
  `expected exactly 3 promo courses to pass the quality gate, got ${gatePassed.length}`,
);
check(
  gateFailed.length === 1,
  `expected exactly 1 promo course to fail the quality gate, got ${gateFailed.length}`,
);

const case6Evaluation = gateEvaluations.find(
  (e) => e.course.slug === 'ai-growth-hacking-masterclass-2026',
);
if (case6Evaluation === undefined) {
  failures.push('case 6 (AI Growth Hacking Masterclass 2026) not found among promo courses');
} else {
  check(
    round2(case6Evaluation.adjustedRating) === 3.97,
    `case 6 R_adj rounds to ${round2(case6Evaluation.adjustedRating)}, not 3.97`,
  );
  check(
    case6Evaluation.adjustedRating < heroMean,
    `case 6 R_adj (${case6Evaluation.adjustedRating.toFixed(3)}) is not below the hero mean (${heroMean.toFixed(3)})`,
  );
  check(!case6Evaluation.passed, 'case 6 must fail the promo quality gate');
}

const heroUnder20 = courses.filter(
  (c) => c.categoryId === 'ai-ml' && c.ratingCount < MIN_RATING_COUNT,
);
check(
  heroUnder20.length >= 3,
  `expected at least 3 hero courses with ratingCount < ${MIN_RATING_COUNT}, got ${heroUnder20.length}`,
);

const marcusWebbCourses = courses.filter((c) => c.instructorId === 'i-01');
check(
  marcusWebbCourses.length === 5,
  `expected Marcus Webb (i-01) to have exactly 5 courses, got ${marcusWebbCourses.length}`,
);
check(
  marcusWebbCourses.every((c) => c.categoryId === 'ai-ml'),
  "expected all of Marcus Webb's courses to be in the hero category",
);

const cybersecurityCourses = courses.filter((c) => c.categoryId === 'cybersecurity');
check(
  cybersecurityCourses.length < SMALL_BASIS_THRESHOLD,
  `Cybersecurity has ${cybersecurityCourses.length} courses, expected fewer than ${SMALL_BASIS_THRESHOLD}`,
);
const cybersecurityCandidates = cybersecurityCourses.filter((c) => c.policyFlags.length === 0);
check(
  cybersecurityCandidates.length === 4,
  `expected exactly 4 Cybersecurity candidates after gating, got ${cybersecurityCandidates.length}`,
);

// --- Demo integrity — position-dependent (deferred to Phase 3) --------------

/**
 * These six invariants (docs/02-dataset-spec.md §5) need the ranking engine's
 * actual output — organic rank, top-10 membership, position deltas under
 * toggles. Phase 3 wires this up for real, running `pipeline.ts` under the
 * required configurations (docs/04-build-brief.md Phase 2, step 4).
 */
function assertPositionDependentInvariants(): void {
  function heroOrder(
    overrides: Partial<Parameters<typeof rank>[0]> = {},
  ): ReturnType<typeof rank>['results'] {
    const base = {
      courses,
      categoryId: 'ai-ml' as CategoryId,
      filters: DEFAULT_FILTERS,
      sortMode: 'recommended' as const,
      weights: WEIGHT_PRESETS.balanced,
      toggles: DEFAULT_TOGGLES,
      asOfIsoDate: DATASET_AS_OF,
      ...overrides,
    };
    const page1 = rank({ ...base, page: 1 });
    const page2 = rank({ ...base, page: 2 });
    return [...page1.results, ...page2.results];
  }

  function findCourse(slug: string): Course {
    const found = courses.find((c) => c.slug === slug);
    if (found === undefined) {
      throw new Error(`assertPositionDependentInvariants: course not found: ${slug}`);
    }
    return found;
  }

  function organicRankOf(
    order: ReturnType<typeof rank>['results'],
    courseId: string,
  ): number {
    const found = order.find((r) => r.course.id === courseId);
    if (found === undefined) {
      throw new Error(`assertPositionDependentInvariants: course ${courseId} not in results`);
    }
    return found.organicRank;
  }

  const case1 = findCourse('machine-learning-fundamentals-reloaded');
  const case2 = findCourse('the-complete-ai-and-machine-learning-bootcamp');
  const case5 = findCourse('applied-ml-for-analysts');

  const defaultOrder = heroOrder();
  const case1Rank = organicRankOf(defaultOrder, case1.id);
  const case2Rank = organicRankOf(defaultOrder, case2.id);
  const case5Rank = organicRankOf(defaultOrder, case5.id);

  check(case1Rank > 8, `case 1 organic rank is ${case1Rank}, expected outside the top 8`);
  check(
    case5Rank >= 5 && case5Rank <= 9,
    `case 5 organic rank is ${case5Rank}, expected in [5, 9]`,
  );

  const noShrinkage = heroOrder({ toggles: { ...DEFAULT_TOGGLES, shrinkage: false } });
  const case1RankNoShrinkage = organicRankOf(noShrinkage, case1.id);
  check(
    case1Rank - case1RankNoShrinkage >= 6,
    `case 1 rises ${case1Rank - case1RankNoShrinkage} positions with shrinkage disabled, expected >= 6`,
  );

  const noOutcome = heroOrder({ toggles: { ...DEFAULT_TOGGLES, outcomeFactor: false } });
  const case2RankNoOutcome = organicRankOf(noOutcome, case2.id);
  check(
    case2Rank - case2RankNoOutcome >= 3,
    `case 2 rises ${case2Rank - case2RankNoOutcome} positions with Outcome disabled, expected >= 3`,
  );

  const popularityLed = heroOrder({ weights: WEIGHT_PRESETS['popularity-led'] });
  const case2RankPopularityLed = organicRankOf(popularityLed, case2.id);
  check(
    case2RankPopularityLed === 1,
    `case 2 organic rank under the Popularity-led preset is ${case2RankPopularityLed}, expected 1`,
  );

  const noDiversityCap = heroOrder({ toggles: { ...DEFAULT_TOGGLES, diversityCap: false } });
  const webbTop10WithoutCap = noDiversityCap.filter(
    (r) => r.organicRank <= 10 && r.course.instructorId === 'i-01',
  ).length;
  check(
    webbTop10WithoutCap >= 3,
    `Marcus Webb has ${webbTop10WithoutCap} courses in the organic top 10 without the ` +
      'diversity cap, expected >= 3',
  );
}

// ---------------------------------------------------------------------------
// Report and write
// ---------------------------------------------------------------------------

function printSummary(): void {
  console.log('\n=== Dataset summary ===\n');

  console.log('Courses per category:');
  for (const category of CATEGORIES) {
    console.log(`  ${category.name.padEnd(24)} ${countsByCategory.get(category.id) ?? 0}`);
  }

  console.log('\nCategory mean raw ratings:');
  for (const category of CATEGORIES) {
    console.log(
      `  ${category.name.padEnd(24)} ${categoryMeanRawRating(category.id, false).toFixed(3)}`,
    );
  }

  console.log('\nPromo courses and gate status:');
  for (const evaluation of gateEvaluations) {
    const status = evaluation.passed ? 'PASSED' : 'REJECTED';
    console.log(
      `  ${evaluation.course.id}  ${evaluation.course.title.padEnd(38)} R_adj=${evaluation.adjustedRating.toFixed(3)} vs C=${evaluation.categoryMean.toFixed(3)}  ${status}`,
    );
  }

  console.log('\nStandalone and position-dependent demo-integrity checks: all passed.');
  console.log('');
}

function main(): void {
  assertPositionDependentInvariants();

  if (failures.length > 0) {
    throw new Error(
      `Dataset generation failed ${failures.length} invariant(s):\n  - ${failures.join('\n  - ')}`,
    );
  }

  printSummary();

  const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
  writeFileSync(
    path.join(dataDir, 'courses.json'),
    `${JSON.stringify(courses, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(dataDir, 'instructors.json'),
    `${JSON.stringify(instructors, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `Wrote ${courses.length} courses and ${instructors.length} instructors to src/data/.`,
  );
}

main();
