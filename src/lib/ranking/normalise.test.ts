import { describe, expect, it } from 'vitest';

import { midrankPercentiles, resolveNormalisationBasis } from './normalise';
import type { Course } from './types';

function stubCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c-stub',
    slug: 'stub',
    title: 'Stub',
    subtitle: 'Stub',
    categoryId: 'ai-ml',
    subcategoryId: 'applied-ml',
    tags: [],
    instructorId: 'i-01',
    level: 'beginner',
    language: 'en',
    durationHours: 1,
    lessonsCount: 1,
    hasCertificate: false,
    price: 0,
    originalPrice: null,
    publishedAt: '2020-01-01',
    lastContentUpdateAt: '2020-01-01',
    ratingAvg: 4.5,
    ratingCount: 100,
    ratingDistribution: [0, 0, 0, 0, 100],
    enrollments: 100,
    enrollments30d: 0,
    completionRate: 0.5,
    medianWatchPercent: 0.5,
    refundRate: 0,
    promo: null,
    policyFlags: [],
    ...overrides,
  };
}

describe('midrankPercentiles', () => {
  it('returns 0.5 for every course when a factor has the same value for all — docs/01 §4', () => {
    // This is the property that makes Fit inert when no query is present:
    // a constant factor must not read as "everyone at the minimum".
    const values = [3, 3, 3, 3, 3];
    expect(midrankPercentiles({ values })).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it('gives a unique maximum 1.0 and a unique minimum 0.0', () => {
    const percentiles = midrankPercentiles({ values: [1, 2, 3] });
    expect(percentiles[0]).toBe(0);
    expect(percentiles[2]).toBe(1);
  });

  it('averages the midrank for tied values', () => {
    // Two courses tied at the top of three: both should read as "better than
    // the one below, equal to each other" — (1 + 0.5*1) / 2 = 0.75.
    const percentiles = midrankPercentiles({ values: [1, 5, 5] });
    expect(percentiles[1]).toBeCloseTo(0.75, 5);
    expect(percentiles[2]).toBeCloseTo(0.75, 5);
  });

  it('returns 0.5 for a single-course basis, where N-1 is zero', () => {
    expect(midrankPercentiles({ values: [42] })).toEqual([0.5]);
  });
});

describe('resolveNormalisationBasis', () => {
  it('uses the category when it meets the small-basis threshold', () => {
    const categoryCourses = Array.from({ length: 10 }, () => stubCourse());
    const globalCourses = Array.from({ length: 50 }, () => stubCourse());
    const resolved = resolveNormalisationBasis({
      gatedCategoryCourses: categoryCourses,
      gatedGlobalCourses: globalCourses,
    });
    expect(resolved.basis).toBe('category');
    expect(resolved.size).toBe(10);
  });

  it('falls back to the global pool below the threshold — docs/01 §4.1', () => {
    const categoryCourses = Array.from({ length: 5 }, () => stubCourse());
    const globalCourses = Array.from({ length: 50 }, () => stubCourse());
    const resolved = resolveNormalisationBasis({
      gatedCategoryCourses: categoryCourses,
      gatedGlobalCourses: globalCourses,
    });
    expect(resolved.basis).toBe('global');
    expect(resolved.size).toBe(50);
  });
});
