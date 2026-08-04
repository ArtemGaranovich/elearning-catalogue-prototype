/**
 * Gates — stage 2 of the pipeline. docs/01-ranking-algorithm.md §5
 *
 * Remove policy-flagged courses always; in "Highest rated" mode also remove
 * courses below MIN_RATING_COUNT ratings. Below that count a rating is not a
 * claim worth surfacing at the top of a list (§6).
 *
 * Gating runs *before* scoring, and the gated set is the normalisation basis.
 */

import { MIN_RATING_COUNT } from './constants';
import type { Course, GateRejection, PolicyFlag, SortMode } from './types';

const POLICY_FLAG_LABELS: Readonly<Record<PolicyFlag, string>> = {
  'under-review': 'Under review',
};

export interface ApplyGatesOptions {
  /** All courses in the selected category — stage 1 output. */
  readonly courses: readonly Course[];
  readonly sortMode: SortMode;
}

export interface ApplyGatesResult {
  readonly passed: readonly Course[];
  /**
   * With the reason for each removal. Criterion 4 requires the "N hidden" note
   * to reveal which courses when clicked, so a bare count is not enough.
   */
  readonly rejected: readonly GateRejection[];
}

export function applyGates(options: ApplyGatesOptions): ApplyGatesResult {
  const { courses, sortMode } = options;
  const rejected: GateRejection[] = [];

  const afterPolicyGate = courses.filter((course) => {
    if (course.policyFlags.length === 0) {
      return true;
    }
    rejected.push({
      course,
      gate: 'policy-flag',
      reason: course.policyFlags.map((flag) => POLICY_FLAG_LABELS[flag]).join(', '),
    });
    return false;
  });

  if (sortMode !== 'highest-rated') {
    return { passed: afterPolicyGate, rejected };
  }

  const passed = afterPolicyGate.filter((course) => {
    if (course.ratingCount >= MIN_RATING_COUNT) {
      return true;
    }
    rejected.push({
      course,
      gate: 'min-rating-count',
      reason: `Fewer than ${MIN_RATING_COUNT} ratings (${course.ratingCount})`,
    });
    return false;
  });

  return { passed, rejected };
}

export interface PolicyGateOptions {
  readonly courses: readonly Course[];
}

/**
 * The policy gate alone. Separate from `applyGates` because the shrinkage prior
 * `C` is computed over the policy-gated category and must not see the
 * rating-count gate (docs/01 §3.1).
 */
export function applyPolicyGate(options: PolicyGateOptions): readonly Course[] {
  return options.courses.filter((course) => course.policyFlags.length === 0);
}
