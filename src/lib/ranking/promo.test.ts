/**
 * Promo band invariants — docs/01-ranking-algorithm.md §7.2, docs/04-build-brief.md Phase 7.
 *
 * The reserved-slot version of `injectPromos` could place a course into a slot
 * strictly worse than its organic rank (a promoted course "demoted by its own
 * promotion" — see the Phase 7 build-brief table). The capped-band design is
 * supposed to remove that failure by construction, so this is the test that
 * would have caught it: every course actually placed in the band must finish
 * no worse than its own organic rank, in every category, with the quality gate
 * both on and off.
 */
import { describe, expect, it } from 'vitest';

import { CATEGORIES } from '@/data/categories';
import coursesData from '@/data/courses.json';

import { DATASET_AS_OF, DEFAULT_FILTERS, DEFAULT_TOGGLES, WEIGHT_PRESETS } from './constants';
import { rank } from './pipeline';
import type { Course } from './types';

const courses = coursesData as unknown as readonly Course[];

describe('promo band monotonicity', () => {
  for (const category of CATEGORIES) {
    for (const qualityGateEnabled of [true, false]) {
      it(`never lowers a band member below its organic rank — ${category.id}, gate ${qualityGateEnabled ? 'on' : 'off'}`, () => {
        const { results } = rank({
          courses,
          categoryId: category.id,
          filters: DEFAULT_FILTERS,
          sortMode: 'recommended',
          weights: WEIGHT_PRESETS.balanced,
          toggles: { ...DEFAULT_TOGGLES, promoQualityGate: qualityGateEnabled },
          page: 1,
          asOfIsoDate: DATASET_AS_OF,
          pageSize: null,
        });

        const bandMembers = results.filter((r) => r.isPromotedPlacement);
        for (const member of bandMembers) {
          expect(member.position).toBeLessThanOrEqual(member.organicRank);
        }
      });
    }
  }
});
