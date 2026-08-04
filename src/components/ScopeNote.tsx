import type { ReactNode } from 'react';

/** PRD §8: naming the limits is more convincing than hoping they go unnoticed. */
export function ScopeNote(): ReactNode {
  return (
    <section className="mt-6 max-w-2xl rounded-lg border border-border bg-surface px-4 py-3.5">
      <h3 className="text-[0.8125rem] font-semibold text-ink">Scope and limitations</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
        Static dataset of 64 courses, frozen as of the date in this build — no backend, no
        database, no live data. Enrolment, completion, refund and rating figures are synthetic,
        generated to demonstrate the model rather than measured from real usage. Rating recency
        weighting, personalisation and learned relevance are described in the design document but
        not implemented here. Layout is functional but not optimised below 768px.
      </p>
    </section>
  );
}
