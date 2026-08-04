# Prototype Requirements

**What this is:** a public, frontend-only web demo of the sorting, filtering and ranking
logic described in `01-ranking-algorithm.md`.
**Audience:** the reviewer of the test task, plus a small number of internal viewers. Not
production, not multi-user, no auth.

---

## 1. Goal

The prototype has one job: **make the ranking algorithm visible.**

A course listing that merely looks nice proves nothing — any ordering could be behind it. The
prototype must let a viewer see *why* a course is in position N, change the inputs, and watch
the ordering respond. Everything below serves that goal; anything that does not serve it is out
of scope.

A second, smaller job follows from the first: **show that the explanation is additive.** The
view-mode toggle (§5.7) strips the explanatory layer and leaves an ordinary course listing with
an identical ordering — which is how a reviewer can tell this is a product with its workings
exposed, rather than a debug screen with no product behind it.

Success test: a viewer who has not read the document can, within two minutes and without
narration, work out that the top-rated course is not first and understand why.

## 2. Non-goals

No backend, no database, no API. No authentication, no user accounts, no persistence beyond
the URL. No course detail pages, no player, no checkout. No mobile app. No real
personalisation. No CMS. No analytics beyond what is needed to render the UI.

---

## 3. Stack

| | |
|---|---|
| Framework | Next.js (App Router), TypeScript, static export |
| Styling | Tailwind CSS |
| State | URL query string as the single source of truth |
| Data | committed JSON files (`courses.json`, `instructors.json`), imported at build time |
| Hosting | Vercel, auto-deployed from `master` |

Rationale for URL-as-state: every configuration of filters, sort mode and weights becomes a
shareable link. This makes the Loom recording reproducible and lets the reviewer land
directly on a specific demonstration.

---

## 4. Screens

One page. Three regions.

```
┌────────────────────────────────────────────────────────────┐
│  Header: title · category tabs · search · "How ranking     │
│  works" link             ·        [ Demo | User ] toggle   │
├──────────────┬─────────────────────────────────────────────┤
│              │  Toolbar: result count · sort select ·      │
│  Filter      │  active filter chips · promo toggle         │
│  sidebar     ├─────────────────────────────────────────────┤
│              │  Course cards (12 per page)                 │
│              │  ↳ each expandable into a Score Inspector   │
│              ├─────────────────────────────────────────────┤
│              │  Pagination                                 │
└──────────────┴─────────────────────────────────────────────┘
                                        [ Ranking Lab panel ]
```

Below the listing: a **"How ranking works"** section — the five questions from the document in
plain language, the weight table, and the pipeline order. Two paragraphs, not the whole
document. Its purpose is to let the page stand on its own if the reviewer opens the link before
watching the video.

The layout above is Demo view. §5.7 describes what User view removes from it.

---

## 5. Components

### 5.1 Category tabs

Six categories, one always active — the scenario begins with the user having chosen a
category. Category is part of the URL. Switching category resets pagination but preserves
sort mode and filters where they still apply.

### 5.2 Filter sidebar

| Filter | Control | Notes |
|---|---|---|
| Subcategory | checkbox list | feeds the Fit factor |
| Minimum rating | radio: any / 3.5+ / 4.0+ / 4.5+ | applied to the **adjusted** rating (`01` §6), and labelled as such |
| Level | checkboxes | beginner / intermediate / advanced |
| Duration | checkboxes | < 5h / 5–15h / 15–30h / 30h+ |
| Price | radio + range | any / free only / paid; max price slider |
| Language | checkboxes | en / de / es / pl |
| Certificate | toggle | |
| Updated within | radio | any / 6 / 12 / 24 months |
| Instructor | searchable list | |

Requirements:

- Each option shows the **result count it would produce**, computed against the other
  active filters. Counts update live.
- Options that would yield zero results are shown disabled rather than hidden, so the user
  can see the boundary of the catalogue instead of wondering where an option went.
