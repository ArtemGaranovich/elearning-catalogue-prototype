/**
 * Criterion 13: copying the URL into a fresh tab reproduces the view exactly.
 * These tests check the round trip directly, without a browser.
 */
import { describe, expect, it } from 'vitest';

import { HERO_CATEGORY_ID } from '@/data/categories';
import { WEIGHT_PRESETS } from '@/lib/ranking/constants';
import type { ViewConfig } from '@/lib/url-state';
import { DEFAULT_VIEW_CONFIG, parseViewConfig, serialiseViewConfig } from '@/lib/url-state';

describe('default view', () => {
  it('serialises to an empty query string', () => {
    expect(serialiseViewConfig(DEFAULT_VIEW_CONFIG)).toBe('');
  });

  it('parsing an empty search string returns the default config', () => {
    expect(parseViewConfig('')).toEqual(DEFAULT_VIEW_CONFIG);
  });
});

describe('round trip', () => {
  const customConfig: ViewConfig = {
    viewMode: 'user',
    categoryId: 'cybersecurity',
    filters: {
      subcategoryIds: ['ethical-hacking', 'cloud-security'],
      minAdjustedRating: 4.5,
      levels: ['advanced'],
      durationBuckets: ['5to15', '15to30'],
      priceMode: 'paid',
      maxPrice: 150,
      languages: ['en', 'de'],
      certificateOnly: true,
      updatedWithinMonths: 12,
      instructorIds: ['i-01', 'i-07'],
      query: 'kubernetes security',
    },
    sortMode: 'highest-rated',
    weights: WEIGHT_PRESETS['popularity-led'],
    toggles: {
      shrinkage: false,
      outcomeFactor: true,
      diversityCap: false,
      promoInjection: true,
      promoQualityGate: false,
    },
    page: 3,
    all: true,
    focus: 'c-060',
  };

  it('reproduces a fully customised config exactly', () => {
    const roundTripped = parseViewConfig(serialiseViewConfig(customConfig));
    expect(roundTripped).toEqual(customConfig);
  });

  it('serialise → parse → serialise is idempotent', () => {
    const once = serialiseViewConfig(customConfig);
    const twice = serialiseViewConfig(parseViewConfig(once));
    expect(twice).toBe(once);
  });
});

describe('malformed input falls back per field, never throws', () => {
  it('an unknown category falls back to the hero category alone', () => {
    const config = parseViewConfig('?cat=not-a-real-category&sort=newest');
    expect(config.categoryId).toBe(HERO_CATEGORY_ID);
    expect(config.sortMode).toBe('newest');
  });

  it('a garbled weights string falls back to the default weights', () => {
    const config = parseViewConfig('?w=nonsense&cat=web-dev');
    expect(config.weights).toEqual(DEFAULT_VIEW_CONFIG.weights);
    expect(config.categoryId).toBe('web-dev');
  });

  it('an out-of-range page falls back to page 1', () => {
    expect(parseViewConfig('?page=0').page).toBe(1);
    expect(parseViewConfig('?page=-3').page).toBe(1);
    expect(parseViewConfig('?page=abc').page).toBe(1);
  });

  it('unknown toggle keys in `off` are ignored', () => {
    const config = parseViewConfig('?off=shrinkage,not-a-toggle');
    expect(config.toggles.shrinkage).toBe(false);
    expect(config.toggles.outcomeFactor).toBe(true);
  });

  it('an invalid min-rating option falls back to "any"', () => {
    expect(parseViewConfig('?rating=9.9').filters.minAdjustedRating).toBe(0);
  });

  it('an unknown view mode falls back to demo', () => {
    expect(parseViewConfig('?view=reviewer').viewMode).toBe('demo');
    expect(parseViewConfig('?view=user').viewMode).toBe('user');
  });

  it('a focus id not present in the dataset falls back to null', () => {
    expect(parseViewConfig('?focus=not-a-real-course').focus).toBeNull();
    expect(parseViewConfig('?focus=c-060').focus).toBe('c-060');
  });
});
