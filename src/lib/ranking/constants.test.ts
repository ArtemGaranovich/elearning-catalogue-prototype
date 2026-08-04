import { describe, expect, it } from 'vitest';

import {
  DATASET_AS_OF,
  DEFAULT_WEIGHTS,
  FACTOR_KEYS,
  FRESHNESS_TAU_DAYS,
  OUTCOME_WEIGHTS,
  PROMO_BAND_MAX,
  SHRINKAGE_M,
  WEIGHT_PRESETS,
} from './constants';
import type { FactorKey, Weights } from './types';

function sum(weights: Weights): number {
  return FACTOR_KEYS.reduce((total, key) => total + weights[key], 0);
}

describe('ranking constants', () => {
  it('freezes "today" at the dataset date, so planted cases cannot decay', () => {
    // docs/02-dataset-spec.md §1. If this moves, every freshness percentile and
    // the promo 24-month condition shift with it.
    expect(DATASET_AS_OF).toBe('2026-08-01');
  });

  it('uses the documented factor parameters', () => {
    // docs/01-ranking-algorithm.md §3.1, §3.4
    expect(SHRINKAGE_M).toBe(50);
    expect(FRESHNESS_TAU_DAYS).toBe(540);
  });

  it('covers all five factors exactly once', () => {
    // docs/01-ranking-algorithm.md §2
    const expected: readonly FactorKey[] = ['quality', 'outcome', 'popularity', 'freshness', 'fit'];
    expect([...FACTOR_KEYS]).toEqual([...expected]);
    expect(new Set(FACTOR_KEYS).size).toBe(FACTOR_KEYS.length);
  });

  it('gives every weight preset a raw sum of 1', () => {
    // PRD §5.6. The presets are authored already-normalised; the Ranking Lab
    // normalises arbitrary slider values, but a preset that did not sum to 1
    // would silently change the attainable maximum.
    for (const [name, weights] of Object.entries(WEIGHT_PRESETS)) {
      expect(sum(weights), `preset ${name}`).toBeCloseTo(1, 10);
    }
  });

  it('defaults to the Balanced preset', () => {
    // PRD §7, criterion 1
    expect(DEFAULT_WEIGHTS).toEqual(WEIGHT_PRESETS.balanced);
    expect(DEFAULT_WEIGHTS.quality).toBe(0.35);
  });

  it('makes Quality the largest weight without letting it decide alone', () => {
    // docs/01-ranking-algorithm.md §2: Quality at 0.35 cannot by itself put a
    // course first — the other four together outweigh it.
    const quality = WEIGHT_PRESETS.balanced.quality;
    expect(quality).toBeGreaterThan(0.5 - quality);
    expect(quality).toBeLessThan(0.5);
  });

  it('sums the Outcome sub-weights to 1', () => {
    // docs/01-ranking-algorithm.md §3.2
    const total =
      OUTCOME_WEIGHTS.completionRate +
      OUTCOME_WEIGHTS.medianWatchPercent +
      OUTCOME_WEIGHTS.inverseRefundRate;
    expect(total).toBeCloseTo(1, 10);
  });

  it('caps the promoted band at 2', () => {
    // docs/01-ranking-algorithm.md §7.2.1 — under 20% of a 12-result page.
    expect(PROMO_BAND_MAX).toBe(2);
  });
});
