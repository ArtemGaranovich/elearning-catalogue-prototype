import type { ReactNode } from 'react';

import { FACTOR_KEYS, FACTOR_LABELS, FACTOR_QUESTIONS, WEIGHT_PRESETS } from '@/lib/ranking/constants';

/**
 * PRD §4: "the five questions from the document in plain language, the
 * weight table, and the pipeline order. Two paragraphs, not the whole
 * document." Lets the page stand on its own if the reviewer opens the link
 * before watching the recording.
 */
export function HowRankingWorks(): ReactNode {
  const balanced = WEIGHT_PRESETS.balanced;

  return (
    <details
      id="how-ranking-works"
      open
      className="group scroll-mt-6 border-t border-border pt-6"
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
          <span
            aria-hidden
            className="inline-block text-ink-subtle transition-transform group-open:rotate-180"
          >
            ▾
          </span>
          How ranking works
        </h2>
      </summary>

      <p className="mt-4 max-w-2xl text-[0.875rem] leading-relaxed text-ink-muted">
        When you haven&apos;t asked for anything specific, the default order answers one
        question: which of these courses is most worth your time? That answer comes from a
        composite score across five factors, each mapped to one plain question about the course.
        A high rating alone cannot put a course first — it also has to hold up on completion,
        demand, freshness and fit.
      </p>
      <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-ink-muted">
        The moment you choose an explicit sort or filter, the score steps aside: <span className="font-medium text-ink">explicit
        intent always wins.</span> Promoted placements form a capped band lifted above the
        organic list after scoring and after the diversity pass — they never enter the score
        itself, so the organic ranking stays measurable.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full max-w-2xl border-collapse text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-ink-subtle">
              <th className="py-1.5 pr-4 font-medium">Factor</th>
              <th className="py-1.5 pr-4 font-medium">Question</th>
              <th className="py-1.5 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {FACTOR_KEYS.map((factor) => (
              <tr key={factor} className="border-b border-border/70">
                <td className="py-1.5 pr-4">
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block size-2 rounded-full align-middle"
                    style={{ backgroundColor: `var(--color-factor-${factor})` }}
                  />
                  <span className="font-medium text-ink">{FACTOR_LABELS[factor]}</span>
                </td>
                <td className="py-1.5 pr-4 text-ink-muted">{FACTOR_QUESTIONS[factor]}</td>
                <td className="tnum py-1.5 text-ink-muted">{balanced[factor].toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="mt-5 max-w-2xl list-decimal space-y-1 pl-5 text-[0.8125rem] text-ink-muted">
        <li>Candidates — every course in the selected category</li>
        <li>Gates — policy-flagged courses removed; sort-specific rating-count gate</li>
        <li>Score — percentiles computed over the gated category, before filters</li>
        <li>Filters — courses failing an active filter are removed</li>
        <li>Order — by the active sort key, then deterministic tie-breakers</li>
        <li>Diversity — at most 2 courses per instructor in the top 10</li>
        <li>Promo — Recommended mode only: eligible promoted courses fill a capped band</li>
        <li>Paginate — 12 per page</li>
      </ol>
    </details>
  );
}
