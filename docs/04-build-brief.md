# Build & Deploy Brief for Claude Code

This is the working plan. Run the phases in order and stop at each checkpoint — the
checkpoints exist so that a wrong turn costs one phase instead of the whole build.

Paste the block at the end of each phase as the prompt if you are driving this in separate
sessions.

---

## Phase 1 — Scaffold

Create a Next.js App Router project with TypeScript and Tailwind, configured for **static
export** (`output: 'export'` in `next.config.js`). Strict TypeScript. ESLint and Prettier.
Vitest for unit tests.

Set up the directory structure exactly as laid out in `CLAUDE.md`. Create empty modules with
correct signatures and `TODO` bodies so the shape of the system is fixed before any logic is
written.

**Checkpoint:** `npm run build` produces a static export of an empty page. Zero TS errors.

---

## Phase 2 — Dataset

Write `scripts/generate-dataset.ts`.

1. Write `src/data/categories.ts` — the 6 categories and their subcategories as typed
   literals, and `src/data/instructors.json` from the 22 instructor records.
2. Hand-write the **planted courses** from `docs/02-dataset-spec.md` §4 (roughly 18 of them)
   exactly as specified. These numbers are load-bearing — do not round them, do not improve
   them. Case 6's rating count of 243 in particular is what makes `R_adj` land on 3.97.
3. Generate the remaining ~46 with a **seeded** PRNG (implement a small xorshift; do not add a
   dependency), following the correlations in §4: log-normal enrolments, raw ratings
   concentrated 4.1–4.8, price tracking duration and level, completion inversely related to
   duration, J-shaped rating distributions. Respect the per-category counts in §2 exactly:
   16 / 13 / 10 / 10 / 10 / 5.
4. Assert **every** invariant in §5, both blocks, before writing. On any failure, throw and
   write nothing.

   The demo-integrity assertions need the ranking engine, which does not exist yet. Write the
   integrity checks that stand alone now, leave the position-dependent ones as a failing stub,
   and complete them at the end of Phase 3. Do not skip them — they are the reason the
   dataset is trustworthy.
5. Write `src/data/courses.json`. Commit everything.

**Checkpoint:** running the script twice produces byte-identical files. All standalone
invariants pass. Print the summary table from §5.

---

## Phase 3 — Ranking engine

Implement `lib/ranking/` per `docs/01-ranking-algorithm.md`. Pure functions only, no React
in this phase.

Order of implementation:

1. `constants.ts` — `DATASET_AS_OF`, the four weight presets from `docs/03-prototype-prd.md`
   §5.6, `m = 50`, `τ = 540`, gate thresholds, diversity cap, promo slots `[1, 6]` then every
   10, promo density cap 0.2, page size 12, small-basis threshold 10.
2. `quality.ts` — Bayesian shrinkage, §3.1. The prior `C` is the mean raw rating of the
   category after the **policy gate only** — not after the `ratingCount ≥ 20` gate, and not
   after user filters. `R_adj` must be identical in every sort mode; if a course's adjusted
   rating changes when the user switches to "Highest rated", `C` is being computed too late.
3. `outcome.ts`, `popularity.ts`, `freshness.ts`, `fit.ts` — §3.2–3.5. `freshness.ts` uses
   `DATASET_AS_OF`, never `Date.now()`.
4. `normalise.ts` — midrank percentile over the **gated category** (§4, §4.1), with the
   global-pool fallback below 10 courses in the basis. Verify the midrank property directly:
   a factor with the same value for every course must return 0.5 for every course, which is
   what makes Fit inert with no query.
5. `score.ts` — weighted composition. A disabled factor's weight is **dropped, not
   redistributed** (PRD §5.6); return the attainable maximum alongside the score so the UI can
   show it.
6. `filters.ts`, `gates.ts` — the minimum-rating filter applies to the **adjusted** rating,
   which is available because scoring precedes filtering.
7. `diversity.ts`, `promo.ts`.
8. `pipeline.ts` — stages 1–8 in the documented order, which is **gates → score → filters**,
   not the other way round. Returns
   `{ results: RankedCourse[], meta: { candidateCount, hiddenByGate, promoRejected, normalisationBasis, basisSize, maxAttainableScore } }`,
   where each `RankedCourse` carries its full explanation object.

   `candidateCount` and `basisSize` are different numbers and must not be conflated.
   `candidateCount` is how many courses survived gating in this category. `basisSize` is how
   many courses the percentiles were computed over — equal to `candidateCount` normally, but
   equal to the global pool size when `normalisationBasis` is `'global'`.

