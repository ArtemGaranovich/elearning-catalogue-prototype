/**
 * The single seam between the URL/view-mode layer and the ranking engine.
 *
 * `ViewConfig` (url-state.ts) carries `viewMode`, `all` and `focus` alongside
 * the fields the ranking engine actually needs. `toRankOptions` is where that
 * gets narrowed down to `RankOptions` (pipeline.ts) — which has no `viewMode`
 * field at all (CLAUDE.md, PRD §5.7). This function destructures the fields
 * it uses explicitly and never touches `config.viewMode`, so the mode-
 * equality test (view-mode-equality.test.ts, acceptance criterion 18) can
 * call it under both modes and prove the resulting order never diverges.
 */
import type { Course } from './ranking/types';
import type { RankOptions } from './ranking/pipeline';
import type { ViewConfig } from './url-state';

export interface ToRankOptionsArgs {
  readonly config: ViewConfig;
  readonly courses: readonly Course[];
  readonly asOfIsoDate: string;
  /**
   * Forces every gated/filtered/ordered/diversified/promoted result onto one
   * page, regardless of `config.all` or `config.page` — used to resolve
   * which page a `focus` course id lands on (PRD §5.8).
   */
  readonly ignorePagination?: boolean;
}

export function toRankOptions({
  config,
  courses,
  asOfIsoDate,
  ignorePagination = false,
}: ToRankOptionsArgs): RankOptions {
  const { categoryId, filters, sortMode, weights, toggles, page, all } = config;
  return {
    courses,
    categoryId,
    filters,
    sortMode,
    weights,
    toggles,
    page: ignorePagination ? 1 : page,
    pageSize: ignorePagination || all ? null : undefined,
    asOfIsoDate,
  };
}
