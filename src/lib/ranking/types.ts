/**
 * Shared types for the ranking engine.
 *
 * Two groups live here: the dataset schema (docs/02-dataset-spec.md §3) and the
 * explanation objects that `pipeline.ts` returns. The explanation types matter
 * as much as the schema — CLAUDE.md requires that the UI *renders* the numbers
 * and never recomputes them, so anything the Score Inspector shows has to be
 * expressible here.
 *
 * Per-module input types (`*Options`) live in their own modules.
 */

import type { CategoryId, SubcategoryId } from '@/data/categories';

// ---------------------------------------------------------------------------
// Dataset schema — docs/02-dataset-spec.md §3
// ---------------------------------------------------------------------------

export type Level = 'beginner' | 'intermediate' | 'advanced';

export type Language = 'en' | 'de' | 'es' | 'pl';

export type PromoType = 'sponsored' | 'featured';

export type PolicyFlag = 'under-review';

/** 1★ → 5★ counts. Sums to `ratingCount` and reproduces `ratingAvg` within 0.05. */
export type RatingDistribution = readonly [number, number, number, number, number];

export interface Promo {
  readonly type: PromoType;
  /** 0..1, orders courses within a promo pool. */
  readonly priority: number;
  readonly predictedCtr: number;
}

export interface Course {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly categoryId: CategoryId;
  readonly subcategoryId: SubcategoryId;
  readonly tags: readonly string[];
  readonly instructorId: string;

  readonly level: Level;
  readonly language: Language;
  readonly durationHours: number;
  readonly lessonsCount: number;
  readonly hasCertificate: boolean;

  /** USD; 0 = free. */
  readonly price: number;
  /** null when not discounted. */
  readonly originalPrice: number | null;

  /** ISO date, `YYYY-MM-DD`. */
  readonly publishedAt: string;
  /** ISO date, `YYYY-MM-DD`. Always >= `publishedAt`. Content, not cosmetic, edits. */
  readonly lastContentUpdateAt: string;

  readonly ratingAvg: number;
  /**
   * Plain integer count. The recency weighting of
   * docs/01-ranking-algorithm.md §3.1 is *not* applied — per-rating timestamps
   * are not in this dataset, and the limitations note says so.
   */
  readonly ratingCount: number;
  readonly ratingDistribution: RatingDistribution;

  readonly enrollments: number;
  /** Unused in v1; kept for the Trending extension (docs/01 §9). */
  readonly enrollments30d: number;

  readonly completionRate: number;
  readonly medianWatchPercent: number;
  readonly refundRate: number;

  /** Non-null on exactly 4 courses (docs/02 §3). */
  readonly promo: Promo | null;

  readonly policyFlags: readonly PolicyFlag[];
}

export interface Instructor {
  readonly id: string;
  readonly name: string;
  readonly headline: string;
  readonly coursesCount: number;
  /** Used for cold-start seeding (docs/01 §9); not part of v1 scoring. */
  readonly historicalRatingAvg: number;
}

// ---------------------------------------------------------------------------
// Factors and weights — docs/01-ranking-algorithm.md §2
// ---------------------------------------------------------------------------

export type FactorKey = 'quality' | 'outcome' | 'popularity' | 'freshness' | 'fit';

export type Weights = Readonly<Record<FactorKey, number>>;

export type WeightPresetName = 'balanced' | 'quality-led' | 'popularity-led' | 'freshness-led';

// ---------------------------------------------------------------------------
// Query configuration
// ---------------------------------------------------------------------------

export type SortMode =
  | 'recommended'
  | 'highest-rated'
  | 'most-popular'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'shortest';

export type DurationBucket = 'lt5' | '5to15' | '15to30' | 'gte30';

export type PriceMode = 'any' | 'free' | 'paid';

/** Applied to the *adjusted* rating (docs/01 §6), and labelled as such in the UI. */
export type MinRatingOption = 0 | 3.5 | 4 | 4.5;

export type UpdatedWithinMonths = 0 | 6 | 12 | 24;

export interface FilterState {
  readonly subcategoryIds: readonly SubcategoryId[];
  readonly minAdjustedRating: MinRatingOption;
  readonly levels: readonly Level[];
  readonly durationBuckets: readonly DurationBucket[];
  readonly priceMode: PriceMode;
  readonly maxPrice: number | null;
  readonly languages: readonly Language[];
  readonly certificateOnly: boolean;
  readonly updatedWithinMonths: UpdatedWithinMonths;
  readonly instructorIds: readonly string[];
  /** Free-text search. Feeds the Fit factor as well as removing non-matches. */
  readonly query: string;
}

/**
 * The five protections the Ranking Lab can switch off (PRD §5.6). Each one is
 * there so the reviewer can see what it costs when it is gone.
 */
export interface RankingToggles {
  readonly shrinkage: boolean;
  readonly outcomeFactor: boolean;
  readonly diversityCap: boolean;
  readonly promoInjection: boolean;
  readonly promoQualityGate: boolean;
}

// ---------------------------------------------------------------------------
// Normalisation — docs/01-ranking-algorithm.md §4.1
// ---------------------------------------------------------------------------

export type NormalisationBasis = 'category' | 'global';

