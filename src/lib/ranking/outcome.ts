/**
 * Outcome — do people actually finish it. docs/01-ranking-algorithm.md §3.2
 *
 *   Outcome_raw = 0.5 · completionRate
 *               + 0.3 · medianWatchPercent
 *               + 0.2 · (1 − refundRate)
 *
 * The anti-clickbait layer. All three inputs are behavioural rather than
 * declared, so they are considerably harder to manipulate than a rating.
 */

import { OUTCOME_WEIGHTS } from './constants';
import type { Course } from './types';

export interface OutcomeOptions {
  readonly course: Course;
}

export function outcomeRaw(options: OutcomeOptions): number {
  const { course } = options;
  return (
    OUTCOME_WEIGHTS.completionRate * course.completionRate +
    OUTCOME_WEIGHTS.medianWatchPercent * course.medianWatchPercent +
    OUTCOME_WEIGHTS.inverseRefundRate * (1 - course.refundRate)
  );
}
