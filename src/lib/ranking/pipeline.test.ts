/**
 * One test per planted case, docs/02-dataset-spec.md §4. Each case was chosen
 * to make a specific mechanic of docs/01-ranking-algorithm.md visible; the
 * test asserts exactly that behaviour against the real, committed dataset —
 * the same numbers the deployed Score Inspector shows.
 */
import { describe, expect, it } from 'vitest';

import { HERO_CATEGORY_ID } from '@/data/categories';
import coursesData from '@/data/courses.json';

import {
  DATASET_AS_OF,
  DEFAULT_FILTERS,
  DEFAULT_TOGGLES,
  MIN_RATING_COUNT,
  WEIGHT_PRESETS,
} from './constants';
import { rank, type RankOptions } from './pipeline';
import type { Course, PipelineResult, RankedCourse } from './types';

const courses = coursesData as unknown as readonly Course[];

function findCourse(slug: string): Course {
  const found = courses.find((c) => c.slug === slug);
  if (found === undefined) {
    throw new Error(`fixture course not found: ${slug}`);
  }
  return found;
}

/** Every page of the hero category, in final (post-promo) order. */
function heroOrder(overrides: Partial<RankOptions> = {}): readonly RankedCourse[] {
  const base: RankOptions = {
    courses,
    categoryId: HERO_CATEGORY_ID,
    filters: DEFAULT_FILTERS,
    sortMode: 'recommended',
    weights: WEIGHT_PRESETS.balanced,
    toggles: DEFAULT_TOGGLES,
    page: 1,
    asOfIsoDate: DATASET_AS_OF,
    ...overrides,
  };
  const results: RankedCourse[] = [];
  for (let page = 1; page <= 2; page += 1) {
    results.push(...rank({ ...base, page }).results);
  }
  return results;
}

function organicRankOf(order: readonly RankedCourse[], courseId: string): number {
  const found = order.find((r) => r.course.id === courseId);
  if (found === undefined) {
    throw new Error(`course ${courseId} not present in results`);
  }
  return found.organicRank;
}

function rankOne(options: Partial<RankOptions> & { categoryId: RankOptions['categoryId'] }): PipelineResult {
  return rank({
    courses,
    filters: DEFAULT_FILTERS,
    sortMode: 'recommended',
    weights: WEIGHT_PRESETS.balanced,
    toggles: DEFAULT_TOGGLES,
    page: 1,
    asOfIsoDate: DATASET_AS_OF,
    ...options,
  });
}

describe('case 1 — Bayesian shrinkage (Machine Learning Fundamentals Reloaded)', () => {
  const course = findCourse('machine-learning-fundamentals-reloaded');

  it('shrinks a perfect 5.00/6-rating course to 4.38 and keeps it outside the top 8', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    expect(result.adjustedRating).toBeCloseTo(4.38, 1);
    expect(result.organicRank).toBeGreaterThan(8);
  });

  it('rises at least 6 positions when shrinkage is disabled', () => {
    const withShrinkage = organicRankOf(heroOrder(), course.id);
    const withoutShrinkage = organicRankOf(
      heroOrder({ toggles: { ...DEFAULT_TOGGLES, shrinkage: false } }),
      course.id,
    );
    expect(withShrinkage - withoutShrinkage).toBeGreaterThanOrEqual(6);
  });

  it('is removed by the ratingCount >= 20 gate in Highest rated mode', () => {
    const highestRated = rankOne({ categoryId: HERO_CATEGORY_ID, sortMode: 'highest-rated' });
    expect(highestRated.meta.hiddenByGate.some((g) => g.course.id === course.id)).toBe(true);
    expect(course.ratingCount).toBeLessThan(MIN_RATING_COUNT);
  });
});

describe('case 2 — Outcome layer (The Complete AI & Machine Learning Bootcamp)', () => {
  const course = findCourse('the-complete-ai-and-machine-learning-bootcamp');

  it('has the top popularity percentile in the category yet is not first', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    const popularity = result.explanation.factors.find((f) => f.factor === 'popularity')!;
    expect(popularity.percentile).toBe(1);
    expect(result.organicRank).toBeGreaterThan(1);
  });

  it('rises at least 3 positions when the Outcome factor is disabled', () => {
    const withOutcome = organicRankOf(heroOrder(), course.id);
    const withoutOutcome = organicRankOf(
      heroOrder({ toggles: { ...DEFAULT_TOGGLES, outcomeFactor: false } }),
      course.id,
    );
    expect(withOutcome - withoutOutcome).toBeGreaterThanOrEqual(3);
  });

  it('reaches organic rank 1 under the Popularity-led preset', () => {
    const order = heroOrder({ weights: WEIGHT_PRESETS['popularity-led'] });
    expect(organicRankOf(order, course.id)).toBe(1);
  });
});