- `AND` between filter types, `OR` within a multi-select.
- "Clear all" is always visible when any filter is active.
- **Empty state is a designed state**, not a blank panel: it names which filter is
  responsible, and offers a one-click relaxation ("remove the 4.5+ rating filter → 9
  results"). This example is reached via URL, not via the sidebar — see the note below.

Note on reachability: because zero-yield sidebar options are disabled, an empty result set
cannot be produced by clicking filters alone. It remains reachable through a search query
with no matches, and through a URL carrying a filter combination that a later data change
has emptied. Both paths must render the designed empty state; the search path is the one
used in acceptance criterion 14.

### 5.3 Sort control

The seven modes from the document. Two behaviours must be visible in the UI, not just
implemented:

- Selecting "Highest rated" shows a small note that the gate is active: *"Courses with
  fewer than 20 ratings are excluded — N hidden."* The count is computed, never hardcoded,
  and is a link that reveals the excluded courses. In the hero category N is at least 3, which
  the dataset guarantees (`02` §5).
- Selecting any mode other than Recommended shows: *"Promoted placements are hidden in
  explicit sort modes."*

These two notes carry a large share of the prototype's explanatory value for a two-word
change in the UI.

### 5.4 Course card

Title, subtitle, instructor, category gradient, star rating with **both numbers shown**
(`4.75 raw → 4.69 adjusted · 310 ratings`), enrolments, duration, level, language, price,
last-updated, badges (Free / Certificate / Sponsored / Featured / New).

Right-hand side: **the composite score as a number**, position index, and a "Why this rank?"
disclosure that opens the inspector.

Showing raw and adjusted rating side by side on every card is what makes the shrinkage
mechanic land without any explanation at all.

### 5.5 Score Inspector — the centrepiece

Expanding a card reveals:

- A horizontal stacked bar: the five weighted factor contributions summing to the total
  score, each segment labelled with factor, percentile and points contributed.
- Per factor: the raw value, the percentile, the weight, and the resulting contribution.
- The normalisation basis, always shown, since it is what the percentile is relative to:
  *"Percentiles within AI & Machine Learning · 16 courses"*. Scores do not change when
  filters are applied (`01` §4.1), and the panel should make that legible rather than
  leaving the reviewer to wonder.
- The applied tie-breaker, when the score was tied.
- For promoted courses in the band: *"Sponsored · promoted band 1 of 2 · would rank #5
  organically"*, plus the gate check with each of the four conditions ticked.
- For gate-rejected promo courses: *"Promotion not applied — adjusted rating 3.97 is below
  the category mean of 4.31."* This line is the single most important string in the
  prototype.
- For a promoted course that passed the gate but was left in place because the band would not
  improve on its organic rank (`01` §7.2): *"Already ranks #2 organically; promotion added
  nothing."* Distinct from a gate refusal — this course passed every quality condition.
- When the basis has fewer than 10 courses: *"Normalised against the global pool — only 4
  candidates in Cybersecurity."* (5 courses, one removed by a policy gate before
  normalisation.)

### 5.6 Ranking Lab

A collapsible panel, open by default on first load.

- Five weight sliders. The raw sum is displayed live while dragging; weights are normalised
  to 1 when applied, and the normalised set is shown next to the raw one so the difference is
  not mysterious.
- Preset buttons:

  | Preset | Quality | Outcome | Popularity | Freshness | Fit |
  |---|---|---|---|---|---|
  | **Balanced** *(default)* | 0.35 | 0.20 | 0.20 | 0.15 | 0.10 |
  | Quality-led | 0.55 | 0.15 | 0.10 | 0.10 | 0.10 |
  | Popularity-led | 0.15 | 0.10 | 0.50 | 0.15 | 0.10 |
  | Freshness-led | 0.25 | 0.15 | 0.10 | 0.40 | 0.10 |

  Popularity-led exists to make one point fast: it puts the 96k-enrolment / 22%-completion
  course at the top of the organic results — position 3, below the two-course band — which argues
  for the Outcome factor better than any explanation.

- Toggles: shrinkage on/off · Outcome factor on/off · diversity cap on/off · promoted band
  on/off · promo quality gate on/off.
- **A disabled factor's weight is dropped, not redistributed.** The maximum attainable score
  falls accordingly, and the panel says so. Redistributing would confound two changes — the
  factor leaving and the others growing — and make the toggle impossible to interpret.
