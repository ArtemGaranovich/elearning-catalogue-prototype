/**
 * CLAUDE.md / PRD §5.7: "The view mode never reaches the ranking layer."
 * `viewMode` must be structurally impossible to pass into `pipeline.ts` —
 * enforced by the compiler, not by discipline.
 *
 * This file has no interesting runtime assertions. The guard is the
 * `@ts-expect-error` below, checked by `tsc --noEmit` (`npm run typecheck`,
 * part of `npm run verify`): if `RankOptions` ever grows a `viewMode` field,
 * the directive stops suppressing an error and the typecheck fails.
 */
import { describe, expect, it } from 'vitest';

import { HERO_CATEGORY_ID } from '@/data/categories';

import { DATASET_AS_OF, DEFAULT_FILTERS, DEFAULT_TOGGLES, WEIGHT_PRESETS } from './constants';
import type { RankOptions } from './pipeline';

describe('viewMode cannot reach the ranking layer', () => {
  it('RankOptions has no viewMode field', () => {
    const base: RankOptions = {
      courses: [],
      categoryId: HERO_CATEGORY_ID,
      filters: DEFAULT_FILTERS,
      sortMode: 'recommended',
      weights: WEIGHT_PRESETS.balanced,
      toggles: DEFAULT_TOGGLES,
      page: 1,
      asOfIsoDate: DATASET_AS_OF,
    };

    // @ts-expect-error — viewMode is not part of RankOptions and must never become one.
    const withViewMode: RankOptions = { ...base, viewMode: 'demo' };

    expect(withViewMode.categoryId).toBe(HERO_CATEGORY_ID);
  });
});
