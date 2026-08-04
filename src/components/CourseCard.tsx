'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useViewMode } from '@/contexts/ViewModeContext';
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

/** How long the `focus=<courseId>` highlight (PRD §5.8) stays visible. */
const HIGHLIGHT_MS = 2200;

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
  /** Deep-linked via `focus=<courseId>` (PRD §5.8) — scrolls, highlights, and in Demo view expands the inspector. */
  readonly isFocused: boolean;
}

/**
 * Reflows rather than hides between view modes (PRD §5.7): the score column
 * is deleted in User view and its space is reclaimed by a larger gradient
 * area, more room around the metadata line, and taller card padding — not
 * left as an empty gap.
 */
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
  isFocused,
}: CourseCardProps): ReactNode {
  const viewMode = useViewMode();
  const isDemo = viewMode === 'demo';
  const [expanded, setExpanded] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const inspectorId = useId();
  const articleRef = useRef<HTMLElement>(null);
  const { course } = result;
  const badges = courseBadges(course, asOfIsoDate);
  const updatedAgeDays = ageDays({ fromIsoDate: course.lastContentUpdateAt, asOfIsoDate });

  // No "already handled" ref guard: the effect's own dependency array
  // ([isFocused, isDemo]) already ensures this only runs when one of them
  // actually changes value. A guard set *before* the deferred timeout fires
  // would survive React's dev-mode double-invoke (mount → cleanup → mount)
  // and silently swallow the replay's timeout, so this stays simple instead.
  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    articleRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });

    // Deferred rather than called synchronously here: an effect setting
    // state directly in its body risks a cascading render in the same
    // commit (react-hooks/set-state-in-effect). One tick later is
    // imperceptible for a "highlight this card" affordance.
    const showTimeout = setTimeout(() => {
      if (isDemo) {
        setExpanded(true);
      }
      setHighlighted(true);
    }, 0);
    const hideTimeout = setTimeout(() => setHighlighted(false), HIGHLIGHT_MS);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [isFocused, isDemo]);

  return (
    <article
      ref={articleRef}
      className={`overflow-hidden rounded-xl border bg-surface shadow-sm transition-shadow duration-700 ${
        highlighted ? 'border-accent ring-2 ring-accent ring-offset-2' : 'border-border'
      }`}
    >
      <div className={`flex ${isDemo ? 'gap-4 p-4 sm:p-5' : 'gap-5 p-6 sm:p-7'}`}>
        <div
          aria-hidden
          className={
            isDemo
              ? 'hidden size-14 shrink-0 rounded-lg sm:block'
              : 'size-16 shrink-0 rounded-lg sm:size-24'
          }
          style={{ backgroundImage: courseGradient(course.id, course.categoryId) }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[0.9375rem] font-semibold text-ink">{course.title}</h3>
              <p className="mt-0.5 truncate text-[0.8125rem] text-ink-muted">{course.subtitle}</p>
              <p className="mt-1 text-[0.75rem] text-ink-subtle">{instructor.name}</p>
            </div>

            {isDemo && (
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="tnum text-lg font-semibold text-ink">
                  {result.score.toFixed(3)}
                </span>
                <span className="text-[0.6875rem] text-ink-subtle">
                  position #{result.position}
                </span>
              </div>
            )}
          </div>

          {badges.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${isDemo ? 'mt-2' : 'mt-3'}`}>
              {badges.map((badge) => (
                <Badge key={badge.kind} kind={badge.kind} label={badge.label} />
              ))}
            </div>
          )}

          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink-muted ${isDemo ? 'mt-3' : 'mt-5'}`}
          >
            {isDemo ? (
              <span
                className="tnum font-medium text-ink"
                title="Raw average → shrinkage-adjusted rating"
              >
                ★ {formatRating(course.ratingAvg)} raw → {formatRating(result.adjustedRating)}{' '}
                adjusted
                <span className="text-ink-subtle"> · {formatCount(course.ratingCount)} ratings</span>
              </span>
            ) : (
              <span className="tnum font-medium text-ink">
                ★ {formatRating(course.ratingAvg)}
                <span className="text-ink-subtle"> · {formatCount(course.ratingCount)} ratings</span>
              </span>
            )}
          </div>

          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem] text-ink-subtle ${isDemo ? 'mt-1.5' : 'mt-3'}`}
          >
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

          {isDemo && (
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
          )}
        </div>
      </div>

      {isDemo && (
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
      )}
    </article>
  );
}