- **Reordering is animated.** Cards move to their new positions rather than snapping. Seeing
  the 5.00-rated course climb six or more positions when shrinkage is switched off is the
  strongest single moment in the demo.
- "Reset to defaults" and "Copy link to this configuration".

Each toggle that switches off a protection also shows what it costs: turning off the promo
quality gate immediately places the below-average sponsored course at position 1, badge
still attached.

### 5.7 View modes — Demo and User

Everything described in §5.1–5.6 is a course listing wrapped in an explanation of itself. The
explanation is the point of the deliverable, but it is not what a customer of the platform
would ever see. A single toggle switches between the two.

| | **Demo view** *(default)* | **User view** |
|---|---|---|
| Audience | Reviewer, internal viewers | A customer browsing courses |
| Shows | The listing plus the full explanatory layer | The listing only |
| Answers | "Why is this course in position 4?" | "Which course should I take?" |

**The invariant that makes the toggle worth building**

> **The ordered list of course ids is identical in both modes for the same configuration.**

The mode is a presentation flag and nothing else. Same pipeline, same weights, same gates,
same promoted band, same page. Enforce this structurally rather than by discipline: `viewMode`
lives in the UI layer only, is absent from the input type that `pipeline.ts` accepts, and
`lib/ranking/` therefore cannot read it even by accident.

Without this invariant the toggle would be two different products sharing a URL, and it would
prove nothing. With it, it proves something specific and useful: the explanation layer is
**additive**. The ranking does not need any of it to work — and the reviewer can verify that
by flipping back and forth and watching the order stay put.

#### What is removed in User view

All of it is explanatory scaffolding; none of it is load-bearing:

- The Ranking Lab in its entirety — sliders, presets, toggles.
- The composite score number on every card.
- "Why this rank?" and the whole Score Inspector.
- The dual `4.75 raw → 4.69 adjusted` rating display.
- The "promoted band 1 of 2 · would rank #5 organically" line, and the gate-check list.
- The "fewer than 20 ratings are excluded — N hidden" note.
- The "Promoted placements are hidden in explicit sort modes" note.
- The normalisation-basis line and the small-category note.
- The "How ranking works" section and the "Scope and limitations" footer.
- Position indices on cards.
- The toolbar's promoted-band toggle. A control that switches promotion off is a demo
  affordance; it has no business in a customer view. (It duplicates the Ranking Lab toggle in
  any case — keep one, in the Lab.)

#### What stays, and why

The distinction worth drawing is between explanatory scaffolding and **product features that
happen to also be informative**. The second group stays.

| Stays | Why |
|---|---|
| **Sponsored / Featured badges** | These exist for the user, not the reviewer. Under the DSA (`01` §7.5) the label is a legal requirement, and removing it in "user view" would invert the entire argument of §7. |
| Per-option filter result counts | A genuine UX feature — real marketplaces show them. Not a debug affordance. |
| Designed empty state with a relaxation link | Same. |
| The seven sort modes | With user-facing labels; see below. |
| Rating, review count, enrolments, duration, level, language, price, last-updated | Ordinary card metadata. |
| Free / Certificate / New badges | Ordinary card metadata. |

#### What changes shape rather than disappearing

**Card layout must reflow, not just lose elements.** If the score column is deleted and
nothing takes its place, User view looks like Demo view with holes punched in it, which
undercuts the entire point. The gradient area grows, the metadata line gets more room, cards
become slightly taller and airier. It should read as a listing someone designed, not a listing
someone stripped.

**Rating display: one number.** User view shows the **raw average** plus the review count —
`5.0 · 6 ratings` — not the adjusted value.

This is a deliberate product decision and worth stating explicitly, because it looks like a
contradiction of `01` §3.1 and is not one. The adjusted rating is a ranking-internal quantity;
showing users a rating that differs from the arithmetic mean of their own reviews would be
confusing and slightly dishonest. The honest way to communicate low confidence to a user is
the **review count**, prominently placed — and then let the ordering do the actual work. A
5.0-from-6-ratings course displays its perfect score and still sits at position 13, which is
precisely the intended behaviour. The alternative — surfacing the adjusted number — was
rejected as exposing the model's internals to people who did not ask for them.

