import type { ReactNode } from 'react';

import { FACTOR_LABELS, FACTOR_QUESTIONS, SHRINKAGE_M } from '@/lib/ranking/constants';
import type { RankedCourse, SortMode } from '@/lib/ranking/types';

import { ScoreBar } from './ScoreBar';

const TIE_BREAKER_LABELS: Record<string, string> = {
  'adjusted-rating': 'adjusted rating',
  'rating-count': 'rating count',
  'last-content-update': 'last content update',
  'id-hash': 'a stable id hash (the final, always-decisive tie-breaker)',
};

export interface ScoreInspectorProps {
  readonly result: RankedCourse;
  readonly categoryName: string;
  /** How many courses survived gating in this category — not `basisSize`. */
  readonly candidateCount: number;
  /** `C` — the category mean raw rating the shrinkage formula pulls toward. */
  readonly categoryMeanRawRating: number;
  /** The Ranking Lab's shrinkage toggle — changes how this line reads. */
  readonly shrinkageEnabled: boolean;
  readonly sortMode: SortMode;
  readonly promoInjectionEnabled: boolean;
}

/**
 * Expands from a course card (PRD §5.5). Renders the explanation object
 * `pipeline.ts` already computed — this component derives nothing (CLAUDE.md:
 * "the UI renders this — it never recomputes it").
 */
export function ScoreInspector({
  result,
  categoryName,
  candidateCount,
  categoryMeanRawRating,
  shrinkageEnabled,
  sortMode,
  promoInjectionEnabled,
}: ScoreInspectorProps): ReactNode {
  const { course, explanation, promo, tieBreaker, adjustedRating, position, organicRank } = result;

  return (
    <div className="border-t border-border bg-canvas px-5 py-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          Why this rank
        </h3>
        <p className="tnum text-xs text-ink-subtle">
          Score {explanation.score.toFixed(3)} / max {explanation.maxAttainableScore.toFixed(3)}
        </p>
      </div>

      <div className="mt-3">
        <ScoreBar factors={explanation.factors} />
      </div>

      <ul className="mt-4 space-y-1.5 text-[0.8125rem] text-ink-muted">
        {explanation.factors.map((factor) => (
          <li key={factor.factor} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-medium text-ink">{FACTOR_LABELS[factor.factor]}</span>
            <span className="text-ink-subtle">— {FACTOR_QUESTIONS[factor.factor]}</span>
            <span className="tnum">
              raw {factor.raw.toFixed(3)} · percentile {(factor.percentile * 100).toFixed(0)}% ·
              weight {factor.weight.toFixed(2)} · contributes {factor.contribution.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[0.8125rem] text-ink-muted">
        <span className="font-medium text-ink">Shrinkage: </span>
        {shrinkageEnabled ? (
          <>
            raw rating {course.ratingAvg.toFixed(2)} from {course.ratingCount} rating
            {course.ratingCount === 1 ? '' : 's'} → adjusted {adjustedRating.toFixed(3)}, pulled
            toward the category mean of {categoryMeanRawRating.toFixed(2)} because{' '}
            {course.ratingCount} {course.ratingCount === 1 ? 'rating is' : 'ratings are'} not
            enough to fully trust the raw average (confidence threshold m = {SHRINKAGE_M}).
          </>
        ) : (
          <>
            switched off — showing the raw average {course.ratingAvg.toFixed(2)} unmodified,
            regardless of its {course.ratingCount} rating{course.ratingCount === 1 ? '' : 's'}.
          </>
        )}
      </p>

      {position !== organicRank && (promo === null || !promo.injected) && (
        <p className="mt-3 text-[0.8125rem] text-ink-muted">
          Ranks #{organicRank} on merit — shown at position #{position} because {position - organicRank}{' '}
          promoted placement{position - organicRank === 1 ? '' : 's'} above it {position - organicRank === 1 ? 'takes' : 'take'} a
          reserved slot without moving on merit.
        </p>
      )}

      <p className="mt-4 text-[0.8125rem] text-ink-muted">
        {explanation.normalisationBasis === 'global' ? (
          <>
            Normalised against the global pool — only {candidateCount} candidates in{' '}
            {categoryName}.
          </>
        ) : (
          <>
            Percentiles within {categoryName} · {explanation.basisSize} courses. Scores do not
            change when filters are applied.
          </>
        )}
      </p>

      {tieBreaker !== 'none' && (
        <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
          Tied on the sort key — broken by {TIE_BREAKER_LABELS[tieBreaker] ?? tieBreaker}.
        </p>
      )}

      {promo !== null && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-[0.8125rem] font-medium text-ink">
            {promo.injected ? (
              <>
                Promoted · slot {promo.slot} · would rank #{promo.organicRank} organically
              </>
            ) : (
              <>
                {promo.type === 'sponsored' ? 'Sponsored' : 'Featured'} course — not currently
                promoted{sortMode !== 'recommended' && ' (promotion is suppressed outside Recommended)'}
                {sortMode === 'recommended' &&
                  !promoInjectionEnabled &&
                  ' (promo injection is switched off)'}
              </>
            )}
          </p>
          <ul className="mt-2.5 space-y-1 text-[0.75rem]">
            {promo.gate.conditions.map((condition) => (
              <li
                key={condition.id}
                className={`flex items-center gap-1.5 ${condition.passed ? 'text-emerald-700' : 'text-red-700'}`}
              >
                <span aria-hidden>{condition.passed ? '✓' : '✕'}</span>
                <span>
                  {condition.label} — {condition.actual}
                  {condition.id !== 'no-policy-flags' && ` (need ${condition.threshold})`}
                </span>
              </li>
            ))}
          </ul>
          {promo.gate.failureMessage !== null && (
            <p className="mt-2.5 text-[0.8125rem] font-medium text-red-700">
              {promo.gate.failureMessage}
            </p>
          )}
        </div>
      )}

      {result.demotedByDiversityCap && (
        <p className="mt-4 text-[0.8125rem] text-ink-muted">
          Demoted below position 10 by the per-instructor diversity cap — this instructor already
          has 2 courses higher in the list.
        </p>
      )}
    </div>
  );
}
