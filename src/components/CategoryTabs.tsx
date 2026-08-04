import type { ReactNode } from 'react';

import { CATEGORIES } from '@/data/categories';
import type { CategoryId } from '@/data/categories';

export interface CategoryTabsProps {
  readonly activeCategoryId: CategoryId;
  readonly onSelect: (categoryId: CategoryId) => void;
}

/**
 * Six categories, one always active (PRD §5.1). Switching category resets
 * pagination and the subcategory filter — which is category-scoped and
 * cannot apply across the switch — but preserves sort mode and every other
 * filter.
 */
export function CategoryTabs({ activeCategoryId, onSelect }: CategoryTabsProps): ReactNode {
  return (
    <div role="tablist" aria-label="Category" className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((category) => {
        const active = category.id === activeCategoryId;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(category.id)}
            className={`rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              active
                ? 'bg-accent text-white'
                : 'bg-surface text-ink-muted ring-1 ring-inset ring-border hover:bg-accent-soft hover:text-accent-strong'
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
