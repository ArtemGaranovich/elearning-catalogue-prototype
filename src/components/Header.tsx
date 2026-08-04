import type { ReactNode } from 'react';

import type { CategoryId } from '@/data/categories';

import { CategoryTabs } from './CategoryTabs';

export interface HeaderProps {
  readonly categoryId: CategoryId;
  readonly onCategorySelect: (categoryId: CategoryId) => void;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
}

export function Header({ categoryId, onCategorySelect, query, onQueryChange }: HeaderProps): ReactNode {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-medium tracking-widest text-ink-subtle uppercase">
              Course Catalogue
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Ranking Prototype</h1>
          </div>
          <a
            href="#how-ranking-works"
            className="text-[0.8125rem] font-medium text-accent hover:text-accent-strong"
          >
            How ranking works
          </a>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CategoryTabs activeCategoryId={categoryId} onSelect={onCategorySelect} />

          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search courses</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search titles, tags…"
              className="w-full rounded-full border border-border bg-canvas px-3.5 py-1.5 text-[0.8125rem] text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      </div>
    </header>
  );
}
