import type { ReactNode } from 'react';

import {
  FACTOR_KEYS,
  FACTOR_LABELS,
  WEIGHT_PRESET_LABELS,
  WEIGHT_PRESETS,
  WEIGHT_SLIDER,
} from '@/lib/ranking/constants';
import { normaliseWeights } from '@/lib/ranking/score';
import type { FactorKey, RankingToggles, WeightPresetName, Weights } from '@/lib/ranking/types';

interface ToggleSpec {
  readonly key: keyof RankingToggles;
  readonly label: string;
  /** Shown whenever the toggle is switched off — what turning it off costs. */
  readonly cost: string;
}

const TOGGLE_SPECS: readonly ToggleSpec[] = [
  {
    key: 'shrinkage',
    label: 'Bayesian shrinkage',
    cost: 'Ratings are used as-is — a 5.00 from a handful of reviews outranks an established course.',
  },
  {
    key: 'outcomeFactor',
    label: 'Outcome factor',
    cost: 'Completion and refund signals are dropped — the weight is not redistributed, so the maximum attainable score falls.',
  },
  {
    key: 'diversityCap',
    label: 'Diversity cap',
    cost: 'A single prolific instructor can fill more than 2 of the top 10 slots.',
  },
  {
    key: 'promoInjection',
    label: 'Promo injection',
    cost: 'No promoted placements are shown, even in Recommended mode.',
  },
  {
    key: 'promoQualityGate',
    label: 'Promo quality gate',
    cost: 'Sponsored and Featured courses can take a slot without independently passing the quality check.',
  },
];

export interface RankingLabProps {
  readonly weights: Weights;
  readonly toggles: RankingToggles;
  readonly onWeightsChange: (weights: Weights) => void;
  readonly onToggleChange: (key: keyof RankingToggles) => void;
  readonly onPresetSelect: (preset: WeightPresetName) => void;
  readonly onReset: () => void;
  readonly onCopyLink: () => void;
  readonly copyFeedback: string | null;
}

export function RankingLab({
  weights,
  toggles,
  onWeightsChange,
  onToggleChange,
  onPresetSelect,
  onReset,
  onCopyLink,
  copyFeedback,
}: RankingLabProps): ReactNode {
  const disabledFactors: readonly FactorKey[] = toggles.outcomeFactor ? [] : ['outcome'];
  const { normalised, rawSum, maxAttainableScore } = normaliseWeights({ weights, disabledFactors });

  function setWeight(factor: FactorKey, value: number): void {
    onWeightsChange({ ...weights, [factor]: value });
  }

  return (
    <details open className="group rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span
              aria-hidden
              className="inline-block text-ink-subtle transition-transform group-open:rotate-180"
            >
              ▾
            </span>
            Ranking Lab
          </span>
          <span className="text-[0.75rem] text-ink-subtle">weights, toggles, presets</span>
        </div>
      </summary>

      <div className="space-y-5 border-t border-border px-5 py-5">
        <div>
          <p className="mb-2 text-[0.75rem] font-semibold tracking-wide text-ink-subtle uppercase">
            Presets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(WEIGHT_PRESETS) as WeightPresetName[]).map((preset) => {
              const active = FACTOR_KEYS.every(
                (key) => Math.abs(weights[key] - WEIGHT_PRESETS[preset][key]) < 1e-9,
              );
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onPresetSelect(preset)}
                  className={`rounded-full px-3 py-1 text-[0.75rem] font-medium ${
                    active
                      ? 'bg-accent text-white'
                      : 'bg-canvas text-ink-muted ring-1 ring-inset ring-border hover:text-ink'
                  }`}
                >
                  {WEIGHT_PRESET_LABELS[preset]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[0.75rem] font-semibold tracking-wide text-ink-subtle uppercase">
              Weights
            </p>
            <p className="tnum text-[0.75rem] text-ink-subtle">
              raw sum {rawSum.toFixed(2)} → normalised to 1.00
            </p>
          </div>
          <div className="space-y-3">
            {FACTOR_KEYS.map((factor) => (
              <label key={factor} className="block">
                <div className="mb-1 flex items-baseline justify-between text-[0.8125rem]">
                  <span className="font-medium text-ink">{FACTOR_LABELS[factor]}</span>
                  <span className="tnum text-ink-subtle">
                    raw {weights[factor].toFixed(2)} · normalised {normalised[factor].toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={WEIGHT_SLIDER.min}
                  max={WEIGHT_SLIDER.max}
                  step={WEIGHT_SLIDER.step}
                  value={weights[factor]}
                  disabled={factor === 'outcome' && !toggles.outcomeFactor}
                  onChange={(event) => setWeight(factor, Number(event.target.value))}
                  className="w-full accent-[var(--color-accent)] disabled:opacity-40"
                  style={{ accentColor: `var(--color-factor-${factor})` }}
                />
              </label>
            ))}
          </div>
          <p className="tnum mt-2 text-[0.8125rem] text-ink-muted">
            Max attainable score with current toggles:{' '}
            <span className="font-medium text-ink">{maxAttainableScore.toFixed(2)}</span>
            {!toggles.outcomeFactor && ' (Outcome disabled — its weight is dropped, not redistributed)'}
          </p>
        </div>

        <div>
          <p className="mb-2 text-[0.75rem] font-semibold tracking-wide text-ink-subtle uppercase">
            Toggles
          </p>
          <div className="space-y-2.5">
            {TOGGLE_SPECS.map((spec) => (
              <div key={spec.key}>
                <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
                  <input
                    type="checkbox"
                    checked={toggles[spec.key]}
                    onChange={() => onToggleChange(spec.key)}
                    className="size-3.5 accent-[var(--color-accent)]"
                  />
                  {spec.label}
                </label>
                {!toggles[spec.key] && (
                  <p className="mt-0.5 ml-6 text-[0.75rem] text-amber-800">{spec.cost}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-border px-3 py-1.5 text-[0.8125rem] font-medium text-ink-muted hover:bg-canvas"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            className="rounded-md bg-accent px-3 py-1.5 text-[0.8125rem] font-medium text-white hover:bg-accent-strong"
          >
            Copy link to this configuration
          </button>
          {copyFeedback !== null && (
            <span className="text-[0.75rem] text-ink-subtle" role="status">
              {copyFeedback}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
