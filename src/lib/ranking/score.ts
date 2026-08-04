/**
 * Weighted composition. docs/01-ranking-algorithm.md §2, PRD §5.6
 *
 *   Score = 0.35·Quality + 0.20·Outcome + 0.20·Popularity
 *         + 0.15·Freshness + 0.10·Fit
 *
 * over the *percentiles*, not the raw factor values.
 */

import { FACTOR_KEYS } from './constants';
import type { FactorKey, NormalisationBasis, ScoreExplanation, Weights } from './types';

export interface NormaliseWeightsOptions {
  /** Raw slider values. The Ranking Lab shows their sum live while dragging. */
  readonly weights: Weights;
  /**
   * Factors switched off in the Ranking Lab. A disabled factor's weight is
   * **dropped, not redistributed** (PRD §5.6): the maximum attainable score
   * falls accordingly and the panel says so. Redistributing would confound two
   * changes — the factor leaving and the others growing — and make the toggle
   * impossible to interpret.
   */
  readonly disabledFactors: readonly FactorKey[];
}

export interface NormalisedWeights {
  /** Normalised to sum 1 across all five, then zeroed for disabled factors. */
  readonly normalised: Weights;
  /** Sum of the raw slider values, shown next to the normalised set. */
  readonly rawSum: number;
  /** Sum of the applied weights: below 1 whenever a factor is disabled. */
  readonly maxAttainableScore: number;
}

export function normaliseWeights(options: NormaliseWeightsOptions): NormalisedWeights {
  const { weights, disabledFactors } = options;
  const disabled = new Set(disabledFactors);
  const rawSum = FACTOR_KEYS.reduce((acc, key) => acc + weights[key], 0);

  // Every factor's share of the raw sum, as if none were disabled — this is
  // the share that is *dropped* (not redistributed) for a disabled factor.
  const shareOfRawSum = (key: FactorKey): number => (rawSum === 0 ? 0 : weights[key] / rawSum);

  let maxAttainableScore = 0;
  const normalised = Object.fromEntries(
    FACTOR_KEYS.map((key) => {
      if (disabled.has(key)) {
        return [key, 0];
      }
      const share = shareOfRawSum(key);
      maxAttainableScore += share;
      return [key, share];
    }),
  ) as Weights;

  return { normalised, rawSum, maxAttainableScore };
}

export interface ComposeScoreOptions {
  readonly raws: Readonly<Record<FactorKey, number>>;
  readonly percentiles: Readonly<Record<FactorKey, number>>;
  /** Raw slider values; normalisation happens inside. */
  readonly weights: Weights;
  readonly disabledFactors: readonly FactorKey[];
  readonly normalisationBasis: NormalisationBasis;
  readonly basisSize: number;
}

/**
 * The score together with everything the Score Inspector needs to explain it.
 * CLAUDE.md: the UI renders this and never recomputes it — one source of truth
 * for the numbers on screen.
 */
export function composeScore(options: ComposeScoreOptions): ScoreExplanation {
  const {
    raws,
    percentiles,
    weights,
    disabledFactors,
    normalisationBasis,
    basisSize,
  } = options;
  const disabled = new Set(disabledFactors);
  const { normalised, maxAttainableScore } = normaliseWeights({ weights, disabledFactors });

  const factors = FACTOR_KEYS.map((key) => {
    const weight = normalised[key];
    const percentile = percentiles[key];
    return {
      factor: key,
      raw: raws[key],
      percentile,
      weight,
      contribution: weight * percentile,
      enabled: !disabled.has(key),
    };
  });

  const score = factors.reduce((acc, factor) => acc + factor.contribution, 0);

  return {
    score,
    maxAttainableScore,
    factors,
    rawWeights: weights,
    normalisedWeights: normalised,
    normalisationBasis,
    basisSize,
  };
}
