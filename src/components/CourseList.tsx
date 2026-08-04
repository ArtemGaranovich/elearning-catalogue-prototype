'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';

import { useFlipAnimation } from '@/hooks/useFlipAnimation';
import type { Instructor, RankedCourse, SortMode } from '@/lib/ranking/types';

import { CourseCard } from './CourseCard';

export interface CourseListProps {
  readonly results: readonly RankedCourse[];
  readonly instructorById: ReadonlyMap<string, Instructor>;
  readonly categoryName: string;
  readonly candidateCount: number;
  readonly categoryMeanRawRating: number;
  readonly shrinkageEnabled: boolean;
  readonly sortMode: SortMode;
  readonly promoInjectionEnabled: boolean;
  readonly asOfIsoDate: string;
  /** `focus=<courseId>` (PRD §5.8); null when no course is deep-linked. */
  readonly focusCourseId: string | null;
}

/** The course cards, in final order — animated reordering only (Phase 4). */
export function CourseList({
  results,
  instructorById,
  categoryName,
  candidateCount,
  categoryMeanRawRating,
  shrinkageEnabled,
  sortMode,
  promoInjectionEnabled,
  asOfIsoDate,
  focusCourseId,
}: CourseListProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const orderKey = results.map((r) => r.course.id).join(',');
  useFlipAnimation(containerRef, orderKey);

  return (
    <div ref={containerRef} className="space-y-3">
      {results.map((result) => {
        const instructor = instructorById.get(result.course.instructorId);
        if (instructor === undefined) {
          throw new Error(`no instructor record for ${result.course.instructorId}`);
        }
        return (
          <div key={result.course.id} data-flip-id={result.course.id}>
            <CourseCard
              result={result}
              instructor={instructor}
              categoryName={categoryName}
              candidateCount={candidateCount}
              categoryMeanRawRating={categoryMeanRawRating}
              shrinkageEnabled={shrinkageEnabled}
              sortMode={sortMode}
              promoInjectionEnabled={promoInjectionEnabled}
              asOfIsoDate={asOfIsoDate}
              isFocused={result.course.id === focusCourseId}
            />
          </div>
        );
      })}
    </div>
  );
}
