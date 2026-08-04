/**
 * Promoted placements — stage 7 of the pipeline. docs/01-ranking-algorithm.md §7
 *
 * **Promotion never enters the score.** Adding a boost term would destroy the
 * ability to answer "is this course here because it is good, or because it was
 * paid for?" Instead, promoted courses are injected into reserved slots and
 * their organic score is left untouched. This is a design invariant, not a
 * preference (CLAUDE.md).
 *
 * Injection is active in Recommended mode only: in "Price: low to high" a paid
 * placement at the top is straightforwardly broken, because the user asked a
 * precise question and would receive an answer to a different one (§7.4).
 */

import {
  MIN_RATING_COUNT,
  PROMO_LEADING_SLOTS,
  PROMO_MAX_CONTENT_AGE_MONTHS,
  PROMO_SLOT_INTERVAL,
} from './constants';
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

export interface PromoSlotsOptions {
  /** Number of organic results available to inject into. */
  readonly resultCount: number;
}

/** Reserved positions: 1 and 6, then one per subsequent 10 results (§7.2). */
export function promoSlots(options: PromoSlotsOptions): readonly number[] {
  const { resultCount } = options;
  const slots = PROMO_LEADING_SLOTS.filter((slot) => slot <= resultCount);
  let next = PROMO_LEADING_SLOTS[PROMO_LEADING_SLOTS.length - 1]! + PROMO_SLOT_INTERVAL;
  while (next <= resultCount) {
    slots.push(next);
    next += PROMO_SLOT_INTERVAL;
  }
  return slots;
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
  /** Promoted courses refused a slot — they stay in their organic position. */
  readonly rejected: readonly RankedCourse[];
}

function promoRank(rc: RankedCourse): number {
  // priority × Quality × predictedCTR (§7.2) — Quality is R_adj, so a
  // promoted course's own merit still decides who wins a slot when more than
  // one is eligible.
  const promo = rc.course.promo;
  if (promo === null) return -Infinity;
  return promo.priority * rc.adjustedRating * promo.predictedCtr;
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
  // injects anything. The quality-gate toggle affects *eligibility* below, not
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
        injected: false,
        slot: null,
        organicRank: rc.organicRank,
        gate,
      },
    };
  });

  const canInject = promoInjectionEnabled && sortMode === 'recommended';
  if (!canInject) {
    return { results: withGate, rejected: [] };
  }

  const slots = promoSlots({ resultCount: withGate.length });

  const eligible = withGate
    .filter((rc) => rc.promo !== null && (qualityGateEnabled ? rc.promo.gate.passed : true))
    .sort((a, b) => promoRank(b) - promoRank(a));

  const rejected = withGate.filter(
    (rc) => rc.promo !== null && qualityGateEnabled && !rc.promo.gate.passed,
  );

  const injectedBySlot = new Map<number, RankedCourse>();
  const usedCourseIds = new Set<string>();
  const queue = [...eligible];
  for (const slot of slots) {
    const next = queue.shift();
    if (next === undefined) break;
    usedCourseIds.add(next.course.id);
    injectedBySlot.set(slot, {
      ...next,
      promo: { ...next.promo!, injected: true, slot },
      isPromotedPlacement: true,
    });
  }

  const remaining = withGate.filter((rc) => !usedCourseIds.has(rc.course.id));

  const ordered: RankedCourse[] = [];
  let remainingIndex = 0;
  for (let position = 1; position <= withGate.length; position += 1) {
    const injected = injectedBySlot.get(position);
    if (injected !== undefined) {
      ordered.push(injected);
    } else {
      ordered.push(remaining[remainingIndex]!);
      remainingIndex += 1;
    }
  }

  const results = ordered.map((rc, index) => ({ ...rc, position: index + 1 }));

  return { results, rejected };
}
