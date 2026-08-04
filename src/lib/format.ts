/**
 * Display formatting shared by every course-facing component. Pure
 * string-in-number-out functions — no React, no DOM (src/lib stays pure,
 * CLAUDE.md) — so they are trivially testable and reusable between the card
 * and the inspector.
 */

const INTEGER_FORMATTER = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return INTEGER_FORMATTER.format(Math.round(value));
}

export function formatPrice(price: number): string {
  if (price === 0) {
    return 'Free';
  }
  return `$${INTEGER_FORMATTER.format(price)}`;
}

export function formatDuration(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(2);
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatScore(score: number): string {
  return score.toFixed(3);
}

const AVG_DAYS_PER_MONTH = 30.4368;

/** e.g. "5 months ago", "1 month ago", "yesterday". Relative to DATASET_AS_OF. */
export function formatAgeFromDays(ageDaysValue: number): string {
  if (ageDaysValue < 1) {
    return 'today';
  }
  if (ageDaysValue < 2) {
    return 'yesterday';
  }
  if (ageDaysValue < 60) {
    const days = Math.round(ageDaysValue);
    return `${days} days ago`;
  }
  const months = Math.round(ageDaysValue / AVG_DAYS_PER_MONTH);
  if (months < 24) {
    return `${months} months ago`;
  }
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
