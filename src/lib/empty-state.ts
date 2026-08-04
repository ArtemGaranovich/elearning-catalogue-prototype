/**
 * The designed empty state (PRD §5.2). Composes the already-pure filter
 * primitives (`applyFilters`, `suggestRelaxations`) rather than recomputing
 * anything — it only decides *which* relaxation is worth offering.
 *
 * `suggestRelaxations` (lib/ranking/filters.ts) only considers sidebar
 * facets. The free-text search query is entered in the header, not the
 * sidebar, and is the one path that can reach zero results on its own
 * (criterion 12) — because zero-yield sidebar options are disabled rather
 * than hidden, a filter-only combination can never be clicked into a dead
 * end. This module adds "clear the search query" as a candidate alongside the
 * sidebar relaxations so there is always a working suggestion regardless of
 * which one is actually responsible.
 */
import type { ApplyFiltersOptions, FilterFacet } from './ranking/filters';
import { applyFilters, suggestRelaxations } from './ranking/filters';
import type { FilterState } from './ranking/types';

export interface EmptyStateSuggestion {
  readonly facet: FilterFacet | 'query';
  readonly label: string;
  readonly resultCount: number;
  readonly reset: Partial<FilterState>;
}

export interface EmptyStateInfo {
  readonly isEmpty: boolean;
  /** The single most likely cause, for the "which filter is responsible" line. */
  readonly primaryCause: EmptyStateSuggestion | null;
  /** Ordered most-effective first; may be empty if nothing relaxes it. */
  readonly suggestions: readonly EmptyStateSuggestion[];
}

export function computeEmptyStateInfo(options: ApplyFiltersOptions): EmptyStateInfo {
  const { scored, filters, asOfIsoDate } = options;

  if (applyFilters(options).length > 0) {
    return { isEmpty: false, primaryCause: null, suggestions: [] };
  }

  const suggestions: EmptyStateSuggestion[] = [];

  const trimmedQuery = filters.query.trim();
  if (trimmedQuery !== '') {
    const resultCount = applyFilters({
      scored,
      filters: { ...filters, query: '' },
      asOfIsoDate,
    }).length;
    suggestions.push({
      facet: 'query',
      label: `Clear the search "${trimmedQuery}"`,
      resultCount,
      reset: { query: '' },
    });
  }

  suggestions.push(...suggestRelaxations(options));

  suggestions.sort((a, b) => b.resultCount - a.resultCount);

  return {
    isEmpty: true,
    primaryCause: suggestions[0] ?? null,
    suggestions,
  };
}
