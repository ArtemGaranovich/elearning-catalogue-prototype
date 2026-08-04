/**
 * The ranking pipeline. docs/01-ranking-algorithm.md §5
 *
 *   1. CANDIDATES   all courses in the selected category
 *   2. GATES        remove policy-flagged courses; in "Highest rated" mode
 *                   also remove ratingCount < 20
 *   3. SCORE        normalise each factor over the gated category (§4.1),
 *                   apply weights
 *   4. HARD FILTERS remove courses failing any user filter
 *   5. ORDER        by the active sort key, then tie-breakers
 *   6. DIVERSITY    max 2 courses per instructor in the top 10
 *   7. PROMO        Recommended mode only: inject eligible promoted courses
 *   8. PAGINATE     12 per page
 *
 * Two details are load-bearing:
 *
 * - The order is **gates → score → filters**, not gates → filters → score.
 *   Percentiles are computed over the whole gated category so that a course's
 *   score does not change when the user ticks a checkbox (§4.1). Getting this
 *   backwards makes the Score Inspector incoherent.
 * - Diversity runs **before** promo injection, so the instructor cap cannot be
 *   used to displace a paid placement.
 *
 * The score is computed in every sort mode, not only in Recommended: the sort
 * mode decides the ordering key, not whether the score exists.
 */

import type { CategoryId } from '@/data/categories';
import { CATEGORIES } from '@/data/categories';

import { FACTOR_KEYS, PAGE_SIZE } from './constants';
import { applyDiversityCap } from './diversity';
import { applyFilters } from './filters';
import { fitRaw } from './fit';
import { freshnessRaw } from './freshness';
import { applyGates, applyPolicyGate } from './gates';
import { midrankPercentiles, resolveNormalisationBasis } from './normalise';
import { outcomeRaw } from './outcome';
import { popularityRaw } from './popularity';
import { injectPromos } from './promo';
import { adjustedRating, categoryPrior } from './quality';
import { composeScore, normaliseWeights } from './score';
import type {
  Course,
  FactorKey,
  FilterState,
  GateRejection,
  NormalisationBasis,
  PipelineResult,
  RankedCourse,
  RankingToggles,
  ScoredCourse,
  SortMode,
  TieBreaker,
  Weights,
} from './types';

export interface RankOptions {
  /** The whole catalogue. Stage 1 selects the category from it. */
  readonly courses: readonly Course[];
  readonly categoryId: CategoryId;
  readonly filters: FilterState;
  readonly sortMode: SortMode;
  /** Raw slider values from the Ranking Lab. */
  readonly weights: Weights;
  readonly toggles: RankingToggles;
  /** 1-based. */
  readonly page: number;
  /** DATASET_AS_OF. Never the current clock (CLAUDE.md). */
  readonly asOfIsoDate: string;
  /**
   * Overrides `PAGE_SIZE`; `null` disables pagination entirely — every gated,
   * filtered, ordered, diversified and promoted result is returned on one
   * page (PRD §5.8, "Show all"). Purely a presentation concern: it changes
   * how much of the already-final order is returned, never the order itself,
   * gating, scoring or promo eligibility. Defaults to `PAGE_SIZE`.
   */
  readonly pageSize?: number | null;
}

/**
 * Filters are still needed here even though hard-filtering is stage 4: Fit
 * (§3.5) is computed per request from the user's subcategory/level/duration
 * selections and search query, which is the same `FilterState` object. Only
 * `page` is genuinely irrelevant before pagination.
 */
export type ScoreCategoryOptions = Omit<RankOptions, 'page'>;

export interface ScoreCategoryResult {
  /** Stage 3 output: every gated candidate, scored, before user filters. */
  readonly scored: readonly ScoredCourse[];
  readonly candidateCount: number;
  readonly hiddenByGate: readonly GateRejection[];
  readonly normalisationBasis: NormalisationBasis;
  readonly basisSize: number;
  readonly maxAttainableScore: number;
  readonly categoryMeanRawRating: number;
}

// ---------------------------------------------------------------------------
// A stable hash of a course id, for the final tie-breaker (docs/01 §5.1).
// ---------------------------------------------------------------------------

function hashId(id: string): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// Per-category shrinkage priors — computed once over the whole catalogue so a
// course borrowed into another category's normalisation basis (the small-
// category fallback, §4.1) still carries the R_adj it has in its own category.
// ---------------------------------------------------------------------------

