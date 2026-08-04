/**
 * Promoted placements — stage 7 of the pipeline. docs/01-ranking-algorithm.md §7.2
 *
 * **Promotion never enters the score.** Adding a boost term would destroy the
 * ability to answer "is this course here because it is good, or because it was
 * paid for?" Instead, eligible promoted courses form a capped band lifted
 * above the organic list, and their organic score is left untouched. This is
 * a design invariant, not a preference (CLAUDE.md).
 *
 * The band replaces an earlier reserved-slot design that injected promoted
 * courses into fixed positions 1 and 6. That design could demote a course by
 * its own promotion — a course organically ranked 4th "promoted" into slot 6
 * finished two places lower than if it had never paid. Banding removes that
 * failure by construction: step 3 below skips any course whose band position
 * would not improve on its organic rank, so a promoted course is never worse
 * off than it would have been organically (docs/01 §7.2).
 *
 * Injection is active in Recommended mode only: in "Price: low to high" a paid
 * placement at the top is straightforwardly broken, because the user asked a
 * precise question and would receive an answer to a different one (§7.4).
 */

import { MIN_RATING_COUNT, PROMO_BAND_MAX, PROMO_MAX_CONTENT_AGE_MONTHS } from './constants';
import { ageDays } from './freshness';
import type {
  Course,
  PromoGateCondition,
  PromoGateResult,
  RankedCourse,
  SortMode,
} from './types';

const AVG_DAYS_PER_MONTH = 30.4368;

export interface EvaluatePromoGateOptions {
  readonly course: Course;
  readonly adjustedRating: number;
  /** The category mean raw rating, `C`. The gate compares `R_adj` against it. */
  readonly categoryMeanRawRating: number;
  readonly asOfIsoDate: string;
}

/**
 * The four independent conditions of §7.3: `R_adj >=` the category mean, rating
 * count `>= 20`, no active policy flags, content updated within 24 months.
 *
 * Promotion accelerates good courses; it cannot substitute for quality. A
 * promoted course that fails the gate is not placed — it appears in its organic
 * position instead. This is the part of the promo design that matters most.
 */
export function evaluatePromoGate(options: EvaluatePromoGateOptions): PromoGateResult {
  const { course, adjustedRating, categoryMeanRawRating, asOfIsoDate } = options;

  const monthsSinceUpdate =
    ageDays({ fromIsoDate: course.lastContentUpdateAt, asOfIsoDate }) / AVG_DAYS_PER_MONTH;

  const conditions: PromoGateCondition[] = [
    {
      id: 'adjusted-rating-vs-category-mean',
      label: 'Adjusted rating at or above the category mean',
      passed: adjustedRating >= categoryMeanRawRating,
      actual: adjustedRating.toFixed(2),
      threshold: categoryMeanRawRating.toFixed(2),
    },
    {
      id: 'rating-count',
      label: `At least ${MIN_RATING_COUNT} ratings`,
      passed: course.ratingCount >= MIN_RATING_COUNT,
      actual: String(course.ratingCount),
      threshold: String(MIN_RATING_COUNT),
    },
    {
      id: 'no-policy-flags',
      label: 'No active policy flags',
      passed: course.policyFlags.length === 0,
      actual: course.policyFlags.length === 0 ? 'none' : course.policyFlags.join(', '),
      threshold: 'none',
    },
    {
      id: 'updated-within-24-months',
      label: `Updated within ${PROMO_MAX_CONTENT_AGE_MONTHS} months`,
      passed: monthsSinceUpdate <= PROMO_MAX_CONTENT_AGE_MONTHS,
      actual: monthsSinceUpdate.toFixed(1),
      threshold: String(PROMO_MAX_CONTENT_AGE_MONTHS),
    },
  ];

  const passed = conditions.every((condition) => condition.passed);
  const firstFailed = conditions.find((condition) => !condition.passed);

  const failureMessage =
    firstFailed === undefined ? null : buildFailureMessage(firstFailed, categoryMeanRawRating);

  return { passed, conditions, failureMessage };
}

function buildFailureMessage(
  condition: PromoGateCondition,
  categoryMeanRawRating: number,
): string {
  switch (condition.id) {
    case 'adjusted-rating-vs-category-mean':
      return (
        `Promotion not applied — adjusted rating ${condition.actual} is below the ` +
        `category mean of ${categoryMeanRawRating.toFixed(2)}.`
      );
    case 'rating-count':
      return (
        `Promotion not applied — only ${condition.actual} ratings, fewer than the ` +
        `required ${condition.threshold}.`
      );
    case 'no-policy-flags':
      return `Promotion not applied — flagged: ${condition.actual}.`;
    case 'updated-within-24-months':
      return (
        `Promotion not applied — last updated ${condition.actual} months ago, more ` +
        `than the allowed ${condition.threshold}.`
      );
  }
}