describe('case 3 — Freshness decay (Deep Learning with TensorFlow 2)', () => {
  const course = findCourse('deep-learning-with-tensorflow-2');

  it('is well-reviewed but visibly demoted by a near-bottom freshness percentile', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    const quality = result.explanation.factors.find((f) => f.factor === 'quality')!;
    const freshness = result.explanation.factors.find((f) => f.factor === 'freshness')!;
    // 4.81 raw / 3,100 ratings — near the top of the category on quality alone.
    expect(quality.percentile).toBeGreaterThan(0.85);
    // Updated 34 months ago — the demonstration only works if freshness
    // drags a genuinely well-reviewed course down, not up.
    expect(freshness.percentile).toBeLessThan(0.3);
  });
});

describe('case 4 — Cold start (Prompt Engineering for Product Teams)', () => {
  const course = findCourse('prompt-engineering-for-product-teams');

  it('has too few ratings to be trusted, so shrinkage pulls it toward the category mean', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    expect(course.ratingCount).toBeLessThan(MIN_RATING_COUNT);
    // Raw 4.90 shrunk hard toward C = 4.31 — nowhere near its raw rating.
    expect(result.adjustedRating).toBeLessThan(course.ratingAvg - 0.3);
  });
});

describe('case 5 — Promo, gate passed (Applied ML for Analysts)', () => {
  const course = findCourse('applied-ml-for-analysts');

  it('is injected into slot 1 with an organic rank between 5 and 9', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    expect(result.promo).not.toBeNull();
    expect(result.promo!.injected).toBe(true);
    expect(result.promo!.slot).toBe(1);
    expect(result.promo!.gate.passed).toBe(true);
    expect(result.organicRank).toBeGreaterThanOrEqual(5);
    expect(result.organicRank).toBeLessThanOrEqual(9);
  });
});

describe('case 6 — The quality gate (AI Growth Hacking Masterclass 2026)', () => {
  const course = findCourse('ai-growth-hacking-masterclass-2026');

  it('fails the promo gate and states both numbers in the rejection', () => {
    const result = rankOne({ categoryId: HERO_CATEGORY_ID });
    const rejected = result.meta.promoRejected.find((r) => r.course.id === course.id);
    expect(rejected).toBeDefined();
    expect(rejected!.adjustedRating).toBeCloseTo(3.97, 1);
    expect(rejected!.adjustedRating).toBeLessThan(result.meta.categoryMeanRawRating);
    expect(rejected!.promo!.gate.passed).toBe(false);
    expect(rejected!.promo!.gate.failureMessage).toContain('3.97');
    expect(rejected!.promo!.gate.failureMessage).toContain(
      result.meta.categoryMeanRawRating.toFixed(2),
    );
  });

  it('is not injected, so it appears only in its organic position', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    expect(result.isPromotedPlacement).toBe(false);
  });

  it('is promoted to position 1 once the promo quality gate is disabled', () => {
    const order = heroOrder({ toggles: { ...DEFAULT_TOGGLES, promoQualityGate: false } });
    const result = order.find((r) => r.course.id === course.id)!;
    expect(result.isPromotedPlacement).toBe(true);
    expect(result.position).toBe(1);
  });
});

describe('case 7 — Featured vs Sponsored (AI Product Management Essentials)', () => {
  const course = findCourse('ai-product-management-essentials');

  it('is labelled Featured, passes the gate and takes slot 6', () => {
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    expect(result.promo).not.toBeNull();
    expect(result.promo!.type).toBe('featured');
    expect(result.promo!.gate.passed).toBe(true);
    expect(result.promo!.injected).toBe(true);
    expect(result.promo!.slot).toBe(6);
  });
});

