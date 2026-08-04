'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getCategory } from '@/data/categories';
import type { CategoryId } from '@/data/categories';
import coursesData from '@/data/courses.json';
import instructorsData from '@/data/instructors.json';
import { CourseList } from '@/components/CourseList';
import { EmptyState } from '@/components/EmptyState';
import { FilterSidebar } from '@/components/FilterSidebar';
import { Header } from '@/components/Header';
import { HowRankingWorks } from '@/components/HowRankingWorks';
import { Pagination } from '@/components/Pagination';
import { RankingLab } from '@/components/RankingLab';
import { RankingModifiedChip } from '@/components/RankingModifiedChip';
import { ScopeNote } from '@/components/ScopeNote';
import { Toolbar } from '@/components/Toolbar';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { useCrossFade } from '@/hooks/useCrossFade';
import { useViewConfig } from '@/hooks/useViewConfig';
import { useViewModeShortcut } from '@/hooks/useViewModeShortcut';
import { computeEmptyStateInfo } from '@/lib/empty-state';
import { toRankOptions } from '@/lib/rank-request';
import { isDefaultRankingConfig } from '@/lib/ranking/config-diff';
import { DATASET_AS_OF, PAGE_SIZE, WEIGHT_PRESETS } from '@/lib/ranking/constants';
import { filterOptionCounts } from '@/lib/ranking/filters';
import { rank, scoreCategory } from '@/lib/ranking/pipeline';
import type {
  Course,
  FilterState,
  Instructor,
  RankingToggles,
  SortMode,
  WeightPresetName,
  Weights,
} from '@/lib/ranking/types';
import type { ViewMode } from '@/lib/url-state';

const COURSES = coursesData as unknown as readonly Course[];
const INSTRUCTORS = instructorsData as unknown as readonly Instructor[];
const PRICE_BOUND_MAX = Math.ceil(Math.max(...COURSES.map((c) => c.price)) / 10) * 10;

