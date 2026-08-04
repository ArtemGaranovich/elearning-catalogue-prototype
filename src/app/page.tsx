'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { ScopeNote } from '@/components/ScopeNote';
import { Toolbar } from '@/components/Toolbar';
import { useViewConfig } from '@/hooks/useViewConfig';
import { computeEmptyStateInfo } from '@/lib/empty-state';
import { DATASET_AS_OF, WEIGHT_PRESETS } from '@/lib/ranking/constants';
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

const COURSES = coursesData as unknown as readonly Course[];
const INSTRUCTORS = instructorsData as unknown as readonly Instructor[];
const PRICE_BOUND_MAX = Math.ceil(Math.max(...COURSES.map((c) => c.price)) / 10) * 10;

export default function Page(): ReactNode {
  const { config, update, reset } = useViewConfig();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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
    () =>
      rank({
        courses: COURSES,
        categoryId: config.categoryId,
        filters: config.filters,
        sortMode: config.sortMode,
        weights: config.weights,
        toggles: config.toggles,
        page: config.page,
        asOfIsoDate: DATASET_AS_OF,
      }),
    [config.categoryId, config.filters, config.sortMode, config.weights, config.toggles, config.page],
  );

  const { meta } = pipelineResult;

  useEffect(() => {
    if (config.page > meta.pageCount) {
      update({ page: meta.pageCount }, { replace: true });
    }
  }, [config.page, meta.pageCount, update]);

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

  const handleCopyLink = useCallback(() => {
    const url = window.location.href;
    void navigator.clipboard.writeText(url).then(
      () => setCopyFeedback('Copied!'),
      () => setCopyFeedback('Could not copy — copy the address bar instead.'),
    );
    setTimeout(() => setCopyFeedback(null), 3000);
  }, []);

  return (
    <>
      <Header
        categoryId={config.categoryId}
        onCategorySelect={handleCategorySelect}
        query={config.filters.query}
        onQueryChange={handleQueryChange}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
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
              />
            )}

            <Pagination
              page={meta.page}
              pageCount={meta.pageCount}
              onPageChange={(page) => update({ page })}
            />
          </div>
        </div>

        <HowRankingWorks />
        <ScopeNote />
      </main>
    </>
  );
}
