'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { LANGUAGE_LABELS } from '@/lib/ranking/constants';
import type { Instructor, RankedCourse, SortMode } from '@/lib/ranking/types';
import { courseBadges } from '@/lib/badges';
import { courseGradient } from '@/lib/course-visuals';
import { formatAgeFromDays, formatCount, formatDuration, formatPrice, formatRating } from '@/lib/format';
import { ageDays } from '@/lib/ranking/freshness';

import { Badge } from './Badge';
import { ScoreInspector } from './ScoreInspector';

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export interface CourseCardProps {
  readonly result: RankedCourse;
  readonly instructor: Instructor;
  readonly categoryName: string;
  readonly candidateCount: number;
  readonly categoryMeanRawRating: number;
  readonly shrinkageEnabled: boolean;
  readonly sortMode: SortMode;
  readonly promoInjectionEnabled: boolean;
  readonly asOfIsoDate: string;
}

export function CourseCard({
  result,
  instructor,
  categoryName,
  candidateCount,
  categoryMeanRawRating,
  shrinkageEnabled,
  sortMode,
  promoInjectionEnabled,
  asOfIsoDate,
}: CourseCardProps): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const inspectorId = useId();
  const { course } = result;
  const badges = courseBadges(course, asOfIsoDate);
  const updatedAgeDays = ageDays({ fromIsoDate: course.lastContentUpdateAt, asOfIsoDate });

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex gap-4 p-4 sm:p-5">
        <div
          aria-hidden
          className="hidden size-14 shrink-0 rounded-lg sm:block"
          style={{ backgroundImage: courseGradient(course.id, course.categoryId) }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[0.9375rem] font-semibold text-ink">{course.title}</h3>
              <p className="mt-0.5 truncate text-[0.8125rem] text-ink-muted">{course.subtitle}</p>
              <p className="mt-1 text-[0.75rem] text-ink-subtle">{instructor.name}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="tnum text-lg font-semibold text-ink">
                {result.score.toFixed(3)}
              </span>
              <span className="text-[0.6875rem] text-ink-subtle">position #{result.position}</span>
            </div>
          </div>

          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <Badge key={badge.kind} kind={badge.kind} label={badge.label} />
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink-muted">
            <span className="tnum font-medium text-ink" title="Raw average → shrinkage-adjusted rating">
              ★ {formatRating(course.ratingAvg)} raw → {formatRating(result.adjustedRating)} adjusted
              <span className="text-ink-subtle"> · {formatCount(course.ratingCount)} ratings</span>
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-subtle">
            <span>{formatCount(course.enrollments)} enrolled</span>
            <span>·</span>
            <span>{formatDuration(course.durationHours)}</span>
            <span>·</span>
            <span>{LEVEL_LABELS[course.level]}</span>
            <span>·</span>
            <span>{LANGUAGE_LABELS[course.language]}</span>
            <span>·</span>
            <span className="font-medium text-ink-muted">{formatPrice(course.price)}</span>
            <span>·</span>
            <span>Updated {formatAgeFromDays(updatedAgeDays)}</span>
          </div>

          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={inspectorId}
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-accent hover:text-accent-strong"
          >
            {expanded ? 'Hide' : 'Why this rank?'}
            <span aria-hidden className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>
        </div>
      </div>

      <div id={inspectorId} hidden={!expanded}>
        {expanded && (
          <ScoreInspector
            result={result}
            categoryName={categoryName}
            candidateCount={candidateCount}
            categoryMeanRawRating={categoryMeanRawRating}
            shrinkageEnabled={shrinkageEnabled}
            sortMode={sortMode}
            promoInjectionEnabled={promoInjectionEnabled}
          />
        )}
      </div>
    </article>
  );
}
