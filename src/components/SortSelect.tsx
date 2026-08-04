import type { ReactNode } from 'react';

import { SORT_MODES, SORT_MODE_LABELS } from '@/lib/ranking/constants';
import type { SortMode } from '@/lib/ranking/types';

export interface SortSelectProps {
  readonly value: SortMode;
  readonly onChange: (mode: SortMode) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps): ReactNode {
  return (
    <label className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
      <span className="font-medium text-ink">Sort</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortMode)}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[0.8125rem] text-ink focus:border-accent focus:outline-none"
      >
        {SORT_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {SORT_MODE_LABELS[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}
