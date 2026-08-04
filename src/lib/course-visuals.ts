/**
 * Deterministic CSS gradients derived from the course id (CLAUDE.md: no
 * external image assets). Pure — no React, no DOM.
 */
import type { CategoryId } from '@/data/categories';

/** Each category gets its own hue family so a category tab reads as a set. */
const CATEGORY_BASE_HUE: Readonly<Record<CategoryId, number>> = {
  'ai-ml': 255,
  'web-dev': 200,
  'data-analytics': 165,
  'design-ux': 320,
  'business-marketing': 35,
  cybersecurity: 5,
};

function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
}

export function courseGradient(courseId: string, categoryId: CategoryId): string {
  const hash = hashString(courseId);
  const baseHue = CATEGORY_BASE_HUE[categoryId];
  const hueSpread = (hash % 40) - 20;
  const hue = (baseHue + hueSpread + 360) % 360;
  const angle = 100 + (hash % 60);
  const secondHue = (hue + 34 + ((hash >> 8) % 20)) % 360;
  return (
    `linear-gradient(${angle}deg, hsl(${hue} 62% 46%) 0%, hsl(${secondHue} 70% 34%) 100%)`
  );
}
