/**
 * Freshness — is it still current. docs/01-ranking-algorithm.md §3.4
 *
 *   Freshness_raw = exp(−ageDays / τ),  τ = 540 days
 *
 * `ageDays` is measured from the last **content** update, never from
 * publication and never from cosmetic edits, otherwise the signal is trivially
 * farmed by re-uploading a thumbnail.
 *
 * Uses DATASET_AS_OF, never the current clock (CLAUDE.md; ESLint enforces it).
 */

import { FRESHNESS_TAU_DAYS } from './constants';
import type { Course } from './types';

const MS_PER_DAY = 86_400_000;

export interface AgeDaysOptions {
  /** ISO `YYYY-MM-DD`. */
  readonly fromIsoDate: string;
  /** ISO `YYYY-MM-DD`. DATASET_AS_OF in every caller. */
  readonly asOfIsoDate: string;
}

export function ageDays(options: AgeDaysOptions): number {
  const from = Date.parse(`${options.fromIsoDate}T00:00:00Z`);
  const asOf = Date.parse(`${options.asOfIsoDate}T00:00:00Z`);
  return (asOf - from) / MS_PER_DAY;
}

export interface FreshnessOptions {
  readonly course: Course;
  readonly asOfIsoDate: string;
}

export function freshnessRaw(options: FreshnessOptions): number {
  const days = ageDays({
    fromIsoDate: options.course.lastContentUpdateAt,
    asOfIsoDate: options.asOfIsoDate,
  });
  return Math.exp(-days / FRESHNESS_TAU_DAYS);
}
