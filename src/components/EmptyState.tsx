import type { ReactNode } from 'react';

import type { EmptyStateInfo } from '@/lib/empty-state';
import type { FilterState } from '@/lib/ranking/types';

export interface EmptyStateProps {
  readonly info: EmptyStateInfo;
  readonly categoryName: string;
  readonly onApply: (patch: Partial<FilterState>) => void;
}

/**
 * A designed state, not a blank panel (PRD §5.2): names what is responsible
 * and offers a one-click relaxation. Reached only via a search query with no
 * matches, or a URL carrying a filter combination a data change has since
 * emptied — sidebar clicks alone cannot reach it, because zero-yield options
 * are disabled rather than hidden.
 */
export function EmptyState({ info, categoryName, onApply }: EmptyStateProps): ReactNode {
  if (!info.isEmpty) {
    return null;
  }

  const workingSuggestions = info.suggestions.filter((s) => s.resultCount > 0);

  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">No courses match in {categoryName}.</p>
      <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] text-ink-muted">
        {info.primaryCause !== null
          ? `"${info.primaryCause.label}" is the filter most likely responsible.`
          : 'The current combination of filters and search leaves nothing in this category.'}
      </p>

      {workingSuggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {workingSuggestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion.facet}
              type="button"
              onClick={() => onApply(suggestion.reset)}
              className="rounded-full bg-accent-soft px-3.5 py-1.5 text-[0.8125rem] font-medium text-accent-strong hover:bg-accent hover:text-white"
            >
              {suggestion.label} → {suggestion.resultCount} result
              {suggestion.resultCount === 1 ? '' : 's'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
