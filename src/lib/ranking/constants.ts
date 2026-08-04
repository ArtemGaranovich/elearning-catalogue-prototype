/**
 * Every weight and threshold in the model, in one place.
 *
 * CLAUDE.md: weights and thresholds are configuration objects, never inline
 * literals. If a number in here changes, the dataset generator's demo-integrity
 * assertions (docs/02-dataset-spec.md §5) are what catch the demo going stale.
 */

import type {
  DurationBucket,
  FactorKey,
  FilterState,
  Level,
  Language,
  MinRatingOption,
  RankingToggles,
  SortMode,
  UpdatedWithinMonths,
  WeightPresetName,
  Weights,
} from './types';

/**
 * Frozen "today" (docs/02-dataset-spec.md §1). Used as *now* in every age and
 * decay calculation. Never `Date.now()` — freshness percentiles would drift and
 * the planted cases would stop demonstrating what they were built to
 * demonstrate. ESLint enforces this across `src/lib/`.
 */
export const DATASET_AS_OF = '2026-08-01';

// ---------------------------------------------------------------------------
// Factor parameters
// ---------------------------------------------------------------------------

/** Canonical factor order — drives the inspector's bar segments and legends. */
export const FACTOR_KEYS: readonly FactorKey[] = [
  'quality',
  'outcome',
  'popularity',
  'freshness',
  'fit',
];

export const FACTOR_LABELS: Readonly<Record<FactorKey, string>> = {
  quality: 'Quality',
  outcome: 'Outcome',
  popularity: 'Popularity',
  freshness: 'Freshness',
  fit: 'Fit',
};

/** The plain question each factor answers (docs/01-ranking-algorithm.md §2). */
export const FACTOR_QUESTIONS: Readonly<Record<FactorKey, string>> = {
  quality: 'Is it good?',
  outcome: 'Do people actually finish it?',
  popularity: 'Is there demand for it?',
  freshness: 'Is it still current?',
  fit: 'Does it match what was asked for?',
};

/**
 * `m` in the Bayesian shrinkage formula (docs/01 §3.1): the review count at
 * which a course's own rating and the category prior carry equal weight.
 */
export const SHRINKAGE_M = 50;

/** `τ` in `exp(−ageDays / τ)` (docs/01 §3.4), in days. */
export const FRESHNESS_TAU_DAYS = 540;

/** Outcome sub-weights (docs/01 §3.2). Refund rate is inverted before weighting. */
export const OUTCOME_WEIGHTS = {
  completionRate: 0.5,
  medianWatchPercent: 0.3,
  inverseRefundRate: 0.2,
} as const;

/** Fit sub-weights (docs/01 §3.5). */
export const FIT_WEIGHTS = {
  tagOverlap: 0.5,
  textMatch: 0.3,
  softMatch: 0.2,
} as const;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Below this many courses in the basis, percentiles are too coarse to be
 * informative and the factor is normalised against the global pool instead
 * (docs/01 §4.1). Only Cybersecurity trips this, by design.
 */
export const SMALL_BASIS_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

/**
 * "Highest rated" removes courses below this rating count (docs/01 §6), and the
 * promo quality gate requires it independently (§7.3).
 */
export const MIN_RATING_COUNT = 20;

/** Promo eligibility: content updated within this many months (docs/01 §7.3). */
export const PROMO_MAX_CONTENT_AGE_MONTHS = 24;

// ---------------------------------------------------------------------------
// Diversity — docs/01 §5.2
// ---------------------------------------------------------------------------

export const DIVERSITY_MAX_PER_INSTRUCTOR = 2;

export const DIVERSITY_TOP_N = 10;

// ---------------------------------------------------------------------------
// Promoted placements — docs/01 §7.2
// ---------------------------------------------------------------------------

/**
 * Size of the promoted band lifted above the organic list. Under 20% of a
 * 12-result page by design (§7.2.1) — the number that keeps promotion a
 * supplement to the ranking rather than a replacement for it.
 */
export const PROMO_BAND_MAX = 2;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Weight presets — PRD §5.6
// ---------------------------------------------------------------------------