**Sort labels become user copy.** "Highest rated" rather than "Highest adjusted rating";
"Recommended", "Most popular", "Newest", "Price: low to high". Same seven keys underneath.

#### The control

- Segmented control, top-right of the header, two options: **Demo** · **User**. Present in
  both modes — a mode you cannot leave is a trap.
- In User view it is visually quiet: small, low-contrast, no accent colour. Present and
  findable, not part of the product's visual language.
- URL parameter `view=demo` (default) or `view=user`, like every other piece of state.
- Keyboard shortcut `D` toggles it, since the Loom recording flips modes repeatedly.
- Transition is a ~250 ms cross-fade with the card grid settling into its new layout, not a
  reload. Respects `prefers-reduced-motion`.

#### Carrying a modified configuration into User view

Weights and toggles set in the Ranking Lab **persist** when switching to User view. This is
the most useful thing the toggle does: set the Popularity-led preset, flip to User view, and
the page a customer would see now leads with a course that 78% of buyers never finish. The
consequence of a weighting decision becomes a product screenshot.

Because that page is no longer driven by default settings, User view shows a small, quiet,
dismissible chip when the configuration differs from Balanced defaults: *"Ranking parameters
modified in Demo view."* Silently presenting a hand-tuned ranking as "what users see" would be
the one genuinely misleading thing this prototype could do.

### 5.8 Full-list view and course deep links

Measured against the deployed build, the hero category ranks the two most important demo cases
at positions **13** and **14** — both on page 2 at 12 per page. That is correct ranking
behaviour and a broken demo:

- The strongest single moment in the walkthrough is watching the 5.00-rated course travel from
  position 13 to position 3 when shrinkage is switched off. **A course cannot be animated across
  a page boundary.** With the "before" state on page 2 and the "after" state on page 1, the
  reordering animation has nothing to show.
- The gate-refused sponsored course, at position 14, is invisible until the viewer paginates.
  Requiring a reviewer to go looking for the most important case in the dataset loses most of
  them.

Two additions fix this without distorting the listing:

**"Show all 16 in this category"** — a control in the toolbar that disables pagination for the
current category. Off by default, so pagination remains a real, demonstrable behaviour with its
deterministic tie-breakers (§5.1, `01` §5.1); on for the entire Loom recording, so every
reorder is visible end to end. Part of the URL as `all=1`. Available in both view modes — a
customer wanting the whole category on one page is an ordinary preference, not a debug tool.

**`focus=<courseId>`** — a URL parameter that paginates to whichever page holds the course,
scrolls it into view, applies a brief highlight, and in Demo view expands its Score Inspector.
This is what makes the deep links in the README land on a specific argument instead of on a
list the viewer then has to search. `focus` is honoured in both modes; in User view it scrolls
and highlights without opening an inspector that does not exist there.

Neither control touches the ranking. `all=1` changes pagination only; `focus` changes scroll
position and disclosure state only. The §5.7 equality invariant still holds.

---

## 6. Behaviour requirements

- **All computation is synchronous and client-side** over 64 records. No loading states, no
  skeletons — there is nothing to wait for, and faking latency would be dishonest.
- Filter, sort and weight changes reflect in under 100 ms.
- URL contains view mode, category, subcategory, all filters, sort mode, page, weights and
  toggles. Reload restores the exact view. Back/forward navigate configuration history.
- Deterministic ordering: identical URL always yields an identical list, including
  pagination boundaries.
- Keyboard accessible in **both view modes**: all filters reachable and operable by keyboard;
  in Demo view the inspector disclosure is a real `<button>` with correct `aria-expanded`.
- Contrast meets WCAG AA in both modes. In Demo view, score bars are distinguishable without
  relying on colour alone — each segment is labelled.
- Responsive down to 768px: sidebar collapses into a sheet. Below that, functional but not
  optimised — stated openly rather than pretended.

---

## 7. Acceptance criteria

The prototype is done when all of the following are true, checked in the deployed build:

Criteria 2–9 are all checked **in the default view** — Demo mode, hero category. That is what
the hero category is for.

1. Default view is Demo mode, *AI & Machine Learning*, Recommended, no filters, Balanced
   weights, page 1.
