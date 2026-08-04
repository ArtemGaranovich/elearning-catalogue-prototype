/**
 * Fit — does it match what was asked for. docs/01-ranking-algorithm.md §3.5
 *
 *   Fit_raw = 0.5 · tagOverlap(course, selectedSubcategory)
 *           + 0.3 · textMatch(course, searchQuery)
 *           + 0.2 · softMatch(level, duration preferences)
 *
 * The only factor computed per request. With a category selected but nothing
 * more specific, `Fit_raw` is identical for every course, which under the
 * tie-aware normalisation of §4 yields 0.5 for all of them — so the factor
 * contributes a constant and has no effect on ordering. That is what keeps it
 * honest: it contributes only when there is actual intent to match against.
 */

import type { SubcategoryId } from '@/data/categories';

import { DURATION_BUCKETS, FIT_WEIGHTS } from './constants';
import type { Course, DurationBucket, Level } from './types';

function tagOverlap(course: Course, selectedSubcategoryIds: readonly SubcategoryId[]): number {
  // The subcategory filter is the concrete, user-facing form of "does this
  // course's tags overlap with what was asked for" (docs/01 §3.5): a course
  // is either in a selected subcategory or it is not. With nothing selected,
  // every course gets the same value, which is what keeps Fit inert.
  if (selectedSubcategoryIds.length === 0) {
    return 0;
  }
  return selectedSubcategoryIds.includes(course.subcategoryId) ? 1 : 0;
}

function textMatch(course: Course, query: string): number {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') {
    return 0;
  }
  const words = trimmed.split(/\s+/);
  const haystack = [course.title, course.subtitle, ...course.tags].join(' ').toLowerCase();
  const matched = words.filter((word) => haystack.includes(word)).length;
  return matched / words.length;
}

export function durationBucketOf(durationHours: number): DurationBucket {
  const bucket = DURATION_BUCKETS.find(
    (candidate) =>
      durationHours >= candidate.minHours &&
      (candidate.maxHours === null || durationHours < candidate.maxHours),
  );
  // DURATION_BUCKETS covers [0, ∞) with no gaps, so this cannot happen.
  if (bucket === undefined) {
    throw new Error(`no duration bucket covers ${durationHours} hours`);
  }
  return bucket.id;
}

function softMatch(
  course: Course,
  selectedLevels: readonly Level[],
  selectedDurationBuckets: readonly DurationBucket[],
): number {
  const levelScore = selectedLevels.length === 0 ? 1 : selectedLevels.includes(course.level) ? 1 : 0;
  const durationScore =
    selectedDurationBuckets.length === 0
      ? 1
      : selectedDurationBuckets.includes(durationBucketOf(course.durationHours))
        ? 1
        : 0;
  return (levelScore + durationScore) / 2;
}

export interface FitOptions {
  readonly course: Course;
  /** Free-text search query; empty string when the user has not searched. */
  readonly query: string;
  readonly selectedSubcategoryIds: readonly SubcategoryId[];
  readonly selectedLevels: readonly Level[];
  readonly selectedDurationBuckets: readonly DurationBucket[];
}

export function fitRaw(options: FitOptions): number {
  const { course, query, selectedSubcategoryIds, selectedLevels, selectedDurationBuckets } =
    options;
  return (
    FIT_WEIGHTS.tagOverlap * tagOverlap(course, selectedSubcategoryIds) +
    FIT_WEIGHTS.textMatch * textMatch(course, query) +
    FIT_WEIGHTS.softMatch * softMatch(course, selectedLevels, selectedDurationBuckets)
  );
}
