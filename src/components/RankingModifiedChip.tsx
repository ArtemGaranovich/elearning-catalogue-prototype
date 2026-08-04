'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface RankingModifiedChipProps {
  /** True when the current weights/toggles differ from the Balanced defaults. */
  readonly visible: boolean;
}

/**
 * PRD §5.7, acceptance criterion 20: "Silently presenting a hand-tuned
 * ranking as 'what users see' would be the one genuinely misleading thing
 * this prototype could do." Shown only in User view, only when a Ranking Lab
 * change survived the switch from Demo view.
 */
export function RankingModifiedChip({ visible }: RankingModifiedChipProps): ReactNode {
  const [dismissed, setDismissed] = useState(false);
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setDismissed(false);
    }
    wasVisible.current = visible;
  }, [visible]);

  if (!visible || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-accent-soft/60 px-4 py-2.5 text-[0.8125rem] text-ink-muted"
    >
      <span>Ranking parameters modified in Demo view.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-ink-subtle hover:text-ink"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  );
}
