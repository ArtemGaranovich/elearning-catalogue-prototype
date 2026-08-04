/**
 * Quality — a rating you can trust. docs/01-ranking-algorithm.md §3.1
 *
 *            v · R  +  m · C
 *   R_adj  = ─────────────────
 *               v  +  m
 */

import { SHRINKAGE_M } from './constants';
import type { Course } from './types';

export interface CategoryPriorOptions {
  /**
   * The whole category **after the policy gate only** — not after the
   * `ratingCount >= 20` gate, and not after user filters.
   *
   * This is load-bearing. If `C` were computed later, removing the low-count
   * courses would move the category mean and the same course would display a
   * different adjusted rating in "Recommended" than in "Highest rated", with the
   * inspector unable to explain why. `C` is a property of the catalogue, not of
   * the current query (docs/01 §3.1).
   */
  readonly policyGatedCategoryCourses: readonly Course[];
}

/** `C` — the mean raw rating of the category, used as the shrinkage prior. */
export function categoryPrior(options: CategoryPriorOptions): number {
  const { policyGatedCategoryCourses } = options;
  const sum = policyGatedCategoryCourses.reduce((acc, course) => acc + course.ratingAvg, 0);
  return sum / policyGatedCategoryCourses.length;
}

export interface AdjustedRatingOptions {
  readonly course: Course;
  /** `C` from `categoryPrior`. */
  readonly categoryPrior: number;
  /**
   * When false, `R_adj` is the raw `ratingAvg`. This is the Ranking Lab's
   * shrinkage toggle (PRD §5.6) — the strongest single moment in the demo.
   */
  readonly shrinkage: boolean;
}

/** `R_adj`. Identical in every sort mode, by construction. */
export function adjustedRating(options: AdjustedRatingOptions): number {
  const { course, categoryPrior: prior, shrinkage } = options;
  if (!shrinkage) {
    return course.ratingAvg;
  }
  const v = course.ratingCount;
  const R = course.ratingAvg;
  return (v * R + SHRINKAGE_M * prior) / (v + SHRINKAGE_M);
}
