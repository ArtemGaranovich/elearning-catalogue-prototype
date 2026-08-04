/**
 * PRD §5.7 — the invariant that makes the view-mode toggle worth building:
 *
 *   The ordered list of course ids is identical in both modes for the same
 *   configuration.
 *
 * Written before the toggle UI (docs/04-build-brief.md Phase 6), per that
 * phase's instruction, precisely because the type system already guarantees
 * it: `toRankOptions` (rank-request.ts) never reads `config.viewMode`, and
 * `RankOptions` (pipeline.ts) has no `viewMode` field to receive it even if
 * it tried (see view-mode-isolation.test.ts for the compile-time half of
 * this guarantee). This test exercises the actual conversion function the UI
 * calls, so a future regression — someone branching on `config.viewMode`
 * inside `toRankOptions` — would fail it even though it can no longer
 * reach the ranking engine itself.
 *
 * Acceptance criterion 18: covered by an automated test, not only by eye,
 * for at least three configurations — defaults, a filtered view, and the
 * Popularity-led preset.
 */
import { describe, expect, it } from 'vitest';

import coursesData from '@/data/courses.json';

import { toRankOptions } from './rank-request';
import { DATASET_AS_OF, DEFAULT_FILTERS, WEIGHT_PRESETS } from './ranking/constants';
import { rank } from './ranking/pipeline';
import type { Course } from './ranking/types';
import { DEFAULT_VIEW_CONFIG } from './url-state';
import type { ViewConfig } from './url-state';

const courses = coursesData as unknown as readonly Course[];

/** Every result across the whole category, in final order — page boundaries are not the point of this test. */
function fullOrderIds(config: ViewConfig): readonly string[] {
  const result = rank(
    toRankOptions({ config, courses, asOfIsoDate: DATASET_AS_OF, ignorePagination: true }),
  );
  return result.results.map((r) => r.course.id);
}

const CONFIGS: Readonly<Record<string, ViewConfig>> = {
  defaults: DEFAULT_VIEW_CONFIG,
  'a filtered view': {
    ...DEFAULT_VIEW_CONFIG,
    filters: { ...DEFAULT_FILTERS, levels: ['beginner', 'intermediate'], certificateOnly: true },
  },
  'the Popularity-led preset': {
    ...DEFAULT_VIEW_CONFIG,
    weights: WEIGHT_PRESETS['popularity-led'],
  },
};

describe('view mode equality (PRD §5.7, acceptance criterion 18)', () => {
  for (const [name, base] of Object.entries(CONFIGS)) {
    it(`produces an identical course-id order in Demo and User view — ${name}`, () => {
      const demo: ViewConfig = { ...base, viewMode: 'demo' };
      const user: ViewConfig = { ...base, viewMode: 'user' };

      const demoOrder = fullOrderIds(demo);
      const userOrder = fullOrderIds(user);

      expect(demoOrder.length).toBeGreaterThan(0);
      expect(userOrder).toEqual(demoOrder);
    });
  }

  it('also holds across a paginated (non-"show all") read', () => {
    const demo: ViewConfig = { ...DEFAULT_VIEW_CONFIG, viewMode: 'demo' };
    const user: ViewConfig = { ...DEFAULT_VIEW_CONFIG, viewMode: 'user' };

    const demoPage = rank(toRankOptions({ config: demo, courses, asOfIsoDate: DATASET_AS_OF }));
    const userPage = rank(toRankOptions({ config: user, courses, asOfIsoDate: DATASET_AS_OF }));

    expect(userPage.results.map((r) => r.course.id)).toEqual(
      demoPage.results.map((r) => r.course.id),
    );
    expect(userPage.meta).toEqual(demoPage.meta);
  });
});