function computeCategoryPriors(courses: readonly Course[]): ReadonlyMap<CategoryId, number> {
  const priors = new Map<CategoryId, number>();
  for (const category of CATEGORIES) {
    const inCategory = courses.filter((c) => c.categoryId === category.id);
    const policyGated = applyPolicyGate({ courses: inCategory });
    priors.set(category.id, categoryPrior({ policyGatedCategoryCourses: policyGated }));
  }
  return priors;
}

function computeRaws(
  course: Course,
  priors: ReadonlyMap<CategoryId, number>,
  filters: FilterState,
  shrinkage: boolean,
  asOfIsoDate: string,
): Readonly<Record<FactorKey, number>> {
  const prior = priors.get(course.categoryId);
  if (prior === undefined) {
    throw new Error(`no shrinkage prior computed for category ${course.categoryId}`);
  }
  return {
    quality: adjustedRating({ course, categoryPrior: prior, shrinkage }),
    outcome: outcomeRaw({ course }),
    popularity: popularityRaw({ course }),
    freshness: freshnessRaw({ course, asOfIsoDate }),
    fit: fitRaw({
      course,
      query: filters.query,
      selectedSubcategoryIds: filters.subcategoryIds,
      selectedLevels: filters.levels,
      selectedDurationBuckets: filters.durationBuckets,
    }),
  };
}

// ---------------------------------------------------------------------------
// Stage 5 — order: sort key, then the deterministic tie-breaker chain.
// ---------------------------------------------------------------------------

function compareBySortMode(a: ScoredCourse, b: ScoredCourse, sortMode: SortMode): number {
  switch (sortMode) {
    case 'recommended':
      return b.score - a.score;
    case 'highest-rated':
      return b.adjustedRating - a.adjustedRating;
    case 'most-popular':
      return b.course.enrollments - a.course.enrollments;
    case 'newest':
      return b.course.lastContentUpdateAt.localeCompare(a.course.lastContentUpdateAt);
    case 'price-asc':
      return a.course.price - b.course.price;
    case 'price-desc':
      return b.course.price - a.course.price;
    case 'shortest':
      return a.course.durationHours - b.course.durationHours;
  }
}

interface TieLevel {
  readonly breaker: TieBreaker;
  readonly compare: number;
}

function tieBreakLevels(a: ScoredCourse, b: ScoredCourse): readonly TieLevel[] {
  return [
    { breaker: 'adjusted-rating', compare: b.adjustedRating - a.adjustedRating },
    { breaker: 'rating-count', compare: b.course.ratingCount - a.course.ratingCount },
    {
      breaker: 'last-content-update',
      compare: b.course.lastContentUpdateAt.localeCompare(a.course.lastContentUpdateAt),
    },
    { breaker: 'id-hash', compare: hashId(a.course.id) - hashId(b.course.id) },
  ];
}

function fullCompare(a: ScoredCourse, b: ScoredCourse, sortMode: SortMode): number {
  const primary = compareBySortMode(a, b, sortMode);
  if (primary !== 0) {
    return primary;
  }
  for (const level of tieBreakLevels(a, b)) {
    if (level.compare !== 0) {
      return level.compare;
    }
  }
  return 0;
}

function orderResults(
  filtered: readonly ScoredCourse[],
  sortMode: SortMode,
): readonly RankedCourse[] {
  const ordered = [...filtered].sort((a, b) => fullCompare(a, b, sortMode));

  return ordered.map((sc, index) => {
    let tieBreaker: TieBreaker = 'none';
    const previous = ordered[index - 1];
    if (previous !== undefined && compareBySortMode(previous, sc, sortMode) === 0) {
      const level = tieBreakLevels(previous, sc).find((candidate) => candidate.compare !== 0);
      tieBreaker = level?.breaker ?? 'none';
    }
    return {
      ...sc,
      position: index + 1,
      organicRank: index + 1,
      tieBreaker,
      promo: null,
      isPromotedPlacement: false,
      demotedByDiversityCap: false,
    };
  });
}

/**
 * Stages 1–3: candidates → gates → score. Returns every gated candidate,
 * scored, before user filters run — exactly the basis the Score Inspector
 * describes (§4.1) and exactly what the filter sidebar needs to compute live
 * option counts (PRD §5.2) without re-deriving the scoring logic itself.
 */
