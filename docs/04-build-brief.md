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
   §5.6, `m = 50`, `τ = 540`, gate thresholds, diversity cap, `PROMO_BAND_MAX = 2`, page size 12,
   small-basis threshold 10.
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
- Case 2 rises by ≥ 3 positions with Outcome disabled, and becomes the top **organic** result
  under the Popularity-led preset. Two things not to get wrong here: it does **not** reach the
  top from the Outcome toggle alone, and its rendered position under Popularity-led is **3**,
  not 1, because the two-course promoted band holds positions 1 and 2. Assert the organic rank,
  not the rendered position.
- Case 5 takes band position 1 with an organic rank in [5, 9]; case 7 takes band position 2.
  Sponsored before Featured, never more than two, and no band member below its organic rank.
- Case 6 is not placed in the band, and the rejection names the failed condition with both
  numbers.
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

**Checkpoint:** acceptance criteria 1–18 pass locally. Zero console warnings.

---

## Phase 5 — Deploy

**Deployment is already wired: the GitHub repo is connected to Vercel, and a push to `master`
ships to production.** There is no CLI linking step and no dashboard configuration to do.

1. Commit and push to `master`.
2. Wait for the Vercel build to finish, then confirm the production URL serves the new build —
   check a value you just changed, not just that the page loads.
3. Re-run **acceptance criteria 1–18 against the production URL.** A static export can behave
   differently from `next dev` — client-only code, hydration, base paths. This is the reason
   this phase exists at all.
4. Add the production URL to `README.md`.

If the build fails on Vercel but succeeds locally, the cause is almost always one of: a
case-sensitive import path (Vercel is Linux, local is Windows), a dependency in
`devDependencies` that runtime code imports, or `output: 'export'` colliding with something
added since Phase 1.

**Checkpoint:** the public URL passes criteria 1–18. Deploy before Phase 6 rather than after it
— if a static-export problem is going to appear, it should appear against the smaller feature
set, where it is cheap to find.

---

## Phase 6 — View modes

Implement `docs/03-prototype-prd.md` §5.7: a Demo/User toggle that strips the explanatory layer
without changing a single result.

This comes last on purpose. Building the explanatory UI first and then subtracting from it
forces the removal to be a real subtraction from working components, rather than two parallel
implementations that drift apart.

1. **Enforce the invariant by type before writing any UI.** Add `viewMode: 'demo' | 'user'` to
   the URL state and to a UI-level context. Do **not** add it to the input type accepted by
   `pipeline.ts`, and do not thread it into `lib/ranking/` in any form. If a ranking module can
   read the view mode, this phase has already failed. The compiler should be what stops you.
2. Write the equality test first: for at least three configurations — defaults, a filtered
   view, and the Popularity-led preset — assert that the ordered array of course ids is
   identical under both modes. This is acceptance criterion 20 and it is the whole point of the
   feature.
3. Add the segmented control to the header, the `view` URL parameter, and the `D` shortcut.
4. Gate the explanatory components on the mode: Ranking Lab, Score Inspector, "Why this rank?",
   score numbers, position indices, gate notes, promo organic-rank line, normalisation-basis
   line, "How ranking works", "Scope and limitations". Full list in §5.7.
5. **Reflow the card, do not just hide things.** The score column's space is reclaimed by the
   gradient area and the metadata line. Compare the two modes side by side at the end of this
   step: if User view looks like Demo view with gaps in it, redo the card.
6. Switch the rating display to a single raw average plus review count in User view (§5.7 —
   read the rationale before changing it, it is a deliberate choice and not an oversight).
7. Swap in user-facing sort labels.
8. Add the "Ranking parameters modified in Demo view" chip, shown only in User view and only
   when the weights or toggles differ from Balanced defaults.
9. Cross-fade transition, ~250 ms, `prefers-reduced-motion` respected.
10. Implement §5.8 — the **"Show all"** control (`all=1`) and the **`focus=<courseId>`**
    parameter. Do not skip these as polish: measured against the current build, the hero
    category puts the shrinkage case at position 13 and the gate-refused promo case at 14, both
    on page 2. Without "Show all" the reordering animation cannot run — a card cannot animate
    across a page boundary — and the single strongest moment in the walkthrough does not exist.
11. Push to `master` — Vercel redeploys automatically.
12. Add five deep links to `README.md`, built against the production URL and all carrying
    `all=1`: **User view** · default Demo view · shrinkage disabled · Popularity-led preset ·
    promo quality gate disabled with `focus` on the gate-refused course. User view goes first:
    it is where the Loom recording starts.

**Checkpoint, against the production URL:** all 26 acceptance criteria pass, the equality test
is green, and the five deep links reproduce their intended views in a fresh browser profile.

Sponsored and Featured badges must survive into User view. If they disappeared, the removal
list was applied too aggressively and the argument in `01` §7.5 has been inverted — those
labels exist for users, and are a legal requirement rather than a demo affordance.

---

## Phase 7 — Replace reserved slots with a capped promoted band

