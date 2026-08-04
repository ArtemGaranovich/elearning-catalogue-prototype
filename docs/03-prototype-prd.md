# Prototype Requirements

**What this is:** a public, frontend-only web demo of the sorting, filtering and ranking
logic described in `01-ranking-algorithm.md`.
**Audience:** the reviewer of the test task, plus a small number of internal viewers. Not
production, not multi-user, no auth.

---

## 1. Goal

The prototype has one job: **make the ranking algorithm visible.**

A course listing that merely looks nice proves nothing — any ordering could be behind it.
The prototype must let a viewer see *why* a course is in position N, change the inputs, and
watch the ordering respond. Everything below serves that goal; anything that does not serve
it is out of scope.

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
| Hosting | Vercel |

Rationale for URL-as-state: every configuration of filters, sort mode and weights becomes a
shareable link. This makes the Loom recording reproducible and lets the reviewer land
directly on a specific demonstration.

---

## 4. Screens

One page. Three regions.

```
┌────────────────────────────────────────────────────────────┐
│  Header: title · category tabs · search · "How ranking     │
│  works" link                                               │
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

Below the listing: a **"How ranking works"** section — the five questions from the document
in plain language, the weight table, and the pipeline order. Two paragraphs, not the whole
document. Its purpose is to let the page stand on its own if the reviewer opens the link
before watching the video.

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
used in acceptance criterion 12.

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
- For promoted courses: *"Promoted · slot 1 · would rank #7 organically"*, plus the gate
  check with each of the four conditions ticked.
- For gate-rejected promo courses: *"Promotion not applied — adjusted rating 3.97 is below
  the category mean of 4.31."* This line is the single most important string in the
  prototype.
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
  course at position 1, which argues for the Outcome factor better than any explanation.

- Toggles: shrinkage on/off · Outcome factor on/off · diversity cap on/off · promo injection
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

---

## 6. Behaviour requirements

- **All computation is synchronous and client-side** over 64 records. No loading states, no
  skeletons — there is nothing to wait for, and faking latency would be dishonest.
- Filter, sort and weight changes reflect in under 100 ms.
- URL contains category, subcategory, all filters, sort mode, page, weights and toggles.
  Reload restores the exact view. Back/forward navigate configuration history.
- Deterministic ordering: identical URL always yields an identical list, including
  pagination boundaries.
- Keyboard accessible: all filters reachable and operable by keyboard; inspector disclosure
  is a real `<button>` with correct `aria-expanded`.
- Contrast meets WCAG AA. Score bars are distinguishable without relying on colour alone —
  each segment is labelled.
- Responsive down to 768px: sidebar collapses into a sheet. Below that, functional but not
  optimised — stated openly rather than pretended.

---

## 7. Acceptance criteria

The prototype is done when all of the following are true, checked in the deployed build:

Criteria 2–9 are all checked **in the default view**, which is the hero category — that is
what the hero category is for.

1. Default view is *AI & Machine Learning*, Recommended, no filters, Balanced weights, page 1.
2. The 5.00-rated / 6-rating course is **outside the top 8**; expanding it shows raw 5.00 and
   adjusted 4.38 side by side with the shrinkage explanation.
3. Switching shrinkage off moves that course up by **at least 6 positions**, visibly animated.
4. Switching to "Highest rated" removes it and shows the gate note with a computed count of at
   least 3, and the count reveals the excluded courses when clicked.
5. Switching the Outcome factor off moves the 96k-enrolment course up by **at least 3
   positions**; the Popularity-led preset moves it to **position 1**.
6. Slot 1 holds a labelled **Sponsored** course whose inspector shows a "would rank #N
   organically" line with N between 5 and 9, and all four gate conditions ticked. Slot 6 holds
   a **Featured** course with the other label.
7. The below-average sponsored course appears in its organic position, and its inspector reads
   *"Promotion not applied — adjusted rating 3.97 is below the category mean of 4.31."*
   Disabling the promo quality gate moves it to position 1 with its badge attached.
8. Selecting "Price: low to high" removes all promoted placements and shows the suppression
   note; free courses appear first.
9. At most 2 courses by the same instructor in the top 10; disabling the cap brings a third in.
10. Cybersecurity reports the global normalisation basis with a candidate count of 4, and the
    policy-flagged course is absent.
11. Applying a filter does not change any visible score (scores are relative to the category,
    `01` §4.1) — check one card's score before and after.
12. Every filter option displays a live result count; zero-yield options are disabled; a search
    query with no matches shows the designed empty state with a working relaxation link.
13. Copying the URL into a fresh tab reproduces the view exactly, including weights and
    toggles; browser back/forward walks the configuration history.
14. Lighthouse: no accessibility errors. No console errors or warnings.
15. `npm run build` completes with zero TypeScript errors and zero ESLint warnings.
16. The dataset generator's invariant assertions all pass, including the demo-integrity block
    in `02` §5.

## 8. Out of scope, stated for the reviewer

The deployed page includes a short "Scope and limitations" note: static dataset, no
backend, metrics are synthetic, personalisation and learned ranking not implemented, mobile
below 768px unoptimised. Naming the limits is more convincing than hoping they go
unnoticed.
