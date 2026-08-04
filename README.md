# Course Catalogue — Ranking Prototype

A frontend-only demo that makes a course ranking algorithm visible and manipulable: every
factor, weight, and promotion rule behind a course's position is inspectable, and every
control lives in the URL so any view can be shared as a link.

**Live:** https://elearning-catalogue-prototype.vercel.app/

## View modes

**Demo** shows the listing plus the full explanatory layer — scores, positions, the Ranking Lab,
the Score Inspector — for working out *why* a course is in position N. **User** shows the same
listing with that layer stripped and the card reflowed around its absence, for the ordering a
customer would actually see; the two always render the identical course order for the same
configuration, toggle with the segmented control or the `D` key, and the mode lives in the URL as
`view=demo` (default) or `view=user`.

## The five factors

| Factor | Question | Default weight |
| --- | --- | --- |
| Quality | Is it good? | 0.35 |
| Outcome | Do people actually finish it? | 0.20 |
| Popularity | Is there demand for it? | 0.20 |
| Freshness | Is it still current? | 0.15 |
| Fit | Does it match what was asked for? | 0.10 |

A course's composite score is these five factors, each a percentile within its category,
multiplied by its weight and summed. Promotion is never part of this score — it is slot
injection applied afterwards.

## Reading the Score Inspector

Demo view only — User view removes it along with the rest of the explanatory layer. Click **"Why
this rank?"** on any course. Top to bottom:

- A stacked bar of the five factor contributions, each labelled with its percentile and points.
- Per factor: the raw value, percentile, weight, and resulting contribution.
- The **normalisation basis** — the category (and count) the percentiles are relative to.
  Applying a filter never changes this number: scores are computed once, before filters run.
- For a shrunk rating, the line explaining how many ratings it had and what it was pulled
  toward.
- For a promoted course: its slot, its organic rank had it not been promoted, and all four
  gate conditions with pass/fail.
- For a promotion-eligible course that failed the gate: the exact reason and numbers.

## Demo deep links

All five carry `all=1` — "Show all in this category" — so the reordering has somewhere to
animate to and nothing sits one click away on page 2. User view goes first: it's where the Loom
recording starts.

| View | Link |
| --- | --- |
| User view | https://elearning-catalogue-prototype.vercel.app/?view=user&all=1 |
| Default Demo view (Balanced, AI & Machine Learning) | https://elearning-catalogue-prototype.vercel.app/?all=1 |
| Shrinkage disabled | https://elearning-catalogue-prototype.vercel.app/?all=1&off=shrinkage |
| Popularity-led preset | https://elearning-catalogue-prototype.vercel.app/?all=1&w=0.15%2C0.1%2C0.5%2C0.15%2C0.1 |
| Promo quality gate disabled, focused on the gate-refused course | https://elearning-catalogue-prototype.vercel.app/?all=1&off=promoQualityGate&focus=c-005 |

## Scope and limitations

Static dataset of 64 courses, frozen as of the build date — no backend, no database, no live
data. Enrolment, completion, refund, and rating figures are synthetic. Rating recency
weighting, personalisation, and learned relevance are described in the design document but not
implemented. Layout is functional but not optimised below 768px.

## Regenerating the dataset

```bash
npm run generate:dataset
```

Deterministic: re-running it produces byte-identical output. It asserts every invariant in
[`docs/02-dataset-spec.md`](docs/02-dataset-spec.md) §5 and throws rather than writing a
dataset that fails one.

## Running the tests

```bash
npm run test      # vitest, one test per planted demo case in lib/ranking/
npm run verify    # typecheck + lint + test + build
```

## Documents

Read in this order. `docs/01-ranking-algorithm.md` is the specification and wins on algorithm
questions; `docs/03-prototype-prd.md` wins on UI questions.

|                                                                 |                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| [`docs/01-ranking-algorithm.md`](docs/01-ranking-algorithm.md) | The algorithm — formulas, weights, pipeline order, promo rules  |
| [`docs/02-dataset-spec.md`](docs/02-dataset-spec.md)           | Schema, planted demo cases, generator invariants                |
| [`docs/03-prototype-prd.md`](docs/03-prototype-prd.md)         | Screens, components, behaviour, acceptance criteria              |
| [`docs/04-build-brief.md`](docs/04-build-brief.md)             | Implementation plan and deploy steps                             |
| [`docs/05-loom-script.md`](docs/05-loom-script.md)             | Video walkthrough                                                |

## Stack

Next.js (App Router) with static export, TypeScript strict, Tailwind CSS, Vitest. No backend,
no database, no API routes. State lives in the URL.

## Requirements

Node.js 20 or newer (developed against 24 LTS).