2. The 5.00-rated / 6-rating course is **outside the top 8** (position 13 in the current
   dataset); expanding it shows raw 5.00 and adjusted 4.38 side by side with the shrinkage
   explanation.
3. With "Show all" on, switching shrinkage off moves that course up by **at least 6 positions**
   (13 → 3 in the current dataset), visibly animated with no page change.
4. Switching to "Highest rated" removes it and shows the gate note with a computed count of at
   least 3, and the count reveals the excluded courses when clicked.
5. Switching the Outcome factor off moves the 96k-enrolment course up by **at least 3
   positions** (8 → 4 currently). The Popularity-led preset makes it the **first organic
   result** — rendered at position 3, because the two-course promoted band sits above it.
6. Positions 1 and 2 are the promoted band: a labelled **Sponsored** course first, a **Featured**
   course second, never more than two, each with all four gate conditions ticked. The Sponsored
   inspector shows a "would rank #N organically" line with N between 5 and 9.
7. **No course placed in the band sits at a position worse than its organic rank**, with the
   quality gate both on and off (`01` §7.2), in every category. A promoted course that misses the
   band may still be displaced by the ones that took it — with the gate off, the Featured course
   drops from organic 4 to position 6 — which is correct and must not be asserted against.
   Covered by an automated test.
8. Position 3 onward is pure organic order, with no promoted result interleaved anywhere below
   the band.
9. The below-average sponsored course appears in its organic position, and its inspector reads
   *"Promotion not applied — adjusted rating 3.97 is below the category mean of 4.31."*
   Disabling the promo quality gate moves it to position 1 with its badge attached.
10. Selecting "Price: low to high" removes all promoted placements and shows the suppression
   note; free courses appear first.
11. At most 2 courses by the same instructor in the top 10; disabling the cap brings a third in.
12. Cybersecurity reports the global normalisation basis with a candidate count of 4, and the
    policy-flagged course is absent.
13. Applying a filter does not change any visible score (scores are relative to the category,
    `01` §4.1) — check one card's score before and after.
14. Every filter option displays a live result count; zero-yield options are disabled; a search
    query with no matches shows the designed empty state with a working relaxation link.
15. Copying the URL into a fresh tab reproduces the view exactly, including weights and
    toggles; browser back/forward walks the configuration history.
16. Lighthouse: no accessibility errors. No console errors or warnings.
17. `npm run build` completes with zero TypeScript errors and zero ESLint warnings.
18. The dataset generator's invariant assertions all pass, including the demo-integrity block
    in `02` §5.

**View modes (§5.7)**

19. Switching to User view removes every item in the §5.7 removal list, and the card grid
    reflows — no empty column where the score used to be.
20. **The ordered list of course ids is identical in both modes**, verified for at least three
    configurations: defaults, a filtered view, and the Popularity-led preset. Covered by an
    automated test, not only by eye.
21. Sponsored and Featured badges are still present and still labelled in User view.
22. Setting the Popularity-led preset in Demo view and switching to User view shows the
    96k-enrolment course as the first organic result, with the "Ranking parameters modified in
    Demo view" chip visible. Resetting to Balanced removes the chip.
23. `view=user` in the URL loads User view directly; the toggle is findable in both modes; `D`
    switches between them.

**Full-list view and deep links (§5.8)**

24. "Show all" disables pagination for the current category, is reflected in the URL as `all=1`,
    and is available in both view modes. With it off, pagination behaves as before.
25. `focus=<courseId>` paginates to, scrolls to and highlights the named course, and expands its
    inspector in Demo view. It resolves correctly for a course on page 2 with `all=1` absent.
26. Lighthouse and console checks (criterion 16) pass in **both** view modes, since each is a
    distinct rendering path.

## 8. Out of scope, stated for the reviewer

Demo view includes a short "Scope and limitations" note: static dataset, no backend, metrics
are synthetic, ratings are not recency-weighted (`01` §3.1), personalisation and learned
ranking not implemented, mobile below 768px unoptimised. Naming the limits is more convincing
than hoping they go unnoticed.

The note is absent from User view, which is the correct behaviour — it is addressed to the
reviewer, not to a customer.
