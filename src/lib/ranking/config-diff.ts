/**
 * Pure comparison against the Balanced defaults — no view-mode concept here,
 * just weights and toggles. Used by the "Ranking parameters modified in Demo
 * view" chip (PRD §5.7, acceptance criterion 20), which needs to know
 * whether the current Ranking Lab configuration still matches what a fresh
 * load would show.
 */
import { DEFAULT_TOGGLES, DEFAULT_WEIGHTS, FACTOR_KEYS } from './constants';
import type { RankingToggles, Weights } from './types';

const TOGGLE_KEYS: readonly (keyof RankingToggles)[] = [
  'shrinkage',
  'outcomeFactor',
  'diversityCap',
  'promoInjection',
  'promoQualityGate',
];

export function isDefaultRankingConfig(weights: Weights, toggles: RankingToggles): boolean {
  const weightsMatch = FACTOR_KEYS.every(
    (key) => Math.abs(weights[key] - DEFAULT_WEIGHTS[key]) < 1e-9,
  );
  const togglesMatch = TOGGLE_KEYS.every((key) => toggles[key] === DEFAULT_TOGGLES[key]);
  return weightsMatch && togglesMatch;
}
