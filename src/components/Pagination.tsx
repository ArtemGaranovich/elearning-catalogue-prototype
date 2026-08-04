import type { ReactNode } from 'react';

export interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps): ReactNode {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 py-4">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md px-2.5 py-1.5 text-[0.8125rem] text-ink-muted hover:bg-canvas disabled:opacity-40"
      >
        Previous
      </button>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPageChange(p)}
          className={`tnum size-8 rounded-md text-[0.8125rem] font-medium ${
            p === page ? 'bg-accent text-white' : 'text-ink-muted hover:bg-canvas'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className="rounded-md px-2.5 py-1.5 text-[0.8125rem] text-ink-muted hover:bg-canvas disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
