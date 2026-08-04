'use client';

/**
 * FLIP reordering for the course list (docs/04-build-brief.md Phase 4:
 * "reordering only, ~300ms, respecting prefers-reduced-motion. No decorative
 * animation anywhere else"). Seeing the 5.00-rated course climb six or more
 * positions when shrinkage is switched off is the strongest single moment in
 * the demo (PRD §5.6) — this is what makes that visible as motion rather than
 * a silent list swap.
 *
 * Elements are matched across renders by a `data-flip-id` attribute inside
 * `containerRef`. Call again whenever `orderKey` (e.g. the joined list of ids
 * in their new order) changes.
 */
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

const ANIMATION_MS = 300;

export function useFlipAnimation(containerRef: RefObject<HTMLElement | null>, orderKey: string): void {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-id]'));
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      for (const item of items) {
        const id = item.dataset.flipId;
        if (id === undefined) continue;
        const previous = prevRects.current.get(id);
        if (previous === undefined) continue;

        const current = item.getBoundingClientRect();
        const deltaX = previous.left - current.left;
        const deltaY = previous.top - current.top;
        if (deltaX === 0 && deltaY === 0) continue;

        item.style.transition = 'none';
        item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        // Force a reflow so the browser commits the pre-transform position
        // before the transition below is applied.
        item.getBoundingClientRect();

        requestAnimationFrame(() => {
          item.style.transition = `transform ${ANIMATION_MS}ms ease`;
          item.style.transform = '';
        });

        item.addEventListener(
          'transitionend',
          () => {
            item.style.transition = '';
          },
          { once: true },
        );
      }
    }

    const nextRects = new Map<string, DOMRect>();
    for (const item of items) {
      const id = item.dataset.flipId;
      if (id !== undefined) {
        nextRects.set(id, item.getBoundingClientRect());
      }
    }
    prevRects.current = nextRects;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on orderKey by design
  }, [orderKey]);
}
