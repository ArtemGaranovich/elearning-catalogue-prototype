'use client';

/**
 * The UI-level home for `viewMode` (docs/04-build-brief.md Phase 6, step 1).
 *
 * `ViewConfig.viewMode` (url-state.ts) is the source of truth; this context
 * exists so the components several layers below `page.tsx` — `CourseCard`,
 * `SortSelect`, `Toolbar` — can read the current mode without it being
 * threaded through every prop list in between. It is deliberately read-only:
 * the setter lives in `page.tsx` (via `useViewConfig`) and is passed to
 * `Header` explicitly, since `Header` is the only component that changes the
 * mode rather than merely rendering differently because of it.
 *
 * `lib/ranking/` never imports from here — that is the whole point.
 */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { ViewMode } from '@/lib/url-state';

const ViewModeContext = createContext<ViewMode>('demo');

export function ViewModeProvider({
  viewMode,
  children,
}: {
  readonly viewMode: ViewMode;
  readonly children: ReactNode;
}): ReactNode {
  return <ViewModeContext.Provider value={viewMode}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewMode {
  return useContext(ViewModeContext);
}
