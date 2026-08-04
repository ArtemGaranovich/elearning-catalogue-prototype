/**
 * Normalisation. docs/01-ranking-algorithm.md §4, §4.1
 *
 *                |{ c : f(c) < f(x) }| + 0.5 · |{ c ≠ x : f(c) = f(x) }|
 *   norm(f, x) = ────────────────────────────────────────────────────────
 *                                      N − 1
 *
 * Midranks, so tied values share a percentile. A unique maximum normalises to
 * 1.0, a unique minimum to 0.0, and a factor with the same value for every
 * course normalises to 0.5 for every course — which is what makes Fit inert
 * when there is no query, rather than zero for everyone.
 */

import { SMALL_BASIS_THRESHOLD } from './constants';
import type { Course, NormalisationBasis } from './types';

export interface MidrankPercentilesOptions {
  readonly values: readonly number[];
}

/**
 * Percentiles positionally aligned with `values`.
 *
 * With a single value the denominator `N − 1` is zero; that case returns 0.5,
 * consistent with "no information to distinguish anything".
 */
export function midrankPercentiles(options: MidrankPercentilesOptions): readonly number[] {
  const { values } = options;
  const n = values.length;
  if (n <= 1) {
    return values.map(() => 0.5);
  }
  return values.map((x, i) => {
    let less = 0;
    let equalOthers = 0;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const other = values[j]!;
      if (other < x) {
        less += 1;
      } else if (other === x) {
        equalOthers += 1;
      }
    }
    return (less + 0.5 * equalOthers) / (n - 1);
  });
}

export interface ResolveNormalisationBasisOptions {
  /**
   * The gated category — stage 2 output, before user filters (§4.1). Passing the
   * filtered set here would make a course's score change every time the user
   * ticked a checkbox, and the Score Inspector would become impossible to reason
   * about.
   */
  readonly gatedCategoryCourses: readonly Course[];
  /** The gated global pool, used when the category basis is too small. */
  readonly gatedGlobalCourses: readonly Course[];
  /** Defaults to SMALL_BASIS_THRESHOLD. */
  readonly threshold?: number;
}

export interface ResolvedBasis {
  readonly basis: NormalisationBasis;
  /** The courses percentiles are actually computed over. */
  readonly courses: readonly Course[];
  /** `basisSize` in the pipeline meta — not the same number as `candidateCount`. */
  readonly size: number;
}

export function resolveNormalisationBasis(
  options: ResolveNormalisationBasisOptions,
): ResolvedBasis {
  const {
    gatedCategoryCourses,
    gatedGlobalCourses,
    threshold = SMALL_BASIS_THRESHOLD,
  } = options;
  if (gatedCategoryCourses.length >= threshold) {
    return { basis: 'category', courses: gatedCategoryCourses, size: gatedCategoryCourses.length };
  }
  return { basis: 'global', courses: gatedGlobalCourses, size: gatedGlobalCourses.length };
}
