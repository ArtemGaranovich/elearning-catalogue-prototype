/**
 * Hard filters — stage 4 of the pipeline. docs/01-ranking-algorithm.md §5, §6
 *
 * Filters are not a scoring factor. They remove courses from the result set;
 * they do not change any course's score.
 *
 * `AND` across filter types, `OR` within a multi-select.
 *
 * Because scoring precedes filtering, the minimum-rating filter operates on the
 * **adjusted** rating — which is the whole point of running the stages in this
 * order. Filtering on the raw value would reintroduce exactly the problem
 * shrinkage exists to solve.
 */

import {
  DURATION_BUCKETS,
  LANGUAGES,
  LEVELS,
  MIN_RATING_OPTIONS,
  UPDATED_WITHIN_OPTIONS,
} from './constants';
import { ageDays } from './freshness';
import { durationBucketOf } from './fit';
import type { FilterState, ScoredCourse } from './types';

export interface ApplyFiltersOptions {
  /** Stage 3 output — scored, so `adjustedRating` is available. */
  readonly scored: readonly ScoredCourse[];
  readonly filters: FilterState;
  /** DATASET_AS_OF. Never the current clock (CLAUDE.md). */
  readonly asOfIsoDate: string;
}

const AVG_DAYS_PER_MONTH = 30.4368;

function passesFilters(sc: ScoredCourse, filters: FilterState, asOfIsoDate: string): boolean {
  const { course } = sc;

  if (
    filters.subcategoryIds.length > 0 &&
    !filters.subcategoryIds.includes(course.subcategoryId)
  ) {
    return false;
  }
  if (filters.minAdjustedRating > 0 && sc.adjustedRating < filters.minAdjustedRating) {
    return false;
  }
  if (filters.levels.length > 0 && !filters.levels.includes(course.level)) {
    return false;
  }
  if (
    filters.durationBuckets.length > 0 &&
    !filters.durationBuckets.includes(durationBucketOf(course.durationHours))
  ) {
    return false;
  }
  if (filters.priceMode === 'free' && course.price !== 0) {
    return false;
  }
  if (filters.priceMode === 'paid' && course.price === 0) {
    return false;
  }
  if (filters.maxPrice !== null && course.price > filters.maxPrice) {
    return false;
  }
  if (filters.languages.length > 0 && !filters.languages.includes(course.language)) {
    return false;
  }
  if (filters.certificateOnly && !course.hasCertificate) {
    return false;
  }
  if (filters.updatedWithinMonths > 0) {
    const months =
      ageDays({ fromIsoDate: course.lastContentUpdateAt, asOfIsoDate }) / AVG_DAYS_PER_MONTH;
    if (months > filters.updatedWithinMonths) {
      return false;
    }
  }
  if (filters.instructorIds.length > 0 && !filters.instructorIds.includes(course.instructorId)) {
    return false;
  }
  const query = filters.query.trim().toLowerCase();
  if (query !== '') {
    const haystack = [course.title, course.subtitle, ...course.tags].join(' ').toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }

  return true;
}

export function applyFilters(options: ApplyFiltersOptions): readonly ScoredCourse[] {
  const { scored, filters, asOfIsoDate } = options;
  return scored.filter((sc) => passesFilters(sc, filters, asOfIsoDate));
}

export type FilterFacet =
  | 'subcategory'
  | 'minAdjustedRating'
  | 'level'
  | 'duration'
  | 'price'
  | 'language'
  | 'certificate'
  | 'updatedWithin'
  | 'instructor';

export interface FilterOptionCount {
  /** Serialised option value, e.g. `'beginner'`, `'4.5'`, `'i-07'`. */
  readonly value: string;
  /** Results this option would produce, against the *other* active filters. */
  readonly count: number;
  /**
   * True when `count` is 0. Zero-yield options are shown disabled rather than
   * hidden, so the user can see the boundary of the catalogue instead of
   * wondering where an option went (PRD §5.2).
   */
  readonly disabled: boolean;
}

export type FilterCounts = Readonly<Record<FilterFacet, readonly FilterOptionCount[]>>;

/**
 * Live counts for every sidebar option, each computed with its own facet
 * excluded from the filter set so ticking a second box in the same facet widens
 * rather than narrows (PRD §5.2).
 */
function countFor(
  scored: readonly ScoredCourse[],
  filters: FilterState,
  asOfIsoDate: string,
  override: Partial<FilterState>,
): number {
  return applyFilters({ scored, filters: { ...filters, ...override }, asOfIsoDate }).length;
}

function optionCounts(
  values: readonly { readonly value: string; readonly override: Partial<FilterState> }[],
  scored: readonly ScoredCourse[],
  filters: FilterState,
  asOfIsoDate: string,
): readonly FilterOptionCount[] {
  return values.map(({ value, override }) => {
    const count = countFor(scored, filters, asOfIsoDate, override);
    return { value, count, disabled: count === 0 };
  });
}

