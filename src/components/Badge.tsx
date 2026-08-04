import type { ReactNode } from 'react';

import type { BadgeKind } from '@/lib/badges';

const BADGE_STYLES: Readonly<Record<BadgeKind, string>> = {
  free: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  certificate: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  sponsored: 'bg-amber-50 text-amber-900 ring-amber-600/30',
  featured: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  new: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20',
};

export function Badge({ kind, label }: { readonly kind: BadgeKind; readonly label: string }): ReactNode {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset ${BADGE_STYLES[kind]}`}
    >
      {label}
    </span>
  );
}