export function scoreCategory(options: ScoreCategoryOptions): ScoreCategoryResult {
  const { courses, categoryId, filters, sortMode, weights, toggles, asOfIsoDate } = options;

  // 1. CANDIDATES
  const candidates = courses.filter((c) => c.categoryId === categoryId);

  // 2. GATES
  const { passed: categoryGated, rejected: hiddenByGate } = applyGates({
    courses: candidates,
    sortMode,
  });
  const globalGated = applyGates({ courses, sortMode }).passed;

  const priors = computeCategoryPriors(courses);
  const categoryMeanRawRating = priors.get(categoryId);
  if (categoryMeanRawRating === undefined) {
    throw new Error(`unknown category id: ${categoryId}`);
  }

  // 3. SCORE — percentiles over the resolved basis (§4.1), before user filters.
  const basisResolution = resolveNormalisationBasis({
    gatedCategoryCourses: categoryGated,
    gatedGlobalCourses: globalGated,
  });

  const rawsByCourseId = new Map<string, Readonly<Record<FactorKey, number>>>();
  for (const course of basisResolution.courses) {
    rawsByCourseId.set(
      course.id,
      computeRaws(course, priors, filters, toggles.shrinkage, asOfIsoDate),
    );
  }

  const percentilesByCourseId = new Map<string, Readonly<Record<FactorKey, number>>>();
  for (const factor of FACTOR_KEYS) {
    const values = basisResolution.courses.map((c) => rawsByCourseId.get(c.id)![factor]);
    const percentiles = midrankPercentiles({ values });
    basisResolution.courses.forEach((c, i) => {
      const existing = percentilesByCourseId.get(c.id) ?? ({} as Record<FactorKey, number>);
      percentilesByCourseId.set(c.id, { ...existing, [factor]: percentiles[i]! });
    });
  }

  const disabledFactors: readonly FactorKey[] = toggles.outcomeFactor ? [] : ['outcome'];

  const scored: ScoredCourse[] = categoryGated.map((course) => {
    const raws = rawsByCourseId.get(course.id)!;
    const percentiles = percentilesByCourseId.get(course.id)!;
    const explanation = composeScore({
      raws,
      percentiles,
      weights,
      disabledFactors,
      normalisationBasis: basisResolution.basis,
      basisSize: basisResolution.size,
    });
    return {
      course,
      adjustedRating: raws.quality,
      score: explanation.score,
      explanation,
    };
  });

  const maxAttainableScore = normaliseWeights({ weights, disabledFactors }).maxAttainableScore;

  return {
    scored,
    candidateCount: categoryGated.length,
    hiddenByGate,
    normalisationBasis: basisResolution.basis,
    basisSize: basisResolution.size,
    maxAttainableScore,
    categoryMeanRawRating,
  };
}

/**
 * Returns the ordered page *and* the explanation for each result: every
 * factor's raw value, percentile, weight and contribution; the tie-breaker
 * used; promo band position and organic rank; which gate a course failed. The UI renders
 * this — it never recomputes it (CLAUDE.md).
 *
 * Deterministic: identical inputs always yield an identical list, including
 * pagination boundaries. The final tie-breaker is a stable hash of the course id
 * precisely so that courses cannot swap places between paginated reads (§5.1).
 */
export function rank(options: RankOptions): PipelineResult {
  const { filters, sortMode, toggles, page, asOfIsoDate } = options;

  const {
    scored,
    candidateCount,
    hiddenByGate,
    normalisationBasis,
    basisSize,
    maxAttainableScore,
    categoryMeanRawRating,
  } = scoreCategory(options);

  // 4. HARD FILTERS
  const filtered = applyFilters({ scored, filters, asOfIsoDate });

  // 5. ORDER
  const ordered = orderResults(filtered, sortMode);

  // 6. DIVERSITY
  const diversified = applyDiversityCap({ ranked: ordered, enabled: toggles.diversityCap });

  // 7. PROMO
  const { results: promoted, rejected: promoRejected } = injectPromos({
    organic: diversified,
    sortMode,
    promoInjectionEnabled: toggles.promoInjection,
    qualityGateEnabled: toggles.promoQualityGate,
    categoryMeanRawRating,
    asOfIsoDate,
  });

  // 8. PAGINATE
  const totalResults = promoted.length;
  const noPagination = options.pageSize === null;
  const pageSize = noPagination ? totalResults : (options.pageSize ?? PAGE_SIZE);
  const pageCount = noPagination ? 1 : Math.max(1, Math.ceil(totalResults / pageSize));
  const start = noPagination ? 0 : (page - 1) * pageSize;
  const results = noPagination ? promoted : promoted.slice(start, start + pageSize);

  return {
    results,
    meta: {
      candidateCount,
      hiddenByGate,
      promoRejected,
      normalisationBasis,
      basisSize,
      maxAttainableScore,
      categoryMeanRawRating,
      totalResults,
      page,
      pageCount,
    },
  };
}
