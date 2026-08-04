import type { ReactNode } from 'react';

import type { ViewMode } from '@/lib/url-state';

const MODES: readonly { readonly id: ViewMode; readonly label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'user', label: 'User' },
];

export interface ViewModeToggleProps {
  readonly viewMode: ViewMode;
  readonly onChange: (mode: ViewMode) => void;
}

/**
 * Present in both modes — "a mode you cannot leave is a trap" (PRD §5.7).
 * Quiet in User view: no accent colour, small footprint, findable rather
 * than prominent. The `D` shortcut (wired in `page.tsx`) toggles the same
 * state this renders.
 */
export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps): ReactNode {
  const quiet = viewMode === 'user';

  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${
        quiet ? '' : 'ring-1 ring-inset ring-border'
      }`}
    >
      {MODES.map((mode) => {
        const active = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.id)}
            title={`${mode.label} view (press D to toggle)`}
            className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${
              active
                ? quiet
                  ? 'bg-zinc-200 text-ink-muted'
                  : 'bg-accent text-white'
                : 'text-ink-subtle hover:text-ink-muted'
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
