import { describe, expect, it } from 'vitest';

import { DEFAULT_TOGGLES, DEFAULT_WEIGHTS, WEIGHT_PRESETS } from './constants';
import { isDefaultRankingConfig } from './config-diff';

describe('isDefaultRankingConfig', () => {
  it('is true for the Balanced defaults', () => {
    expect(isDefaultRankingConfig(DEFAULT_WEIGHTS, DEFAULT_TOGGLES)).toBe(true);
  });

  it('is false when weights differ, e.g. the Popularity-led preset', () => {
    expect(isDefaultRankingConfig(WEIGHT_PRESETS['popularity-led'], DEFAULT_TOGGLES)).toBe(false);
  });

  it('is false when a single toggle differs', () => {
    expect(
      isDefaultRankingConfig(DEFAULT_WEIGHTS, { ...DEFAULT_TOGGLES, shrinkage: false }),
    ).toBe(false);
  });
});
