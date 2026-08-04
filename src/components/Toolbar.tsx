import type { ReactNode } from 'react';

import { getCategory } from '@/data/categories';
import type { CategoryId } from '@/data/categories';
import { DURATION_BUCKETS, LANGUAGE_LABELS, MIN_RATING_COUNT } from '@/lib/ranking/constants';
import type { FilterState, GateRejection, SortMode } from '@/lib/ranking/types';

import { SortSelect } from './SortSelect';

interface Chip {
  readonly key: string;
  readonly label: string;
  readonly reset: Partial<FilterState>;
}

function buildChips(filters: FilterState, categoryId: CategoryId): readonly Chip[] {
  const chips: Chip[] = [];
  const category = getCategory(categoryId);

  if (filters.subcategoryIds.length > 0) {
    const names = filters.subcategoryIds
      .map((id) => category.subcategories.find((s) => s.id === id)?.name ?? id)
      .join(', ');
    chips.push({ key: 'sub', label: `Subcategory: ${names}`, reset: { subcategoryIds: [] } });
  }
  if (filters.minAdjustedRating > 0) {
    chips.push({
      key: 'rating',
      label: `${filters.minAdjustedRating}+ adjusted rating`,
      reset: { minAdjustedRating: 0 },
    });
  }
  if (filters.levels.length > 0) {
    chips.push({ key: 'level', label: `Level: ${filters.levels.join(', ')}`, reset: { levels: [] } });
  }
  if (filters.durationBuckets.length > 0) {
    const names = filters.durationBuckets
      .map((id) => DURATION_BUCKETS.find((b) => b.id === id)?.label ?? id)
      .join(', ');
    chips.push({ key: 'duration', label: `Duration: ${names}`, reset: { durationBuckets: [] } });
  }
  if (filters.priceMode !== 'any' || filters.maxPrice !== null) {
    const parts = [
      filters.priceMode !== 'any' ? filters.priceMode : null,
      filters.maxPrice !== null ? `≤ $${filters.maxPrice}` : null,
    ].filter(Boolean);
    chips.push({
      key: 'price',
      label: `Price: ${parts.join(', ')}`,
      reset: { priceMode: 'any', maxPrice: null },
    });
  }
  if (filters.languages.length > 0) {
    chips.push({
      key: 'lang',
      label: `Language: ${filters.languages.map((l) => LANGUAGE_LABELS[l]).join(', ')}`,
      reset: { languages: [] },
    });
  }
  if (filters.certificateOnly) {
    chips.push({ key: 'cert', label: 'Certificate included', reset: { certificateOnly: false } });
  }
  if (filters.updatedWithinMonths > 0) {
    chips.push({
      key: 'updated',
      label: `Updated within ${filters.updatedWithinMonths} months`,
      reset: { updatedWithinMonths: 0 },
    });
  }
  if (filters.instructorIds.length > 0) {
    chips.push({
      key: 'instructor',
      label: `Instructor: ${filters.instructorIds.length} selected`,
      reset: { instructorIds: [] },
    });
  }

  return chips;
}

export interface ToolbarProps {
  readonly categoryId: CategoryId;
  readonly filters: FilterState;
  readonly onFiltersChange: (patch: Partial<FilterState>) => void;
  readonly sortMode: SortMode;
  readonly onSortChange: (mode: SortMode) => void;
  readonly totalResults: number;
  readonly ratingGateHidden: readonly GateRejection[];
  readonly promoInjectionEnabled: boolean;
  readonly onTogglePromoInjection: () => void;
}

export function Toolbar({
  categoryId,
  filters,
  onFiltersChange,
  sortMode,
  onSortChange,
  totalResults,
  ratingGateHidden,
  promoInjectionEnabled,
  onTogglePromoInjection,
}: ToolbarProps): ReactNode {
  const chips = buildChips(filters, categoryId);
  const ratingGateOnly = ratingGateHidden.filter((r) => r.gate === 'min-rating-count');

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tnum text-[0.8125rem] text-ink-muted">
          <span className="font-semibold text-ink">{totalResults}</span> result
          {totalResults === 1 ? '' : 's'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[0.75rem] text-ink-muted">
            <input
              type="checkbox"
              checked={promoInjectionEnabled}
              onChange={onTogglePromoInjection}
              className="size-3.5 accent-[var(--color-accent)]"
            />
            Promoted placements
          </label>
          <SortSelect value={sortMode} onChange={onSortChange} />
        </div>
      </div>

      {sortMode === 'highest-rated' && (
        <p className="text-[0.8125rem] text-ink-muted">
          Courses with fewer than {MIN_RATING_COUNT} ratings are excluded —{' '}
          <details className="inline">
            <summary className="inline cursor-pointer list-none font-medium text-accent hover:text-accent-strong [&::-webkit-details-marker]:hidden">
              {ratingGateOnly.length} hidden
            </summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[0.75rem]">
              {ratingGateOnly.map((rejection) => (
                <li key={rejection.course.id}>
                  {rejection.course.title} — {rejection.reason}
                </li>
              ))}
            </ul>
          </details>
          .
        </p>
      )}

      {sortMode !== 'recommended' && (
        <p className="text-[0.8125rem] text-ink-muted">
          Promoted placements are hidden in explicit sort modes.
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFiltersChange(chip.reset)}
              className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[0.75rem] font-medium text-accent-strong hover:bg-accent hover:text-white"
            >
              {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