export default function Page(): ReactNode {
  const { config, update, reset } = useViewConfig();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const resolvedFocusRef = useRef<string | null>(null);

  useViewModeShortcut(config.viewMode, useCallback((mode: ViewMode) => update({ viewMode: mode }), [update]));

  const instructorById = useMemo(() => new Map(INSTRUCTORS.map((i) => [i.id, i])), []);
  const category = getCategory(config.categoryId);

  const scoreResult = useMemo(
    () =>
      scoreCategory({
        courses: COURSES,
        categoryId: config.categoryId,
        filters: config.filters,
        sortMode: config.sortMode,
        weights: config.weights,
        toggles: config.toggles,
        asOfIsoDate: DATASET_AS_OF,
      }),
    [config.categoryId, config.filters, config.sortMode, config.weights, config.toggles],
  );

  const filterCounts = useMemo(
    () =>
      filterOptionCounts({
        scored: scoreResult.scored,
        filters: config.filters,
        asOfIsoDate: DATASET_AS_OF,
      }),
    [scoreResult.scored, config.filters],
  );

  const emptyStateInfo = useMemo(
    () =>
      computeEmptyStateInfo({
        scored: scoreResult.scored,
        filters: config.filters,
        asOfIsoDate: DATASET_AS_OF,
      }),
    [scoreResult.scored, config.filters],
  );

  const pipelineResult = useMemo(
    () => rank(toRankOptions({ config, courses: COURSES, asOfIsoDate: DATASET_AS_OF })),
    [config],
  );

  /** Every result in the category, unpaginated — used only to resolve which page `focus` lands on (PRD §5.8). */
  const focusResult = useMemo(
    () =>
      rank(
        toRankOptions({ config, courses: COURSES, asOfIsoDate: DATASET_AS_OF, ignorePagination: true }),
      ),
    [config],
  );

  const { meta } = pipelineResult;

  useEffect(() => {
    if (config.page > meta.pageCount) {
      update({ page: meta.pageCount }, { replace: true });
    }
  }, [config.page, meta.pageCount, update]);

  useEffect(() => {
    if (config.focus === null || config.all) {
      return;
    }
    if (resolvedFocusRef.current === config.focus) {
      return;
    }
    const target = focusResult.results.find((r) => r.course.id === config.focus);
    if (target === undefined) {
      return;
    }
    resolvedFocusRef.current = config.focus;
    const targetPage = Math.ceil(target.position / PAGE_SIZE);
    if (targetPage !== config.page) {
      update({ page: targetPage }, { replace: true });
    }
  }, [config.focus, config.all, config.page, focusResult, update]);

  const handleCategorySelect = useCallback(
    (categoryId: CategoryId) => {
      update({ categoryId, page: 1, filters: { ...config.filters, subcategoryIds: [] } });
    },
    [config.filters, update],
  );

  const handleQueryChange = useCallback(
    (query: string) => {
      update({ filters: { ...config.filters, query }, page: 1 }, { replace: true });
    },
    [config.filters, update],
  );

  const handleFiltersChange = useCallback(
    (patch: Partial<FilterState>) => {
      update({ filters: { ...config.filters, ...patch }, page: 1 });
    },
    [config.filters, update],
  );

  const handleSortChange = useCallback(
    (sortMode: SortMode) => {
      update({ sortMode, page: 1 });
    },
    [update],
  );

  const handleWeightsChange = useCallback(
    (weights: Weights) => {
      update({ weights }, { replace: true });
    },
    [update],
  );

  const handleToggleChange = useCallback(
    (key: keyof RankingToggles) => {
      update({ toggles: { ...config.toggles, [key]: !config.toggles[key] } });
    },
    [config.toggles, update],
  );

  const handlePresetSelect = useCallback(
    (preset: WeightPresetName) => {
      update({ weights: WEIGHT_PRESETS[preset] });
    },
    [update],
  );

  const handleTogglePromoInjection = useCallback(() => {
    handleToggleChange('promoInjection');
  }, [handleToggleChange]);

  const handleShowAllChange = useCallback(
    (value: boolean) => {
      update({ all: value });
    },
    [update],
  );

  const handleViewModeChange = useCallback(
    (viewMode: ViewMode) => {
      update({ viewMode });
    },
    [update],
  );

  const handleCopyLink = useCallback(() => {
    const url = window.location.href;
    void navigator.clipboard.writeText(url).then(
      () => setCopyFeedback('Copied!'),
      () => setCopyFeedback('Could not copy — copy the address bar instead.'),
    );
    setTimeout(() => setCopyFeedback(null), 3000);
  }, []);

  const crossFadeClassName = useCrossFade(config.viewMode);
  const rankingModified = !isDefaultRankingConfig(config.weights, config.toggles);

  return (
    <ViewModeProvider viewMode={config.viewMode}>
      <Header
        categoryId={config.categoryId}
        onCategorySelect={handleCategorySelect}
        query={config.filters.query}
        onQueryChange={handleQueryChange}
        onViewModeChange={handleViewModeChange}
      />

      <main className={`mx-auto max-w-[1400px] px-4 py-6 sm:px-6 ${crossFadeClassName}`}>
        {config.viewMode === 'user' && (
          <RankingModifiedChip visible={rankingModified} />
        )}

        {config.viewMode === 'demo' && (
          <div className="mb-6">
            <RankingLab
              weights={config.weights}
              toggles={config.toggles}
              onWeightsChange={handleWeightsChange}
              onToggleChange={handleToggleChange}
              onPresetSelect={handlePresetSelect}
              onReset={reset}
              onCopyLink={handleCopyLink}
              copyFeedback={copyFeedback}
            />
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <FilterSidebar
            categoryId={config.categoryId}
            filters={config.filters}
            counts={filterCounts}
            instructors={INSTRUCTORS}
            priceBoundMax={PRICE_BOUND_MAX}
            onChange={handleFiltersChange}
          />

          <div className="min-w-0 flex-1 space-y-4">
            <Toolbar
              categoryId={config.categoryId}
              filters={config.filters}
              onFiltersChange={handleFiltersChange}
              sortMode={config.sortMode}
              onSortChange={handleSortChange}
              totalResults={meta.totalResults}
              ratingGateHidden={meta.hiddenByGate}
              promoInjectionEnabled={config.toggles.promoInjection}
              onTogglePromoInjection={handleTogglePromoInjection}
              showAll={config.all}
              onShowAllChange={handleShowAllChange}
            />

            {emptyStateInfo.isEmpty ? (
              <EmptyState
                info={emptyStateInfo}
                categoryName={category.name}
                onApply={handleFiltersChange}
              />
            ) : (
              <CourseList
                results={pipelineResult.results}
                instructorById={instructorById}
                categoryName={category.name}
                candidateCount={meta.candidateCount}
                categoryMeanRawRating={meta.categoryMeanRawRating}
                shrinkageEnabled={config.toggles.shrinkage}
                sortMode={config.sortMode}
                promoInjectionEnabled={config.toggles.promoInjection}
                asOfIsoDate={DATASET_AS_OF}
                focusCourseId={config.focus}
              />
            )}

            <Pagination
              page={meta.page}
              pageCount={meta.pageCount}
              onPageChange={(page) => update({ page })}
            />
          </div>
        </div>

        {config.viewMode === 'demo' && (
          <>
            <HowRankingWorks />
            <ScopeNote />
          </>
        )}
      </main>
    </ViewModeProvider>
  );
}
