/**
 * Popularity — demand, compressed. docs/01-ranking-algorithm.md §3.3
 *
 *   Popularity_raw = log10(1 + enrollments)
 *
 * Without compression, popularity swamps every other factor and the ranking
 * degenerates into "most enrolled first", which entrenches incumbents.
 */

import type { Course } from './types';

export interface PopularityOptions {
  readonly course: Course;
}

export function popularityRaw(options: PopularityOptions): number {
  return Math.log10(1 + options.course.enrollments);
}