// ---------------------------------------------------------------------------
// Explanation objects — what the Score Inspector renders
// ---------------------------------------------------------------------------

export interface FactorExplanation {
  readonly factor: FactorKey;
  /** The factor in its own units, before normalisation. */
  readonly raw: number;
  /** Midrank percentile within the normalisation basis, 0..1. */
  readonly percentile: number;
  /** The normalised weight actually applied. 0 when the factor is switched off. */
  readonly weight: number;
  /** `weight × percentile` — the points this factor put into the score. */
  readonly contribution: number;
  readonly enabled: boolean;
}

export interface ScoreExplanation {
  readonly score: number;
  /**
   * Sum of the applied weights. Below 1 when a factor is disabled, because a
   * disabled factor's weight is dropped rather than redistributed (PRD §5.6).
   */
  readonly maxAttainableScore: number;
  /** Always five entries, in `FactorKey` order, including disabled factors. */
  readonly factors: readonly FactorExplanation[];
  /** Slider values as set by the user, before normalisation to 1. */
  readonly rawWeights: Weights;
  readonly normalisedWeights: Weights;
  readonly normalisationBasis: NormalisationBasis;
  readonly basisSize: number;
}

/** Tie-breakers, in the order they are applied (docs/01 §5.1). */
export type TieBreaker =
  'none' | 'adjusted-rating' | 'rating-count' | 'last-content-update' | 'id-hash';

export type PromoGateConditionId =
  | 'adjusted-rating-vs-category-mean'
  | 'rating-count'
  | 'no-policy-flags'
  | 'updated-within-24-months';

export interface PromoGateCondition {
  readonly id: PromoGateConditionId;
  readonly label: string;
  readonly passed: boolean;
  /** Rendered value, e.g. `'3.97'`. Both numbers appear in the rejection line. */
  readonly actual: string;
  readonly threshold: string;
}

export interface PromoGateResult {
  readonly passed: boolean;
  /** All four conditions, always — the inspector ticks them off (PRD §5.5). */
  readonly conditions: readonly PromoGateCondition[];
  /**
   * The single most important string in the prototype (PRD §5.5), e.g.
   * "Promotion not applied — adjusted rating 3.97 is below the category mean of 4.31."
   * null when the gate passed.
   */
  readonly failureMessage: string | null;
}

export interface PromoExplanation {
  readonly type: PromoType;
  /** Whether the course actually took a reserved slot. */
  readonly injected: boolean;
  /** 1-based reserved slot, or null when not injected. */
  readonly slot: number | null;
  /** Where the course would have landed on merit — the "would rank #N" line. */
  readonly organicRank: number;
  readonly gate: PromoGateResult;
}

export interface ScoredCourse {
  readonly course: Course;
  /** `R_adj` (docs/01 §3.1). Equal to `ratingAvg` when shrinkage is switched off. */
  readonly adjustedRating: number;
  readonly score: number;
  readonly explanation: ScoreExplanation;
}

export interface RankedCourse extends ScoredCourse {
  /** 1-based, after promo injection — the number shown on the card. */
  readonly position: number;
  /** 1-based, before promo injection. */
  readonly organicRank: number;
  readonly tieBreaker: TieBreaker;
  /** Non-null only for courses carrying a `promo` object. */
  readonly promo: PromoExplanation | null;
  /** True when this course is occupying a reserved promo slot. */
  readonly isPromotedPlacement: boolean;
  /** True when the diversity cap pushed it below position 10 (docs/01 §5.2). */
  readonly demotedByDiversityCap: boolean;
}

// ---------------------------------------------------------------------------
// Gates — docs/01-ranking-algorithm.md §5, stage 2
// ---------------------------------------------------------------------------

export type GateId = 'policy-flag' | 'min-rating-count';

export interface GateRejection {
  readonly course: Course;
  readonly gate: GateId;
  /** Stated reason, e.g. 'Under review'. The UI shows this, not a bare count. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Pipeline output
// ---------------------------------------------------------------------------

export interface PipelineMeta {
  /** How many courses survived gating in this category. Not `basisSize`. */
  readonly candidateCount: number;
  /**
   * The courses gating removed. An array rather than a count because criterion 4
   * requires the "N hidden" note to reveal *which* courses when clicked.
   */
  readonly hiddenByGate: readonly GateRejection[];
  /** Promoted courses refused a slot by the quality gate (docs/01 §7.3). */
  readonly promoRejected: readonly RankedCourse[];
  readonly normalisationBasis: NormalisationBasis;
  /**
   * How many courses the percentiles were computed over. Equal to
   * `candidateCount` normally, equal to the global pool size when
   * `normalisationBasis` is 'global'.
   */
  readonly basisSize: number;
  readonly maxAttainableScore: number;
  /** `C` in the shrinkage formula: category mean raw rating after the policy gate. */
  readonly categoryMeanRawRating: number;
  /** Results after filters, before pagination. */
  readonly totalResults: number;
  readonly page: number;
  readonly pageCount: number;
}

export interface PipelineResult {
  /** The current page, in final order. */
  readonly results: readonly RankedCourse[];
  readonly meta: PipelineMeta;
}