describe('case 8 — Diversity cap (Marcus Webb, instructor i-01)', () => {
  const INSTRUCTOR_ID = 'i-01';

  it('owns exactly 5 courses in the hero category', () => {
    const webbCourses = courses.filter(
      (c) => c.categoryId === HERO_CATEGORY_ID && c.instructorId === INSTRUCTOR_ID,
    );
    expect(webbCourses).toHaveLength(5);
  });

  it('has at most 2 of those courses in the top 10 with the cap enabled', () => {
    const order = heroOrder();
    const inTop10 = order.filter((r) => r.position <= 10 && r.course.instructorId === INSTRUCTOR_ID);
    expect(inTop10.length).toBeLessThanOrEqual(2);
  });

  it('would place at least 3 in the organic top 10 with the cap disabled', () => {
    const order = heroOrder({ toggles: { ...DEFAULT_TOGGLES, diversityCap: false } });
    const inTop10 = order.filter(
      (r) => r.organicRank <= 10 && r.course.instructorId === INSTRUCTOR_ID,
    );
    expect(inTop10.length).toBeGreaterThanOrEqual(3);
  });
});

describe('case 9 — Free-only filter and price sort (Intro to Python for ML)', () => {
  const course = findCourse('intro-to-python-for-ml');

  it('is free and appears first when sorting price low to high', () => {
    expect(course.price).toBe(0);
    const result = rankOne({ categoryId: HERO_CATEGORY_ID, sortMode: 'price-asc' });
    expect(result.results[0]!.course.price).toBe(0);
  });

  it('is included by the free-only filter and excluded by the paid-only filter', () => {
    const free = rankOne({
      categoryId: HERO_CATEGORY_ID,
      filters: { ...DEFAULT_FILTERS, priceMode: 'free' },
    });
    const paid = rankOne({
      categoryId: HERO_CATEGORY_ID,
      filters: { ...DEFAULT_FILTERS, priceMode: 'paid' },
    });
    expect(free.results.some((r) => r.course.id === course.id)).toBe(true);
    expect(paid.results.some((r) => r.course.id === course.id)).toBe(false);
  });
});

describe('case 10 — The Outcome caveat (Advanced MLOps on Kubernetes)', () => {
  const course = findCourse('advanced-mlops-on-kubernetes');

  it('has low completion for an advanced course, read relative to the category rather than absolutely', () => {
    expect(course.level).toBe('advanced');
    expect(course.completionRate).toBeCloseTo(0.34, 2);
    const order = heroOrder();
    const result = order.find((r) => r.course.id === course.id)!;
    const outcome = result.explanation.factors.find((f) => f.factor === 'outcome')!;
    // Percentile normalisation means an absolute 34% completion does not
    // collapse to the bottom of the category outcome ranking.
    expect(outcome.percentile).toBeGreaterThan(0);
  });
});

describe('case 11 — Language filter (Maschinelles Lernen mit Python)', () => {
  const course = findCourse('maschinelles-lernen-mit-python');

  it('is German, and the language filter narrows the default hero view around it', () => {
    expect(course.language).toBe('de');
    const german = rankOne({
      categoryId: HERO_CATEGORY_ID,
      filters: { ...DEFAULT_FILTERS, languages: ['de'] },
    });
    const english = rankOne({
      categoryId: HERO_CATEGORY_ID,
      filters: { ...DEFAULT_FILTERS, languages: ['en'] },
    });
    expect(german.results.some((r) => r.course.id === course.id)).toBe(true);
    expect(english.results.some((r) => r.course.id === course.id)).toBe(false);
  });
});

describe('case 12 — Third sub-20-rating course (Reinforcement Learning Crash Course)', () => {
  const course = findCourse('reinforcement-learning-crash-course');

  it('has 14 ratings, and the hero category has at least 3 courses under the gate', () => {
    expect(course.ratingCount).toBe(14);
    const highestRated = rankOne({ categoryId: HERO_CATEGORY_ID, sortMode: 'highest-rated' });
    const heroHidden = highestRated.meta.hiddenByGate.filter(
      (g) => g.gate === 'min-rating-count',
    );
    expect(heroHidden.length).toBeGreaterThanOrEqual(3);
    expect(heroHidden.some((g) => g.course.id === course.id)).toBe(true);
  });
});

