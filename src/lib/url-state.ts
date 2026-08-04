/**
 * The URL query string is the single source of truth for the view (PRD §3).
 *
 * Every configuration of filters, sort mode and weights becomes a shareable
 * link, which makes the Loom recording reproducible and lets the reviewer land
 * directly on a specific demonstration. No localStorage anywhere (CLAUDE.md).
 *
 * Round-trip requirement (criterion 13): copying the URL into a fresh tab
 * reproduces the view exactly, including weights and toggles, and browser
 * back/forward walks the configuration history.
 *
 * Validation is per-field, not all-or-nothing: an unknown or malformed value
 * for one key falls back to that key's own default rather than discarding the
 * whole config, so a shared link with one stale parameter still renders the
 * rest of the intended view instead of silently resetting everything.
 */

import { CATEGORIES, HERO_CATEGORY_ID } from '@/data/categories';
import type { CategoryId, SubcategoryId } from '@/data/categories';
import instructorsData from '@/data/instructors.json';

import {
  DEFAULT_FILTERS,
  DEFAULT_SORT_MODE,
  DEFAULT_TOGGLES,
  DEFAULT_WEIGHTS,
  DURATION_BUCKETS,
  FACTOR_KEYS,
  LANGUAGES,
  LEVELS,
  MIN_RATING_OPTIONS,
  SORT_MODES,
  UPDATED_WITHIN_OPTIONS,
  WEIGHT_SLIDER,
} from '@/lib/ranking/constants';
import type {
  DurationBucket,
  FilterState,
  Instructor,
  Language,
  Level,
  MinRatingOption,
  PriceMode,
  RankingToggles,
  SortMode,
  UpdatedWithinMonths,
  Weights,
} from '@/lib/ranking/types';

export interface ViewConfig {
  readonly categoryId: CategoryId;
  readonly filters: FilterState;
  readonly sortMode: SortMode;
  /** Raw slider values, before normalisation to 1. */
  readonly weights: Weights;
  readonly toggles: RankingToggles;
  /** 1-based. */
  readonly page: number;
}

/** The default view — PRD §7, criterion 1. */
export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  categoryId: HERO_CATEGORY_ID,
  filters: DEFAULT_FILTERS,
  sortMode: DEFAULT_SORT_MODE,
  weights: DEFAULT_WEIGHTS,
  toggles: DEFAULT_TOGGLES,
  page: 1,
};

const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);
const SUBCATEGORY_IDS: readonly SubcategoryId[] = CATEGORIES.flatMap((c) =>
  c.subcategories.map((s) => s.id),
);
const INSTRUCTOR_IDS: readonly string[] = (instructorsData as readonly Instructor[]).map(
  (i) => i.id,
);
const PRICE_MODES: readonly PriceMode[] = ['any', 'free', 'paid'];
const DURATION_BUCKET_IDS: readonly DurationBucket[] = DURATION_BUCKETS.map((b) => b.id);
const TOGGLE_KEYS: readonly (keyof RankingToggles)[] = [
  'shrinkage',
  'outcomeFactor',
  'diversityCap',
  'promoInjection',
  'promoQualityGate',
];

// ---------------------------------------------------------------------------
// Parsing helpers — every one falls back to its own default, never throws.
// ---------------------------------------------------------------------------

function parseEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw !== null && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return fallback;
}

function parseEnumList<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: readonly T[],
): readonly T[] {
  if (raw === null || raw === '') {
    return fallback;
  }
  const allowedSet = new Set<string>(allowed);
  const values = [...new Set(raw.split(',').filter((v) => allowedSet.has(v)))] as T[];
  return values.length > 0 ? values : fallback;
}

function parseNumberEnum<T extends number>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  return (allowed as readonly number[]).includes(value) ? (value as T) : fallback;
}