Write the tests as you go, one per planted case, each naming the case number from the dataset
spec. Then complete the position-dependent invariants left stubbed in Phase 2 and re-run the
generator.

**Checkpoint — verify all of these before touching any UI:**

- Case 1 is outside the top 8 with default weights, and rises by ≥ 6 positions with shrinkage
  disabled.
- Case 2 rises by ≥ 3 positions with Outcome disabled, and is position 1 under the
  Popularity-led preset. Note it does **not** reach position 1 from the Outcome toggle alone —
  if your implementation says otherwise, something is wrong.
- Case 5 is injected into slot 1 with an organic rank in [5, 9]; case 7 takes slot 6.
- Case 6 is not injected, and the rejection names the failed condition with both numbers.
- Case 8: at most 2 courses per instructor in the top 10.
- Case 13: Cybersecurity reports `normalisationBasis: 'global'` with `candidateCount: 4` and
  `basisSize` equal to the global pool size, and is the **only** category that does so.
- Applying any filter leaves every remaining course's score unchanged.
- Identical inputs always produce identical ordering, including across pagination boundaries.

Do not proceed until the engine is right. Every UI bug traced back to the engine costs double.

---

## Phase 4 — UI

Build the components from `docs/03-prototype-prd.md` §5, in this order:

1. Layout, header, category tabs.
2. `url-state.ts` and wire it up first, before any interactive component — retrofitting URL
   state is painful.
3. Course card, including raw-and-adjusted rating side by side.
4. Filter sidebar with live result counts and the designed empty state.
5. Sort control with the gate note and the promo-suppression note.
6. Score Inspector — render the explanation object from `pipeline.ts`; compute nothing here.
7. Ranking Lab: sliders, presets, toggles, animated reordering, copy-link.
8. "How ranking works" section and the "Scope and limitations" note.

Visual direction: clean, dense, neutral. This should read as a product surface, not a
dashboard and not a template. Restrained palette, one accent colour, generous whitespace
around the score bars since they carry the argument. Promo badges must be clearly visible
without being loud.

Animation: reordering only, ~300 ms, respecting `prefers-reduced-motion`. No decorative
animation anywhere else.

**Checkpoint:** all 16 acceptance criteria pass locally. Zero console warnings.

---

## Phase 5 — Deploy

1. `git init`, commit, push to a GitHub repo.
2. `npx vercel` → link the project → deploy. Static export needs no environment variables
   and no build configuration beyond the defaults.
3. `npx vercel --prod`.
4. Re-run **all 16 acceptance criteria against the production URL.** A static export can
   behave differently from `next dev` — client-only code, hydration, base paths.
5. Add the production URL to `README.md` along with four deep links for the Loom recording:
   default view · shrinkage disabled · Popularity-led preset · promo quality gate disabled.

**Checkpoint:** the public URL passes all 16 criteria, and the four deep links reproduce their
intended views in a fresh browser profile.

---

## README requirements

Short. In order: what this is · live link · the five factors in one table · how to read the
Score Inspector · the four demo deep links · scope and limitations · how to regenerate the
dataset · how to run the tests.

---

## Copy-paste prompts

**Phase 1**

> Read `CLAUDE.md` and `docs/03-prototype-prd.md`, then execute Phase 1 of
> `docs/04-build-brief.md`. Static export must work before you write any logic. Stop at the
> checkpoint and report.

**Phase 2**

> Execute Phase 2 of `docs/04-build-brief.md`. The planted courses in
> `docs/02-dataset-spec.md` §4 must be entered exactly as written — those numbers are chosen
> to demonstrate specific behaviours. Assert all invariants before writing any file. Stop at
> the checkpoint and print the summary table.

**Phase 3**

> Execute Phase 3 of `docs/04-build-brief.md`, implementing `docs/01-ranking-algorithm.md`
> precisely. Pure functions only — no React in `lib/ranking/`. Write one test per planted
> case, naming the case number. Do not start the UI until every checkpoint assertion passes.

**Phase 4**

> Execute Phase 4 of `docs/04-build-brief.md`. The Score Inspector renders the explanation
> object returned by `pipeline.ts` and computes nothing itself. Wire up `url-state.ts`
> before building interactive components. Then verify all 16 acceptance criteria from
> `docs/03-prototype-prd.md` §7 locally and report which pass.

**Phase 5**

> Execute Phase 5 of `docs/04-build-brief.md`. After deploying, re-run all 16 acceptance
> criteria against the production URL, not localhost, and report the results one by one.
