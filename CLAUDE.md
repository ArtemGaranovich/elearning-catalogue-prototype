# Project: Course Catalogue Ranking Prototype

## What this is

A frontend-only demo that makes a course ranking algorithm visible and manipulable. Built
as a test-task deliverable. Deployed to Vercel as a public link.

## Read first, in this order

1. `docs/01-ranking-algorithm.md` — the algorithm. **This is the specification.** Formulas,
   weights, pipeline order and promo rules come from here and nowhere else.
2. `docs/02-dataset-spec.md` — schema, the planted demo cases, generator invariants.
3. `docs/03-prototype-prd.md` — screens, components, behaviour, acceptance criteria.
4. `docs/04-build-brief.md` — the implementation plan and deploy steps.
5. `docs/05-loom-script.md` — the video walkthrough. Useful context: it tells you which
   moments in the UI have to be unmistakable.

If any of these documents disagree with each other, `01-ranking-algorithm.md` wins on
algorithm questions and `03-prototype-prd.md` wins on UI questions. Do not resolve a
contradiction silently — flag it.

## Hard constraints

- **No backend, no database, no API routes, no server actions.** Static export only.
- **No runtime data generation.** `courses.json` and `instructors.json` are produced by
  `scripts/generate-dataset.ts` and committed; the app imports them at build time.
- **No `Date.now()` anywhere in scoring.** Use the `DATASET_AS_OF` constant. A demo whose
  planted cases decay with real time is a broken demo.
- **No external image assets.** Card visuals are deterministic CSS gradients derived from
  the course id.
- **No `localStorage`.** State lives in the URL.
- **Never mix promotion into the composite score.** Promotion is a capped band lifted above the
  organic list, applied after scoring and after the diversity pass (`docs/01-ranking-algorithm.md`
  §7.2). A design invariant, not a preference. Related invariant: no course **placed in the
  band** may finish at a position worse than its organic rank — a promoted course that misses the
  band can still be displaced by the ones that took it, exactly like any organic course.
- **Pipeline order is gates → score → filters**, not gates → filters → score. Percentiles are
  computed over the whole gated category so that a course's score does not change when the
  user ticks a checkbox (`docs/01-ranking-algorithm.md` §4.1). Getting this backwards makes
  the Score Inspector incoherent.
- **The view mode never reaches the ranking layer.** `viewMode` ('demo' | 'user') is a
  presentation flag. It is absent from the input type `pipeline.ts` accepts, and nothing in
  `lib/ranking/` may read it. The ordering must be provably identical in both modes
  (`docs/03-prototype-prd.md` §5.7) — that invariant is the entire reason the toggle exists.

## Architecture

```
src/
  data/
    courses.json          generated, committed, never hand-edited
    categories.ts
    instructors.json
  lib/
    ranking/
      constants.ts        DATASET_AS_OF, weights, m, tau, thresholds
      quality.ts          Bayesian shrinkage
      outcome.ts
      popularity.ts
      freshness.ts
      fit.ts
      normalise.ts        percentile ranking + small-set fallback
      score.ts            weighted composition
      filters.ts
      gates.ts
      diversity.ts
      promo.ts            eligibility gate + promoted band
      pipeline.ts         orchestrates stages 1-8 in order
    url-state.ts          parse/serialise the full view config
  components/
    ...
  app/
    page.tsx
scripts/
  generate-dataset.ts
```

Rules for this layout:

- Everything in `lib/ranking/` is **pure**: data in, data out. No React, no DOM, no fetch,
  no side effects. This is what makes it testable and what makes the inspector possible.
- `pipeline.ts` returns not just the ordered list but the **explanation** for each result:
  every factor's raw value, percentile, weight and contribution; the tie-breaker used; promo
  band position and organic rank; which gate a course failed. The UI renders this — it never
  recomputes it. One source of truth for the numbers on screen.
- Weights and thresholds are configuration objects, never inline literals.

## Conventions

- TypeScript strict. No `any`. Explicit return types on exported functions.
- Ranking functions take an options object, never positional booleans.
- Tests with Vitest, colocated as `*.test.ts`, for `lib/ranking/` only. The planted demo
  cases from `docs/02-dataset-spec.md` are the test fixtures — each one gets a test
  asserting the behaviour it was planted to demonstrate.
- Comments explain *why*, not *what*. The formulas are non-obvious; cite the document
  section.
- Conventional commits.

## Definition of done

All 26 acceptance criteria in `docs/03-prototype-prd.md` §7 pass **in the deployed build**,
not just locally.
