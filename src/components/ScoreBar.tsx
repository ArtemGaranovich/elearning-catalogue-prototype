import type { ReactNode } from 'react';

import { FACTOR_LABELS } from '@/lib/ranking/constants';
import type { FactorExplanation } from '@/lib/ranking/types';

/**
 * The horizontal stacked bar at the top of the Score Inspector (PRD §5.5):
 * five weighted contributions summing to the total score. Segment width is a
 * share of 1.0 (the maximum possible score), not a share of this course's own
 * score, so a disabled factor's dropped weight shows up as visible empty
 * space rather than being silently absorbed into the others.
 *
 * Colour is never the only channel: every segment is also named and given its
 * percentage in the legend below (PRD §6, WCAG AA).
 */
export function ScoreBar({
  factors,
}: {
  readonly factors: readonly FactorExplanation[];
}): ReactNode {
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100"
        role="img"
        aria-label={`Score breakdown: ${factors
          .map((f) => `${FACTOR_LABELS[f.factor]} contributed ${(f.contribution * 100).toFixed(1)} points`)
          .join(', ')}`}
      >
        {factors.map((factor) => (
          <div
            key={factor.factor}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${Math.max(0, factor.contribution) * 100}%`,
              backgroundColor: `var(--color-factor-${factor.factor})`,
            }}
          />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
        {factors.map((factor) => (
          <div key={factor.factor} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-ink-muted">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: `var(--color-factor-${factor.factor})` }}
              />
              {FACTOR_LABELS[factor.factor]}
              {!factor.enabled && <span className="text-ink-subtle">(off)</span>}
            </dt>
            <dd className="tnum text-[0.8125rem] text-ink">
              {(factor.contribution * 100).toFixed(1)} pt
              <span className="text-ink-subtle"> · p{Math.round(factor.percentile * 100)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
