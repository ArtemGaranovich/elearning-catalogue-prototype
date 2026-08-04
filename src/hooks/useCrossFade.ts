'use client';

/**
 * A ~250 ms cross-fade whenever `dependency` changes (PRD §5.7: "Transition
 * is a ~250 ms cross-fade with the card grid settling into its new layout,
 * not a reload"). Respects `prefers-reduced-motion` by skipping the fade
 * entirely rather than shortening it — same policy as `useFlipAnimation`.
 *
 * Returns a className to apply to the fading container. Follows React's
 * "adjusting state when a prop changes" pattern: `trackedDependency` is
 * compared to `dependency` during render, and both state updates happen
 * there rather than in an effect, so the opacity drop lands in the same
 * commit as the dependency change — no flash of the old content, and no ref
 * access or setState call inside an effect body.
 */
import { useEffect, useState } from 'react';

export function useCrossFade(dependency: unknown): string {
  const [trackedDependency, setTrackedDependency] = useState(dependency);
  const [fading, setFading] = useState(false);

  if (dependency !== trackedDependency) {
    setTrackedDependency(dependency);
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      setFading(true);
    }
  }

  useEffect(() => {
    if (!fading) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => setFading(false));
    return () => cancelAnimationFrame(frame);
  }, [fading]);

  return fading
    ? 'opacity-0 transition-none'
    : 'opacity-100 transition-opacity duration-[250ms] ease-out';
}
