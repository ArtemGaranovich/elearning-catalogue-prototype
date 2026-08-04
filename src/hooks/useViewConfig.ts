'use client';

/**
 * Bridges `ViewConfig` state to the browser URL (PRD §3, §6). This is the only
 * place the app talks to `window.history` — everything else reads and writes
 * plain `ViewConfig` objects.
 *
 * Kept out of `src/lib/` deliberately: `lib/url-state.ts` stays pure
 * parse/serialise code with no React or DOM (CLAUDE.md), and this hook is the
 * thin, impure wiring around it.
 *
 * Built on `useSyncExternalStore` rather than `useEffect` + `setState`: the
 * URL is genuinely external mutable state (browser back/forward included),
 * and `useSyncExternalStore` is what React ships for exactly this case — it
 * reconciles the server-rendered snapshot (static export never sees a query
 * string, so it is always `''`) against the real client URL right after
 * hydration, with no extra render pass and no hydration-mismatch warning.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { ViewConfig } from '@/lib/url-state';
import { DEFAULT_VIEW_CONFIG, parseViewConfig, serialiseViewConfig } from '@/lib/url-state';

export interface UpdateOptions {
  /**
   * Use `history.replaceState` instead of `pushState` — for continuous
   * controls (a slider mid-drag, a text query mid-keystroke) where every
   * intermediate value becoming a back/forward stop would make the history
   * useless. Defaults to false.
   */
  readonly replace?: boolean;
}

export interface UseViewConfigResult {
  readonly config: ViewConfig;
  readonly update: (patch: Partial<ViewConfig>, options?: UpdateOptions) => void;
  readonly reset: () => void;
}

type Listener = () => void;

// Module-level: `history.pushState`/`replaceState` fire no event of their own
// (only actual back/forward dispatches `popstate`), so `update` below has to
// tell subscribers itself after writing the URL.
const listeners = new Set<Listener>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

function getSnapshot(): string {
  return window.location.search;
}

function getServerSnapshot(): string {
  return '';
}

export function useViewConfig(): UseViewConfigResult {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const config = useMemo(() => parseViewConfig(search), [search]);

  const update = useCallback(
    (patch: Partial<ViewConfig>, options: UpdateOptions = {}) => {
      const next: ViewConfig = { ...config, ...patch };
      const nextSearch = serialiseViewConfig(next);
      if (nextSearch === window.location.search) {
        return;
      }
      const url = `${window.location.pathname}${nextSearch}`;
      if (options.replace ?? false) {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
      }
      emitChange();
    },
    [config],
  );

  const reset = useCallback(() => {
    update(DEFAULT_VIEW_CONFIG);
  }, [update]);

  return { config, update, reset };
}
