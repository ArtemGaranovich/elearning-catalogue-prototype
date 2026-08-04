'use client';

/**
 * The `D` shortcut (PRD §5.7): "since the Loom recording flips modes
 * repeatedly." Ignores keystrokes while the user is typing into a text
 * field (the search box, the instructor filter) or holding a modifier —
 * `Ctrl+D` / `Cmd+D` are browser bookmark shortcuts and must not be hijacked.
 */
import { useEffect } from 'react';

import type { ViewMode } from '@/lib/url-state';

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return TEXT_INPUT_TAGS.has(target.tagName) || target.isContentEditable;
}

export function useViewModeShortcut(viewMode: ViewMode, onChange: (mode: ViewMode) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== 'd') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      onChange(viewMode === 'demo' ? 'user' : 'demo');
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, onChange]);
}
