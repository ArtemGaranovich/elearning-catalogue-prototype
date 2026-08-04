/**
 * Diversity cap — stage 6 of the pipeline. docs/01-ranking-algorithm.md §5.2
 *
 * At most 2 courses from the same instructor appear in the top 10; further
 * courses by that instructor are demoted below position 10. Prolific
 * instructors otherwise monopolise the first screen of narrow categories.
 *
 * Runs **before** promo injection, so the instructor cap cannot be used to
 * displace a paid placement and promoted slots are not consumed by this pass.
 */

import { DIVERSITY_MAX_PER_INSTRUCTOR, DIVERSITY_TOP_N } from './constants';
import type { RankedCourse } from './types';

export interface ApplyDiversityCapOptions {
  /** Ordered results — stage 5 output. */
  readonly ranked: readonly RankedCourse[];
  /** The Ranking Lab's diversity toggle (PRD §5.6). */
  readonly enabled: boolean;
  /** Defaults to DIVERSITY_MAX_PER_INSTRUCTOR. */
  readonly maxPerInstructor?: number;
  /** Defaults to DIVERSITY_TOP_N. */
  readonly topN?: number;
}

/**
 * Demoted courses carry `demotedByDiversityCap`, so the inspector can say why a
 * course is lower than its score implies.
 */
export function applyDiversityCap(options: ApplyDiversityCapOptions): readonly RankedCourse[] {
  const {
    ranked,
    enabled,
    maxPerInstructor = DIVERSITY_MAX_PER_INSTRUCTOR,
    topN = DIVERSITY_TOP_N,
  } = options;

  if (!enabled) {
    return ranked;
  }

  // Walk the ordered list, filling the top-N window while skipping over any
  // course that would be the (maxPerInstructor + 1)th from its instructor
  // within that window. Skipped courses are demoted; because they are, by
  // construction, drawn from earlier in `ranked` than anything not yet
  // visited, appending them ahead of the unvisited tail preserves the
  // original relative order of everything below the top N.
  const instructorCounts = new Map<string, number>();
  const topBucket: RankedCourse[] = [];
  const demotedIds = new Set<string>();
  const deferred: RankedCourse[] = [];

  let i = 0;
  for (; i < ranked.length && topBucket.length < topN; i += 1) {
    const rc = ranked[i]!;
    const count = instructorCounts.get(rc.course.instructorId) ?? 0;
    if (count < maxPerInstructor) {
      topBucket.push(rc);
      instructorCounts.set(rc.course.instructorId, count + 1);
    } else {
      deferred.push(rc);
      demotedIds.add(rc.course.id);
    }
  }
  const tail = ranked.slice(i);
  const ordered = [...topBucket, ...deferred, ...tail];

  return ordered.map((rc, index) => ({
    ...rc,
    position: index + 1,
    organicRank: index + 1,
    demotedByDiversityCap: demotedIds.has(rc.course.id),
  }));
}
