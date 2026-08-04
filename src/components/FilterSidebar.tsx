import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { getCategory } from '@/data/categories';
import type { CategoryId } from '@/data/categories';
import type { FilterCounts, FilterOptionCount } from '@/lib/ranking/filters';
import {
  DEFAULT_FILTERS,
  DURATION_BUCKETS,
  LANGUAGE_LABELS,
  LANGUAGES,
  LEVELS,
  MIN_RATING_OPTIONS,
  UPDATED_WITHIN_OPTIONS,
} from '@/lib/ranking/constants';
import type {
  DurationBucket,
  FilterState,
  Instructor,
  Language,
  Level,
} from '@/lib/ranking/types';

const LEVEL_LABELS: Readonly<Record<Level, string>> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export interface FilterSidebarProps {
  readonly categoryId: CategoryId;
  readonly filters: FilterState;
  readonly counts: FilterCounts;
  readonly instructors: readonly Instructor[];
  readonly priceBoundMax: number;
  readonly onChange: (patch: Partial<FilterState>) => void;
}

function toggle<T>(list: readonly T[], value: T): readonly T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function countMap(options: readonly FilterOptionCount[]): Map<string, FilterOptionCount> {
  return new Map(options.map((o) => [o.value, o]));
}

function isSidebarDefault(filters: FilterState): boolean {
  return (
    filters.subcategoryIds.length === 0 &&
    filters.minAdjustedRating === DEFAULT_FILTERS.minAdjustedRating &&
    filters.levels.length === 0 &&
    filters.durationBuckets.length === 0 &&
    filters.priceMode === DEFAULT_FILTERS.priceMode &&
    filters.maxPrice === DEFAULT_FILTERS.maxPrice &&
    filters.languages.length === 0 &&
    !filters.certificateOnly &&
    filters.updatedWithinMonths === DEFAULT_FILTERS.updatedWithinMonths &&
    filters.instructorIds.length === 0
  );
}

function FacetGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <fieldset className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <legend className="mb-2.5 text-[0.8125rem] font-semibold text-ink">{title}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function OptionLabel({
  checked,
  disabled,
  count,
  label,
  onChange,
  type,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly count: number;
  readonly label: string;
  readonly onChange: () => void;
  readonly type: 'checkbox' | 'radio';
}): ReactNode {
  return (
    <label
      className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[0.8125rem] ${
        disabled ? 'cursor-not-allowed text-ink-subtle opacity-50' : 'cursor-pointer text-ink-muted hover:text-ink'
      }`}
    >
      <span className="flex items-center gap-2">
        <input
          type={type}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="size-3.5 accent-[var(--color-accent)]"
        />
        {label}
      </span>
      <span className="tnum text-[0.75rem] text-ink-subtle">{count}</span>
    </label>
  );
}

export function FilterSidebar({
  categoryId,
  filters,
  counts,
  instructors,
  priceBoundMax,
  onChange,
}: FilterSidebarProps): ReactNode {
  const [instructorQuery, setInstructorQuery] = useState('');
  const category = getCategory(categoryId);
  const instructorById = useMemo(() => new Map(instructors.map((i) => [i.id, i])), [instructors]);

  const subcategoryCounts = countMap(counts.subcategory);
  const ratingCounts = countMap(counts.minAdjustedRating);
  const levelCounts = countMap(counts.level);
  const durationCounts = countMap(counts.duration);
  const priceCounts = countMap(counts.price);
  const languageCounts = countMap(counts.language);
  const certificateCount = counts.certificate[0];
  const updatedCounts = countMap(counts.updatedWithin);

  const filteredInstructorOptions = counts.instructor
    .map((option) => ({ option, instructor: instructorById.get(option.value) }))
    .filter(({ instructor }) => instructor !== undefined)
    .filter(({ instructor }) =>
      instructor!.name.toLowerCase().includes(instructorQuery.trim().toLowerCase()),
    );

  return (
    <aside aria-label="Filters" className="w-full shrink-0 sm:w-64">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Filters</h2>
        {!isSidebarDefault(filters) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-[0.75rem] font-medium text-accent hover:text-accent-strong"
          >
            Clear all
          </button>
        )}
      </div>

      <FacetGroup title="Subcategory">
        {category.subcategories.map((sub) => {
          const c = subcategoryCounts.get(sub.id);
          return (
            <OptionLabel
              key={sub.id}
              type="checkbox"
              label={sub.name}
              checked={filters.subcategoryIds.includes(sub.id)}
              disabled={c === undefined || (c.disabled && !filters.subcategoryIds.includes(sub.id))}
              count={c?.count ?? 0}
              onChange={() =>
                onChange({ subcategoryIds: toggle(filters.subcategoryIds, sub.id) })
              }
            />
          );
        })}
      </FacetGroup>

      <FacetGroup title="Minimum rating (adjusted)">
        {MIN_RATING_OPTIONS.map((option) => {
          const c = ratingCounts.get(String(option));
          return (
            <OptionLabel
              key={option}
              type="radio"
              label={option === 0 ? 'Any' : `${option}+`}
              checked={filters.minAdjustedRating === option}
              disabled={(c?.disabled ?? true) && filters.minAdjustedRating !== option}
              count={c?.count ?? 0}
              onChange={() => onChange({ minAdjustedRating: option })}
            />
          );
        })}
      </FacetGroup>

      <FacetGroup title="Level">
        {LEVELS.map((level) => {
          const c = levelCounts.get(level);
          return (
            <OptionLabel
              key={level}
              type="checkbox"
              label={LEVEL_LABELS[level]}
              checked={filters.levels.includes(level)}
              disabled={c === undefined || (c.disabled && !filters.levels.includes(level))}
              count={c?.count ?? 0}
              onChange={() => onChange({ levels: toggle(filters.levels, level) as readonly Level[] })}
            />
          );
        })}
      </FacetGroup>

      <FacetGroup title="Duration">
        {DURATION_BUCKETS.map((bucket) => {
          const c = durationCounts.get(bucket.id);
          return (
            <OptionLabel
              key={bucket.id}
              type="checkbox"
              label={bucket.label}
              checked={filters.durationBuckets.includes(bucket.id)}
              disabled={c === undefined || (c.disabled && !filters.durationBuckets.includes(bucket.id))}
              count={c?.count ?? 0}
              onChange={() =>
                onChange({
                  durationBuckets: toggle(filters.durationBuckets, bucket.id) as readonly DurationBucket[],
                })
              }
            />
          );
        })}
      </FacetGroup>

      <FacetGroup title="Price">
        {(['any', 'free', 'paid'] as const).map((mode) => {
          const c = priceCounts.get(mode);
          return (
            <OptionLabel
              key={mode}
              type="radio"
              label={mode === 'any' ? 'Any' : mode === 'free' ? 'Free only' : 'Paid'}
              checked={filters.priceMode === mode}
              disabled={(c?.disabled ?? true) && filters.priceMode !== mode}
              count={c?.count ?? 0}
              onChange={() => onChange({ priceMode: mode })}
            />
          );
        })}
        <div className="pt-1.5">
          <label className="flex items-center justify-between text-[0.75rem] text-ink-muted">
            <span>Max price</span>
            <span className="tnum">
              {filters.maxPrice === null ? 'No limit' : `$${filters.maxPrice}`}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={priceBoundMax}
            step={5}
            value={filters.maxPrice ?? priceBoundMax}
            onChange={(event) => {
              const value = Number(event.target.value);
              onChange({ maxPrice: value >= priceBoundMax ? null : value });
            }}
            className="mt-1 w-full accent-[var(--color-accent)]"
          />
        </div>
      </FacetGroup>

      <FacetGroup title="Language">
        {LANGUAGES.map((language) => {
          const c = languageCounts.get(language);
          return (
            <OptionLabel
              key={language}
              type="checkbox"
              label={LANGUAGE_LABELS[language]}
              checked={filters.languages.includes(language)}
              disabled={c === undefined || (c.disabled && !filters.languages.includes(language))}
              count={c?.count ?? 0}
              onChange={() =>
                onChange({ languages: toggle(filters.languages, language) as readonly Language[] })
              }
            />
          );
        })}
      </FacetGroup>

      <FacetGroup title="Certificate">
        <OptionLabel
          type="checkbox"
          label="Certificate included"
          checked={filters.certificateOnly}
          disabled={certificateCount === undefined ? true : certificateCount.disabled && !filters.certificateOnly}
          count={certificateCount?.count ?? 0}
          onChange={() => onChange({ certificateOnly: !filters.certificateOnly })}
        />
      </FacetGroup>

      <FacetGroup title="Updated within">
        {UPDATED_WITHIN_OPTIONS.map((option) => {
          const c = updatedCounts.get(String(option));
          return (
            <OptionLabel
              key={option}
              type="radio"
              label={option === 0 ? 'Any time' : `${option} months`}
              checked={filters.updatedWithinMonths === option}
              disabled={(c?.disabled ?? true) && filters.updatedWithinMonths !== option}
              count={c?.count ?? 0}
              onChange={() => onChange({ updatedWithinMonths: option })}
            />
          );
        })}
      </FacetGroup>

      <FacetGroup title="Instructor">
        <input
          type="text"
          value={instructorQuery}
          onChange={(event) => setInstructorQuery(event.target.value)}
          placeholder="Search instructors…"
          className="mb-2 w-full rounded border border-border bg-canvas px-2 py-1 text-[0.75rem] text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {filteredInstructorOptions.map(({ option, instructor }) => (
            <OptionLabel
              key={option.value}
              type="checkbox"
              label={instructor!.name}
              checked={filters.instructorIds.includes(option.value)}
              disabled={option.disabled && !filters.instructorIds.includes(option.value)}
              count={option.count}
              onChange={() =>
                onChange({ instructorIds: toggle(filters.instructorIds, option.value) })
              }
            />
          ))}
          {filteredInstructorOptions.length === 0 && (
            <p className="px-1 text-[0.75rem] text-ink-subtle">No instructors match.</p>
          )}
        </div>
      </FacetGroup>
    </aside>
  );
}