**Why this phase exists.** The shipped `promo.ts` injects promoted courses into reserved
positions 1 and 6, filling every slot unconditionally: `for (const slot of slots) { const next =
queue.shift(); … }`. Nothing checks that the slot is an *improvement*. Measured against the
deployed build, hero category, Recommended:

| Course | Organic rank | Final position | |
|---|---|---|---|
| Applied ML for Analysts (Sponsored) | 5 | 6 | demoted by its own promotion |
| AI Product Management Essentials (Featured) | 4 | 6 | demoted |
| …with the quality gate off | 4 | **16** | demoted to last in the category |

Paying for a placement that moves a course *down* inverts the whole argument of `01` §7. Rather
than patch the slot arithmetic, the design has been simplified: **promoted courses form a capped
band above the organic list** (`01` §7.2). This removes the failure by construction, and removes
the slot machinery, the density cap and the non-adjacency rule with it.

Steps:

1. **Test first**, over every category, with the quality gate both on and off: *no course placed
   in the band finishes at a position worse than its `organicRank`*. Scope it to band members
   only — a promoted course that misses the band is legitimately displaced by the ones that took
   it, and asserting over all promoted courses makes the test unsatisfiable. Confirm it fails on
   the current code before changing anything. This defect was invisible for a whole phase precisely because
   nothing asserted it.
2. Rewrite `injectPromos` per `01` §7.2:
   - eligible = promo-carrying courses passing the gate (or all of them when the gate toggle is
     off)
   - order: `Sponsored` before `Featured`; within each group by `priority × R_adj × predictedCtr`
   - take the first `PROMO_BAND_MAX` (= 2), skipping any whose band position would not improve on
     its `organicRank`
   - result = band, then the remaining courses in organic order
3. In `constants.ts`, replace `PROMO_LEADING_SLOTS`, `PROMO_SLOT_INTERVAL` and
   `PROMO_DENSITY_CAP` with a single `PROMO_BAND_MAX = 2`. Delete `promoSlots()`.
4. Explanation object: `promo.slot` becomes `promo.bandPosition` (1-based, `null` when not in the
   band). Add a distinct reason for "passed the gate, but the band would not improve on its
   organic rank" — do **not** reuse the gate's `failureMessage`, because the gate passed. Three
   states in total: in the band, refused by the gate, gained nothing.
5. Render those states in the Score Inspector per PRD §5.5.
6. No dataset change is needed. Case 5 (Sponsored, organic 5) takes band position 1; case 7
   (Featured, organic 4) takes band position 2 — both genuine lifts. Add the `02` §5 invariants
   for band composition and ordering.
7. Re-measure the positions quoted in `05-loom-script.md`. The promo beat depends on exact
   numbers, and the Popularity-led figure shifts: the megacourse becomes the top organic result
   at **position 3**, not 2, since the band now occupies two positions.
8. Push to `master`.

**Checkpoint:** the monotonicity test is green; positions 1 and 2 are Sponsored then Featured;
position 3 onward is uninterrupted organic order; and switching the quality gate off still puts
the below-average sponsored course first — that behaviour has to survive, since it is the entire
point of the toggle.

Worth one sentence in the Loom. A reviewer who has worked on ad products will wonder about the
demotion case, and "we hit it, and it's why the design is a capped band rather than fixed slots"
is a much better answer than never having encountered it.

---

## README requirements

Short. In order: what this is · live link · **the two view modes, one sentence each** · the
five factors in one table · how to read the Score Inspector · the five demo deep links · scope
and limitations · how to regenerate the dataset · how to run the tests.

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
> object returned by `pipeline.ts` and computes nothing itself. Wire up `url-state.ts` before
> building interactive components. Then verify acceptance criteria 1–18 from
> `docs/03-prototype-prd.md` §7 locally and report which pass.

**Phase 5**

> Execute Phase 5 of `docs/04-build-brief.md`. Vercel auto-deploys from `master`, so push and
> wait for the build rather than using the CLI. Then re-run acceptance criteria 1–18 against the
> production URL, not localhost, and report the results one by one.

**Phase 6**

> Execute Phase 6 of `docs/04-build-brief.md`, implementing `docs/03-prototype-prd.md` §5.7.
> Write the mode-equality test before the UI, and keep `viewMode` out of the input type that
> `pipeline.ts` accepts — the ordering must be provably identical in both modes. Reflow the card
> rather than hiding elements, and keep the Sponsored and Featured badges in User view. Then
> redeploy and verify all 26 acceptance criteria against the production URL.

**Phase 7**

> Execute Phase 7 of `docs/04-build-brief.md`. Write the monotonicity test first and confirm it
> fails on the current code, then replace the reserved-slot injection in `promo.ts` with the
> capped promoted band from `docs/01-ranking-algorithm.md` §7.2 — Sponsored before Featured, at
> most two, gate required, never lowering a band member below its organic rank. Retire the slot
> constants, add the three promo states to the explanation object and the inspector, and re-measure
> the positions quoted in `docs/05-loom-script.md`.

Phase 7 can run before Phase 6 if you prefer to ship the correctness fix first; they touch
different code.