export interface InjectPromosOptions {
  /** Ordered, diversity-capped organic results — stage 6 output. */
  readonly organic: readonly RankedCourse[];
  readonly sortMode: SortMode;
  /** The Ranking Lab's promo-injection toggle (PRD §5.6). */
  readonly promoInjectionEnabled: boolean;
  /**
   * The Ranking Lab's promo-quality-gate toggle. Switching it off immediately
   * places the below-average sponsored course at position 1, badge still
   * attached — which is the point of exposing it (PRD §5.6).
   */
  readonly qualityGateEnabled: boolean;
  readonly categoryMeanRawRating: number;
  readonly asOfIsoDate: string;
}

export interface InjectPromosResult {
  readonly results: readonly RankedCourse[];
  /** Promoted courses refused the band by the quality gate — they stay in their organic position. */
  readonly rejected: readonly RankedCourse[];
}

/** Sponsored outranks Featured (§7.2) — paid placement over editorial curation. */
function promoTypeRank(type: 'sponsored' | 'featured'): number {
  return type === 'sponsored' ? 0 : 1;
}

function promoMeritRank(rc: RankedCourse): number {
  // priority × R_adj × predictedCTR (§7.2) — the adjusted rating, not the
  // normalised Quality percentile, so a promoted course's own merit still
  // decides who wins a band position within its group.
  const promo = rc.course.promo;
  if (promo === null) return -Infinity;
  return promo.priority * rc.adjustedRating * promo.predictedCtr;
}

function compareForBand(a: RankedCourse, b: RankedCourse): number {
  const typeCompare = promoTypeRank(a.course.promo!.type) - promoTypeRank(b.course.promo!.type);
  if (typeCompare !== 0) return typeCompare;
  return promoMeritRank(b) - promoMeritRank(a);
}

function noImprovementMessage(organicRank: number): string {
  return `Already ranks #${organicRank} organically; promotion added nothing.`;
}

export function injectPromos(options: InjectPromosOptions): InjectPromosResult {
  const {
    organic,
    sortMode,
    promoInjectionEnabled,
    qualityGateEnabled,
    categoryMeanRawRating,
    asOfIsoDate,
  } = options;

  // Attach the gate evaluation to every promo-carrying course in every sort
  // mode: it is a fact about the course, independent of whether this mode
  // bands anything. The quality-gate toggle affects *eligibility* below, not
  // this evaluation, so switching it off can visibly place a course the gate
  // itself still reports as failing (PRD §5.6).
  const withGate: RankedCourse[] = organic.map((rc) => {
    if (rc.course.promo === null) {
      return rc;
    }
    const gate = evaluatePromoGate({
      course: rc.course,
      adjustedRating: rc.adjustedRating,
      categoryMeanRawRating,
      asOfIsoDate,
    });
    return {
      ...rc,
      promo: {
        type: rc.course.promo.type,
        outcome: gate.passed ? 'no-improvement' : 'gate-refused',
        injected: false,
        bandPosition: null,
        organicRank: rc.organicRank,
        gate,
        noImprovementMessage: gate.passed ? noImprovementMessage(rc.organicRank) : null,
      },
    };
  });

  const canInject = promoInjectionEnabled && sortMode === 'recommended';
  if (!canInject) {
    return { results: withGate, rejected: [] };
  }

  const eligible = withGate
    .filter((rc) => rc.promo !== null && (qualityGateEnabled ? rc.promo.gate.passed : true))
    .sort(compareForBand);

  const rejected = withGate.filter(
    (rc) => rc.promo !== null && qualityGateEnabled && !rc.promo.gate.passed,
  );

  // §7.2 step 3: take the first PROMO_BAND_MAX, skipping any candidate whose
  // band position would not improve on its own organic rank. A skip leaves
  // the band position open for the next candidate — it does not consume a
  // slot — so a below-merit course never blocks a better one behind it.
  const band: RankedCourse[] = [];
  const bandedCourseIds = new Set<string>();
  for (const candidate of eligible) {
    const bandPosition = band.length + 1;
    if (bandPosition > PROMO_BAND_MAX) break;
    if (bandPosition < candidate.organicRank) {
      band.push({
        ...candidate,
        promo: {
          ...candidate.promo!,
          outcome: 'placed',
          injected: true,
          bandPosition,
          noImprovementMessage: null,
        },
        isPromotedPlacement: true,
      });
      bandedCourseIds.add(candidate.course.id);
    }
  }

  const remaining = withGate.filter((rc) => !bandedCourseIds.has(rc.course.id));

  const results = [...band, ...remaining].map((rc, index) => ({ ...rc, position: index + 1 }));

  return { results, rejected };
}
