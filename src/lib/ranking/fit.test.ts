import { describe, expect, it } from 'vitest';

import { fitRaw } from './fit';
import type { Course } from './types';

function stubCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c-stub',
    slug: 'stub',
    title: 'Stub course',
    subtitle: 'Nothing special',
    categoryId: 'ai-ml',
    subcategoryId: 'applied-ml',
    tags: ['python'],
    instructorId: 'i-01',
    level: 'beginner',
    language: 'en',
    durationHours: 10,
    lessonsCount: 40,
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

describe('fitRaw', () => {
  it('is identical for every course with no query, subcategory, level or duration selected — docs/01 §3.5', () => {
    // This is what keeps Fit inert under default filters: combined with the
    // midrank property (normalise.test.ts), a constant Fit_raw normalises to
    // 0.5 for everyone rather than favouring or penalising any course.
    const a = stubCourse({ id: 'c-a', subcategoryId: 'applied-ml', level: 'beginner', durationHours: 4 });
    const b = stubCourse({ id: 'c-b', subcategoryId: 'deep-learning', level: 'advanced', durationHours: 40 });

    const options = {
      query: '',
      selectedSubcategoryIds: [],
      selectedLevels: [],
      selectedDurationBuckets: [],
    } as const;

    expect(fitRaw({ course: a, ...options })).toBe(fitRaw({ course: b, ...options }));
  });

  it('rewards a course in a selected subcategory over one outside it', () => {
    const inSubcategory = stubCourse({ id: 'c-in', subcategoryId: 'applied-ml' });
    const outsideSubcategory = stubCourse({ id: 'c-out', subcategoryId: 'deep-learning' });
    const options = {
      query: '',
      selectedSubcategoryIds: ['applied-ml' as const],
      selectedLevels: [],
      selectedDurationBuckets: [],
    };

    expect(fitRaw({ course: inSubcategory, ...options })).toBeGreaterThan(
      fitRaw({ course: outsideSubcategory, ...options }),
    );
  });

  it('rewards a title/tag match against a search query', () => {
    const matching = stubCourse({ id: 'c-match', title: 'Applied ML for Analysts' });
    const nonMatching = stubCourse({ id: 'c-nomatch', title: 'Nothing Related' });
    const options = {
      query: 'applied ml',
      selectedSubcategoryIds: [],
      selectedLevels: [],
      selectedDurationBuckets: [],
    };

    expect(fitRaw({ course: matching, ...options })).toBeGreaterThan(
      fitRaw({ course: nonMatching, ...options }),
    );
  });
});