function parseBoolean(raw: string | null, fallback: boolean): boolean {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

function parseNonNegativeFloat(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseWeights(raw: string | null): Weights {
  if (raw === null) {
    return DEFAULT_WEIGHTS;
  }
  const parts = raw.split(',');
  if (parts.length !== FACTOR_KEYS.length) {
    return DEFAULT_WEIGHTS;
  }
  const values = parts.map(Number);
  const valid = values.every(
    (v) => Number.isFinite(v) && v >= WEIGHT_SLIDER.min && v <= WEIGHT_SLIDER.max,
  );
  if (!valid) {
    return DEFAULT_WEIGHTS;
  }
  return Object.fromEntries(FACTOR_KEYS.map((key, i) => [key, values[i]!])) as Weights;
}

function parseToggles(raw: string | null): RankingToggles {
  const off = new Set(raw === null ? [] : raw.split(','));
  return {
    shrinkage: !off.has('shrinkage'),
    outcomeFactor: !off.has('outcomeFactor'),
    diversityCap: !off.has('diversityCap'),
    promoInjection: !off.has('promoInjection'),
    promoQualityGate: !off.has('promoQualityGate'),
  };
}

/**
 * Parses a `location.search` string. Unknown, malformed or out-of-range values
 * fall back to the default rather than throwing — a shared link must never
 * render a broken page.
 */
export function parseViewConfig(search: string): ViewConfig {
  const params = new URLSearchParams(search);

  const filters: FilterState = {
    subcategoryIds: parseEnumList(
      params.get('sub'),
      SUBCATEGORY_IDS,
      DEFAULT_FILTERS.subcategoryIds,
    ),
    minAdjustedRating: parseNumberEnum(
      params.get('rating'),
      MIN_RATING_OPTIONS,
      DEFAULT_FILTERS.minAdjustedRating,
    ) as MinRatingOption,
    levels: parseEnumList(params.get('level'), LEVELS, DEFAULT_FILTERS.levels) as readonly Level[],
    durationBuckets: parseEnumList(
      params.get('duration'),
      DURATION_BUCKET_IDS,
      DEFAULT_FILTERS.durationBuckets,
    ),
    priceMode: parseEnum(params.get('price'), PRICE_MODES, DEFAULT_FILTERS.priceMode),
    maxPrice: parseNonNegativeFloat(params.get('maxPrice')),
    languages: parseEnumList(
      params.get('lang'),
      LANGUAGES,
      DEFAULT_FILTERS.languages,
    ) as readonly Language[],
    certificateOnly: parseBoolean(params.get('cert'), DEFAULT_FILTERS.certificateOnly),
    updatedWithinMonths: parseNumberEnum(
      params.get('updated'),
      UPDATED_WITHIN_OPTIONS,
      DEFAULT_FILTERS.updatedWithinMonths,
    ) as UpdatedWithinMonths,
    instructorIds: parseEnumList(
      params.get('instructor'),
      INSTRUCTOR_IDS,
      DEFAULT_FILTERS.instructorIds,
    ),
    query: params.get('q') ?? DEFAULT_FILTERS.query,
  };

  return {
    categoryId: parseEnum(params.get('cat'), CATEGORY_IDS, DEFAULT_VIEW_CONFIG.categoryId),
    filters,
    sortMode: parseEnum(params.get('sort'), SORT_MODES, DEFAULT_SORT_MODE),
    weights: parseWeights(params.get('w')),
    toggles: parseToggles(params.get('off')),
    page: parsePositiveInt(params.get('page'), DEFAULT_VIEW_CONFIG.page),
  };
}

// ---------------------------------------------------------------------------
// Serialisation — the inverse, omitting anything equal to its default.
// ---------------------------------------------------------------------------

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((v) => bSet.has(v));
}

/**
 * Serialises to a query string, omitting anything equal to its default so the
 * default view has a clean URL and demo links stay readable.
 */
export function serialiseViewConfig(config: ViewConfig): string {
  const params = new URLSearchParams();
  const { filters } = config;

  if (config.categoryId !== DEFAULT_VIEW_CONFIG.categoryId) {
    params.set('cat', config.categoryId);
  }
  if (!sameStringSet(filters.subcategoryIds, DEFAULT_FILTERS.subcategoryIds)) {
    params.set('sub', filters.subcategoryIds.join(','));
  }
  if (filters.minAdjustedRating !== DEFAULT_FILTERS.minAdjustedRating) {
    params.set('rating', String(filters.minAdjustedRating));
  }
  if (!sameStringSet(filters.levels, DEFAULT_FILTERS.levels)) {
    params.set('level', filters.levels.join(','));
  }
  if (!sameStringSet(filters.durationBuckets, DEFAULT_FILTERS.durationBuckets)) {
    params.set('duration', filters.durationBuckets.join(','));
  }
  if (filters.priceMode !== DEFAULT_FILTERS.priceMode) {
    params.set('price', filters.priceMode);
  }
  if (filters.maxPrice !== DEFAULT_FILTERS.maxPrice) {
    params.set('maxPrice', filters.maxPrice === null ? '' : String(filters.maxPrice));
  }
  if (!sameStringSet(filters.languages, DEFAULT_FILTERS.languages)) {
    params.set('lang', filters.languages.join(','));
  }
  if (filters.certificateOnly !== DEFAULT_FILTERS.certificateOnly) {
    params.set('cert', '1');
  }
  if (filters.updatedWithinMonths !== DEFAULT_FILTERS.updatedWithinMonths) {
    params.set('updated', String(filters.updatedWithinMonths));
  }
  if (!sameStringSet(filters.instructorIds, DEFAULT_FILTERS.instructorIds)) {
    params.set('instructor', filters.instructorIds.join(','));
  }
  if (filters.query !== DEFAULT_FILTERS.query) {
    params.set('q', filters.query);
  }
  if (config.sortMode !== DEFAULT_SORT_MODE) {
    params.set('sort', config.sortMode);
  }
  const weightsChanged = FACTOR_KEYS.some(
    (key) => roundTo(config.weights[key], 3) !== roundTo(DEFAULT_WEIGHTS[key], 3),
  );
  if (weightsChanged) {
    params.set('w', FACTOR_KEYS.map((key) => roundTo(config.weights[key], 3)).join(','));
  }
  const off = TOGGLE_KEYS.filter((key) => !config.toggles[key]);
  if (off.length > 0) {
    params.set('off', off.join(','));
  }
  if (config.page !== DEFAULT_VIEW_CONFIG.page) {
    params.set('page', String(config.page));
  }

  const qs = params.toString();
  return qs === '' ? '' : `?${qs}`;
}