export const WEIGHT_PRESETS: Readonly<Record<WeightPresetName, Weights>> = {
  balanced: { quality: 0.35, outcome: 0.2, popularity: 0.2, freshness: 0.15, fit: 0.1 },
  'quality-led': { quality: 0.55, outcome: 0.15, popularity: 0.1, freshness: 0.1, fit: 0.1 },
  /**
   * Exists to make one point fast: it puts the 96k-enrolment / 22%-completion
   * course at position 1, which argues for the Outcome factor better than any
   * explanation (PRD §5.6).
   */
  'popularity-led': { quality: 0.15, outcome: 0.1, popularity: 0.5, freshness: 0.15, fit: 0.1 },
  'freshness-led': { quality: 0.25, outcome: 0.15, popularity: 0.1, freshness: 0.4, fit: 0.1 },
};

export const WEIGHT_PRESET_LABELS: Readonly<Record<WeightPresetName, string>> = {
  balanced: 'Balanced',
  'quality-led': 'Quality-led',
  'popularity-led': 'Popularity-led',
  'freshness-led': 'Freshness-led',
};

export const DEFAULT_WEIGHT_PRESET = 'balanced' satisfies WeightPresetName;

export const DEFAULT_WEIGHTS: Weights = WEIGHT_PRESETS[DEFAULT_WEIGHT_PRESET];

/** Slider bounds for the Ranking Lab. */
export const WEIGHT_SLIDER = { min: 0, max: 1, step: 0.05 } as const;

// ---------------------------------------------------------------------------
// Sort modes — docs/01 §6
// ---------------------------------------------------------------------------

export const SORT_MODES: readonly SortMode[] = [
  'recommended',
  'highest-rated',
  'most-popular',
  'newest',
  'price-asc',
  'price-desc',
  'shortest',
];

/**
 * Demo-view labels — technical enough to keep the shrinkage mechanic visible
 * in the sort control itself. User view swaps to `SORT_MODE_LABELS_USER`
 * (PRD §5.7: "Sort labels become user copy"); the seven keys underneath are
 * identical in both.
 */
export const SORT_MODE_LABELS: Readonly<Record<SortMode, string>> = {
  recommended: 'Recommended',
  'highest-rated': 'Highest adjusted rating',
  'most-popular': 'Most popular',
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  shortest: 'Shortest first',
};

/** User-view copy (PRD §5.7) — no mention of "adjusted", which is a ranking-internal term. */
export const SORT_MODE_LABELS_USER: Readonly<Record<SortMode, string>> = {
  recommended: 'Recommended',
  'highest-rated': 'Highest rated',
  'most-popular': 'Most popular',
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  shortest: 'Shortest first',
};

export const DEFAULT_SORT_MODE = 'recommended' satisfies SortMode;

// ---------------------------------------------------------------------------
// Filter option domains
// ---------------------------------------------------------------------------

export const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];

export const LANGUAGES: readonly Language[] = ['en', 'de', 'es', 'pl'];

export const LANGUAGE_LABELS: Readonly<Record<Language, string>> = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  pl: 'Polish',
};

/** Half-open hour ranges; `maxHours: null` means unbounded. */
export const DURATION_BUCKETS: readonly {
  readonly id: DurationBucket;
  readonly label: string;
  readonly minHours: number;
  readonly maxHours: number | null;
}[] = [
  { id: 'lt5', label: 'Under 5 hours', minHours: 0, maxHours: 5 },
  { id: '5to15', label: '5–15 hours', minHours: 5, maxHours: 15 },
  { id: '15to30', label: '15–30 hours', minHours: 15, maxHours: 30 },
  { id: 'gte30', label: '30+ hours', minHours: 30, maxHours: null },
];

/** Applied to the adjusted rating (docs/01 §6); the UI labels it as such. */
export const MIN_RATING_OPTIONS: readonly MinRatingOption[] = [0, 3.5, 4, 4.5];

export const UPDATED_WITHIN_OPTIONS: readonly UpdatedWithinMonths[] = [0, 6, 12, 24];

// ---------------------------------------------------------------------------
// Defaults — PRD §7, criterion 1
// ---------------------------------------------------------------------------

export const DEFAULT_FILTERS: FilterState = {
  subcategoryIds: [],
  minAdjustedRating: 0,
  levels: [],
  durationBuckets: [],
  priceMode: 'any',
  maxPrice: null,
  languages: [],
  certificateOnly: false,
  updatedWithinMonths: 0,
  instructorIds: [],
  query: '',
};

export const DEFAULT_TOGGLES: RankingToggles = {
  shrinkage: true,
  outcomeFactor: true,
  diversityCap: true,
  promoInjection: true,
  promoQualityGate: true,
};