export function filterOptionCounts(options: ApplyFiltersOptions): FilterCounts {
  const { scored, filters, asOfIsoDate } = options;

  const subcategoryIds = [...new Set(scored.map((sc) => sc.course.subcategoryId))];
  const instructorIds = [...new Set(scored.map((sc) => sc.course.instructorId))];

  return {
    subcategory: optionCounts(
      subcategoryIds.map((id) => ({ value: id, override: { subcategoryIds: [id] } })),
      scored,
      filters,
      asOfIsoDate,
    ),
    minAdjustedRating: optionCounts(
      MIN_RATING_OPTIONS.map((option) => ({
        value: String(option),
        override: { minAdjustedRating: option },
      })),
      scored,
      filters,
      asOfIsoDate,
    ),
    level: optionCounts(
      LEVELS.map((level) => ({ value: level, override: { levels: [level] } })),
      scored,
      filters,
      asOfIsoDate,
    ),
    duration: optionCounts(
      DURATION_BUCKETS.map((bucket) => ({
        value: bucket.id,
        override: { durationBuckets: [bucket.id] },
      })),
      scored,
      filters,
      asOfIsoDate,
    ),
    price: optionCounts(
      (['any', 'free', 'paid'] as const).map((mode) => ({
        value: mode,
        override: { priceMode: mode },
      })),
      scored,
      filters,
      asOfIsoDate,
    ),
    language: optionCounts(
      LANGUAGES.map((language) => ({ value: language, override: { languages: [language] } })),
      scored,
      filters,
      asOfIsoDate,
    ),
    certificate: optionCounts(
      [{ value: 'true', override: { certificateOnly: true } }],
      scored,
      filters,
      asOfIsoDate,
    ),
    updatedWithin: optionCounts(
      UPDATED_WITHIN_OPTIONS.map((option) => ({
        value: String(option),
        override: { updatedWithinMonths: option },
      })),
      scored,
      filters,
      asOfIsoDate,
    ),
    instructor: optionCounts(
      instructorIds.map((id) => ({ value: id, override: { instructorIds: [id] } })),
      scored,
      filters,
      asOfIsoDate,
    ),
  };
}

export interface FilterRelaxation {
  readonly facet: FilterFacet;
  /** e.g. 'Remove the 4.5+ rating filter'. */
  readonly label: string;
  /** How many results removing it would yield. */
  readonly resultCount: number;
  /** The filter patch that achieves `resultCount` when applied. */
  readonly reset: Partial<FilterState>;
}

/**
 * Powers the designed empty state (PRD §5.2): it names which filter is
 * responsible and offers a one-click relaxation, rather than showing a blank
 * panel. Ordered most-effective first.
 */
export function suggestRelaxations(options: ApplyFiltersOptions): readonly FilterRelaxation[] {
  const { scored, filters, asOfIsoDate } = options;

  const candidates: { facet: FilterFacet; label: string; reset: Partial<FilterState> }[] = [];

  if (filters.subcategoryIds.length > 0) {
    candidates.push({
      facet: 'subcategory',
      label: 'Remove the subcategory filter',
      reset: { subcategoryIds: [] },
    });
  }
  if (filters.minAdjustedRating > 0) {
    candidates.push({
      facet: 'minAdjustedRating',
      label: `Remove the ${filters.minAdjustedRating}+ rating filter`,
      reset: { minAdjustedRating: 0 },
    });
  }
  if (filters.levels.length > 0) {
    candidates.push({ facet: 'level', label: 'Remove the level filter', reset: { levels: [] } });
  }
  if (filters.durationBuckets.length > 0) {
    candidates.push({
      facet: 'duration',
      label: 'Remove the duration filter',
      reset: { durationBuckets: [] },
    });
  }
  if (filters.priceMode !== 'any' || filters.maxPrice !== null) {
    candidates.push({
      facet: 'price',
      label: 'Remove the price filter',
      reset: { priceMode: 'any', maxPrice: null },
    });
  }
  if (filters.languages.length > 0) {
    candidates.push({
      facet: 'language',
      label: 'Remove the language filter',
      reset: { languages: [] },
    });
  }
  if (filters.certificateOnly) {
    candidates.push({
      facet: 'certificate',
      label: 'Remove the certificate filter',
      reset: { certificateOnly: false },
    });
  }
  if (filters.updatedWithinMonths > 0) {
    candidates.push({
      facet: 'updatedWithin',
      label: `Remove the "updated within ${filters.updatedWithinMonths} months" filter`,
      reset: { updatedWithinMonths: 0 },
    });
  }
  if (filters.instructorIds.length > 0) {
    candidates.push({
      facet: 'instructor',
      label: 'Remove the instructor filter',
      reset: { instructorIds: [] },
    });
  }

  return candidates
    .map(({ facet, label, reset }) => ({
      facet,
      label,
      resultCount: countFor(scored, filters, asOfIsoDate, reset),
      reset,
    }))
    .sort((a, b) => b.resultCount - a.resultCount);
}