describe('case 13 — Small-category fallback (Cybersecurity)', () => {
  it('normalises against the whole (policy-gated) global pool with exactly 4 candidates', () => {
    const result = rankOne({ categoryId: 'cybersecurity' });
    const policyGatedGlobalCount = courses.filter((c) => c.policyFlags.length === 0).length;
    expect(result.meta.normalisationBasis).toBe('global');
    expect(result.meta.candidateCount).toBe(4);
    expect(result.meta.basisSize).toBe(policyGatedGlobalCount);
  });

  it('is the only category using the global basis', () => {
    const categoryIds = [...new Set(courses.map((c) => c.categoryId))];
    const globalBasisCategories = categoryIds.filter(
      (id) => rankOne({ categoryId: id }).meta.normalisationBasis === 'global',
    );
    expect(globalBasisCategories).toEqual(['cybersecurity']);
  });
});

describe('case 14 — Gate removal (Ethical Hacking Bootcamp)', () => {
  const course = findCourse('ethical-hacking-bootcamp');

  it('is policy-flagged, present in the data but absent from results with a stated reason', () => {
    expect(course.policyFlags).toContain('under-review');
    const result = rankOne({ categoryId: 'cybersecurity' });
    expect(result.results.some((r) => r.course.id === course.id)).toBe(false);
    const rejection = result.meta.hiddenByGate.find((g) => g.course.id === course.id);
    expect(rejection).toBeDefined();
    expect(rejection!.gate).toBe('policy-flag');
    expect(rejection!.reason.length).toBeGreaterThan(0);
  });

  it('leaves exactly 4 Cybersecurity candidates after gating', () => {
    const result = rankOne({ categoryId: 'cybersecurity' });
    expect(result.meta.candidateCount).toBe(4);
  });
});

describe('case 15 — Promo is platform-wide (The Full-Stack TypeScript Path)', () => {
  const course = findCourse('the-full-stack-typescript-path');

  it('is a sponsored course outside the hero category that also passes the gate', () => {
    expect(course.categoryId).toBe('web-dev');
    expect(course.promo?.type).toBe('sponsored');
    const result = rankOne({ categoryId: 'web-dev' });
    const placed = result.results.find((r) => r.course.id === course.id);
    expect(placed?.promo?.gate.passed).toBe(true);
  });
});

describe('case 16 — Language filter outside the hero category', () => {
  it('Data Storytelling (Data & Analytics) is German', () => {
    const course = findCourse('data-storytelling');
    expect(course.categoryId).toBe('data-analytics');
    expect(course.language).toBe('de');
  });

  it('UX Research Foundations (Design & UX) is Spanish', () => {
    const course = findCourse('ux-research-foundations');
    expect(course.categoryId).toBe('design-ux');
    expect(course.language).toBe('es');
  });
});

describe('Phase 3 checkpoint — filters never change a score (docs/01 §4.1)', () => {
  // Percentiles are computed over the whole gated category before filters run
  // (§4.1), so a filter that does not itself feed Fit — unlike level,
  // duration or subcategory, which are legitimately part of the per-request
  // Fit signal (§3.5) — must leave every remaining course's score untouched.
  it('leaves every remaining course score unchanged when the minimum-rating filter is applied', () => {
    const unfiltered = heroOrder();
    const scoresById = new Map(unfiltered.map((r) => [r.course.id, r.score]));

    const filtered = heroOrder({
      filters: { ...DEFAULT_FILTERS, minAdjustedRating: 4 },
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(unfiltered.length);
    for (const result of filtered) {
      expect(result.score).toBe(scoresById.get(result.course.id));
    }
  });

  it('leaves every remaining course score unchanged when the certificate filter is applied', () => {
    const unfiltered = heroOrder();
    const scoresById = new Map(unfiltered.map((r) => [r.course.id, r.score]));

    const filtered = heroOrder({ filters: { ...DEFAULT_FILTERS, certificateOnly: true } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(unfiltered.length);
    for (const result of filtered) {
      expect(result.score).toBe(scoresById.get(result.course.id));
    }
  });
});

describe('Phase 3 checkpoint — deterministic ordering across pagination boundaries', () => {
  it('produces identical ordering for identical inputs, with no duplicates or gaps across pages', () => {
    const runA = heroOrder();
    const runB = heroOrder();
    expect(runA.map((r) => r.course.id)).toEqual(runB.map((r) => r.course.id));

    const ids = runA.map((r) => r.course.id);
    expect(new Set(ids).size).toBe(ids.length);

    const positions = runA.map((r) => r.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
