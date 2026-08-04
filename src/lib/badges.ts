/**
 * Card badges (PRD §5.4: Free / Certificate / Sponsored / Featured / New).
 * Pure — no React, no DOM.
 */
import { ageDays } from './ranking/freshness';
import type { Course } from './ranking/types';

export type BadgeKind = 'free' | 'certificate' | 'sponsored' | 'featured' | 'new';

export interface CourseBadge {
  readonly kind: BadgeKind;
  readonly label: string;
}

/**
 * Cosmetic-only threshold — the badge is a card affordance, not a ranking
 * factor. Chosen so case 4 (published six weeks ago, docs/02 §4) reads as New.
 */
export const NEW_BADGE_MAX_AGE_DAYS = 90;

/**
 * Sponsored/Featured reflect `course.promo.type` directly, not whether the
 * course is currently occupying a promo slot: PRD §5.6 and acceptance
 * criterion 7 both describe the badge as staying attached to a sponsored
 * course even when the quality gate keeps it in its organic position.
 */
export function courseBadges(course: Course, asOfIsoDate: string): readonly CourseBadge[] {
  const badges: CourseBadge[] = [];
  if (course.price === 0) {
    badges.push({ kind: 'free', label: 'Free' });
  }
  if (course.hasCertificate) {
    badges.push({ kind: 'certificate', label: 'Certificate' });
  }
  if (course.promo?.type === 'sponsored') {
    badges.push({ kind: 'sponsored', label: 'Sponsored' });
  }
  if (course.promo?.type === 'featured') {
    badges.push({ kind: 'featured', label: 'Featured' });
  }
  if (ageDays({ fromIsoDate: course.publishedAt, asOfIsoDate }) <= NEW_BADGE_MAX_AGE_DAYS) {
    badges.push({ kind: 'new', label: 'New' });
  }
  return badges;
}
