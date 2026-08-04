# Course Ranking Algorithm

**Scope:** ranking, sorting and filtering of courses inside a category on a multi-category
course marketplace.
**Status:** design document for the accompanying UI prototype.

---

## 1. The core distinction

Most course listings conflate two different mechanisms. This design separates them
explicitly, because they answer different questions and obey different rules.

| | **Default ranking** | **User-controlled sort & filter** |
|---|---|---|
| Trigger | User has expressed no preference | User has expressed an explicit preference |
| Question it answers | "Which of these courses is most worth your time?" | "Do exactly what I asked" |
| Mechanism | Composite score across five factors | Single-key ordering / candidate removal |
| Who owns it | The platform | The user |

The rule between them: **explicit user intent always wins.** When a user chooses
"Price: low to high", the composite score is not consulted at all. When a user applies a
filter, a course that fails it never appears — regardless of score, and regardless of
whether it is promoted.

Filters are not a scoring factor. They remove courses from the result set; they do not
change any course's score.

---

## 2. What the default ranking is trying to measure

The composite score answers five plain questions about a course. Each question maps to
exactly one factor.

| # | Question | Factor | Weight |
|---|---|---|---|
| 1 | Is it good? | **Quality** — a rating you can trust | 0.35 |
| 2 | Do people actually finish it? | **Outcome** | 0.20 |
| 3 | Is there demand for it? | **Popularity** | 0.20 |
| 4 | Is it still current? | **Freshness** | 0.15 |
| 5 | Does it match what was asked for? | **Fit** | 0.10 |

```
Score = 0.35·Quality + 0.20·Outcome + 0.20·Popularity + 0.15·Freshness + 0.10·Fit
```

Weights are configuration, not code. The prototype exposes them as sliders so the effect of
each factor on the visible ordering can be observed directly.

### Why Quality dominates but does not decide alone

Quality at 0.35 cannot by itself put a course first: a course with a top rating but poor
completion, no demand and a three-year-old syllabus loses to a slightly lower-rated course
that is healthy on the other four factors. That is the intended behaviour. A rating measures
how people felt at the moment they were asked; the other factors measure whether the course
still works.

---

## 3. Factor definitions

### 3.1 Quality — a rating you can trust

A raw average rating is not usable for ranking. A course with 5.0 from 4 reviews would
outrank a course with 4.7 from 8,000 reviews, which is wrong: the first number carries
almost no information.

The fix is Bayesian shrinkage. Each course's rating is pulled toward its category average
until it has accumulated enough reviews to speak for itself:

```
          v · R  +  m · C
R_adj  =  ─────────────────
             v  +  m

R = raw average rating of the course
v = number of ratings
C = mean raw rating of the category (the prior)
m = confidence threshold — the review count at which
    the course's own rating and the prior carry equal weight
```

`m = 50` for this design. `C` is computed over the **whole category after the policy gate
only** — not over the user's filtered subset, and not over the set remaining after the
sort-specific `ratingCount ≥ 20` gate.

This makes `R_adj` a stable property of a course. If `C` were recomputed after the rating
gate, removing the low-count courses would move the category mean, and the same course would
display a different adjusted rating in "Recommended" than in "Highest rated" — with the
inspector unable to explain why. `C` is a property of the catalogue, not of the current
query.

Behaviour, with `C = 4.31`:

| Course | Raw | Ratings | `R_adj` |
|---|---|---|---|
| A | 5.00 | 4 | 4.36 |
| B | 4.70 | 8,000 | 4.70 |
| C | 4.90 | 120 | 4.73 |
| D | 3.60 | 60 | 3.92 |

Course A drops to essentially "unknown, assume average". Course C, with 120 ratings, keeps
most of its advantage. Course D, poorly rated but with enough reviews to mean it, is only
partly rescued. This is a single formula and it is the one piece of mathematics in the model
that cannot be removed without breaking it.

**Rating recency.** Ratings older than the current content revision describe a course that no
longer exists. In production, each rating should be weighted by exponential decay with a
9-month half-life before `R` and `v` are computed, so a course that has degraded cannot coast
on its 2023 reputation — `v` then becomes an *effective* rating count that also feeds the
confidence term above.

*Not implemented in the prototype.* The static demo dataset carries plain integer rating
counts, because per-rating timestamps are not part of it. This is stated in the prototype's
limitations note rather than papered over: the model calls for recency weighting, the demo
does not apply it.

### 3.2 Outcome — do people actually finish it

This is the anti-clickbait layer, and the factor most listings omit. High enrolment with low
completion is the signature of a course with a good landing page and a bad body.

```
Outcome_raw = 0.5 · completionRate
            + 0.3 · medianWatchPercent
            + 0.2 · (1 − refundRate)
```

All three inputs are behavioural rather than declared, so they are considerably harder to
manipulate than a rating. Completion rate carries the most weight; refund rate is inverted,
and acts as a strong negative signal when it spikes.

Caveat worth stating: completion rate is biased against long and advanced courses, where
lower completion is normal. Percentile normalisation within category (§4) absorbs most of
this, since a course is compared to its peers rather than to an absolute standard.

### 3.3 Popularity — demand, compressed

Raw enrolment counts span several orders of magnitude, so they are log-compressed before use:

```
Popularity_raw = log10(1 + enrollments)
```

Without compression, popularity swamps every other factor and the ranking degenerates into
"most enrolled first" — which entrenches incumbents and prevents any new course from ever
being discovered.

### 3.4 Freshness — is it still current

```
Freshness_raw = exp( −ageDays / τ ),   τ = 540 days
ageDays = days since the last content update
```

`ageDays` is measured from the last **content** update, not from publication and not from
cosmetic edits, otherwise the signal is trivially farmed by re-uploading a thumbnail.

A single decay constant is used for all categories. This is deliberate: because freshness is
normalised *within* category (§4), the model automatically becomes stricter in fast-moving
categories and more forgiving in stable ones, without maintaining a separate constant per
category. In a category where everything was updated last month, freshness stops
differentiating and the other factors decide. In a category where one course was updated
last month and the rest three years ago, that course gains a large advantage.

### 3.5 Fit — does it match what was asked for

Fit is the only factor computed per request rather than precomputed, because it depends on
what the user did.

```
Fit_raw = 0.5 · tagOverlap(course, selectedSubcategory)
        + 0.3 · textMatch(course, searchQuery)
        + 0.2 · softMatch(level, duration preferences)
```

When the user has selected a category but expressed nothing more specific, `Fit_raw` is
identical for every course. Under the tie-aware normalisation in §4 this yields 0.5 for all
of them, so the factor contributes a constant and has no effect on relative ordering. It
becomes meaningful only with a search query or a subcategory selection. This keeps the factor
honest: it contributes only when there is actual intent to match against.

Fit is intentionally rule-based here. The learned-relevance version is discussed in §9.

---

## 4. Normalisation

The five raw factors are measured in incompatible units — a 1–5 rating, a log count, a 0–1
decay, a rate. Before they can be combined they must be mapped to a common scale.

**Each factor is converted to its percentile rank within the category**, using midranks so
that tied values share a percentile:

```
             |{ c : f(c) < f(x) }|  +  0.5 · |{ c ≠ x : f(c) = f(x) }|
norm(f, x) = ───────────────────────────────────────────────────────────
                                  N − 1

N = number of courses in the normalisation basis (§4.1)
```

Consequences worth noting: a unique maximum normalises to 1.0, a unique minimum to 0.0, and
a factor with the same value for every course normalises to 0.5 for every course — which is
what makes Fit inert when there is no query, rather than zero for everyone.

Percentile ranking is chosen over min-max scaling for two reasons:

1. **Robust to outliers.** One course with 900,000 enrolments would, under min-max scaling,
   compress every other course into the bottom few percent of the popularity range.
   Percentile ranking is unaffected.
2. **No per-category tuning.** Absolute distributions differ sharply between categories —
   average ratings, typical enrolment, typical update cadence. Percentiles are
   self-calibrating, which is what allows a single decay constant and a single weight set to
   work everywhere.

The trade-off, stated plainly: percentile scores are **relative, not absolute**. A score of
0.72 means "better than most of this category", not "good in absolute terms", and scores are
not comparable across categories. This is acceptable because in the target scenario ranking
always happens within one category. Cross-category surfaces (global search, home page) would
require absolute normalisation and are out of scope.

### 4.1 The normalisation basis

Percentiles are computed over **the whole category after gating and before user filters**
(§5, stages 2→3), not over the filtered result set.

This is the more important of the two possible choices. If percentiles were recomputed over
the filtered set, a course's score would change every time the user ticked a checkbox — the
same course could show 0.81 and then 0.42 without anything about it having changed, and the
Score Inspector would become impossible to reason about. Scores describe a course's standing
in its category. Filters decide which of those courses are shown.

**Small-category fallback.** With fewer than 10 courses in the basis, percentiles are too
coarse to be informative: with 5 courses the only attainable values are 0, 0.25, 0.5, 0.75
and 1. Below that threshold the factor is normalised against the global course pool instead,
and the inspector states which basis was used. Because the basis is the category rather than
the filtered set, this switch is a stable property of a category, not something that flips as
the user filters.

---

## 5. The ranking pipeline

Order of operations matters; each stage assumes the previous one has run.

```
1. CANDIDATES     all courses in the selected category
2. GATES          remove policy-flagged courses
                  in "Highest rated" mode, remove ratingCount < 20
3. SCORE          normalise each factor over the gated category
                  (§4.1), apply weights. Always computed; used as the
                  ordering key in Recommended mode only
4. HARD FILTERS   remove courses failing any user filter
5. ORDER          by the active sort key, then tie-breakers
6. DIVERSITY      max 2 courses per instructor in the top 10
7. PROMO          Recommended mode only: inject eligible promoted
                  courses into reserved slots
8. PAGINATE       12 per page
```

Two details in this ordering are load-bearing:

- Scoring happens **before** filtering, for the reason given in §4.1. A consequence worth
  making explicit: the "minimum rating" filter therefore operates on the **adjusted** rating,
  which is already available by the time filters run.
- Diversity runs **before** promo injection, so the instructor cap cannot be used to displace
  a paid placement, and promoted slots are not consumed by the diversity pass.
- The score is computed in every sort mode, not only in Recommended. Over a catalogue this size
  it costs nothing, and it means a card can carry its score in any sort mode — including while
  the user is sorting by price, where seeing that the cheapest course scores 0.31 is exactly the
  useful comparison. The sort mode decides the ordering key, not whether the score exists.
  (Whether the score is *displayed* is a separate, presentation-level question — see
  `03-prototype-prd.md` §5.7.)

### 5.1 Tie-breakers

Ties are broken deterministically, in order:

1. `R_adj` (descending)
2. rating count (descending)
3. last content update (descending)
4. stable hash of course id

The final hash is not decoration. Without a total deterministic order, courses with equal
scores can swap positions between paginated requests, causing items to appear twice or
disappear entirely as the user pages through results.

### 5.2 Diversity cap

At most 2 courses from the same instructor appear in the top 10; further courses by that
instructor are demoted below position 10. Prolific instructors otherwise monopolise the first
screen of narrow categories, which degrades the result set for the user without any
corresponding gain in quality.

---

## 6. Sort modes and filters exposed to the user

**Sort modes**

| Mode | Ordering key | Notes |
|---|---|---|
| Recommended *(default)* | Composite score | The only mode with promo injection |
| Highest rated | `R_adj` desc | Gated at ≥ 20 ratings |
| Most popular | enrolments desc | Raw count, not compressed — user asked literally |
| Newest | last content update desc | |
| Price: low to high | price asc | Free courses first |
| Price: high to low | price desc | |
| Shortest first | duration asc | |

"Highest rated" uses the **adjusted** rating, not the raw average. Sorting by raw average
returns a first page composed almost entirely of courses with a handful of reviews, which is
the single most common failure in course listings. The ≥ 20 gate is a second line of defence:
below that count, a rating is not a claim worth surfacing at the top of a list.

**Filters**

Category / subcategory · minimum rating · level · duration bucket · price range and
free-only · language · certificate · updated within N months · instructor.

The minimum-rating filter (4.5+ / 4.0+ / 3.5+) is applied to `R_adj`, not to the raw average,
and is labelled as such in the UI. Filtering on the raw value would reintroduce exactly the
problem §3.1 exists to solve.

Filter semantics: `AND` across filter types, `OR` within a multi-select filter. Every filter
shows the resulting count before it is applied, and no filter combination is allowed to
produce a dead end without an explanation and a suggested relaxation.

---

## 7. Promoted placements

The platform has a legitimate commercial interest in promoting courses. The mechanism used to
satisfy it determines whether the ranking remains measurable.

### 7.1 Promotion never enters the score

Adding a boost term to the composite score destroys the ability to answer "is this course
here because it is good, or because it was paid for?" — for the user, for the platform's own
analytics, and for a regulator. Once the boost is inside the score, organic quality is no
longer observable.

Instead: **promoted courses are injected into reserved slots, and their organic score is left
untouched.**

### 7.2 Slot mechanics

- Reserved positions: **1** and **6**, then one slot per subsequent 10 results.
- Promo density never exceeds 20% of a page; two promoted results are never adjacent.
- Within the promoted pool, ordering is `priority × Quality × predictedCTR`, so relevance
  still governs which promoted course wins the slot.
- Every promoted result carries a visible label, and its organic position remains inspectable:
  *"Promoted · would rank #5 organically."* The label is shown to everyone; the organic-rank
  line is part of the explanatory layer and appears in the prototype's Demo view
  (`03-prototype-prd.md` §5.7).

### 7.3 The quality gate

A promoted course is only eligible for a slot if it independently passes:

- `R_adj ≥` the category mean rating
- rating count `≥ 20`
- no active policy flags
- content updated within the last 24 months

**Promotion accelerates good courses; it cannot substitute for quality.** A promoted course
that fails the gate is not placed — it simply appears in its organic position. This is the
constraint that keeps the listing trustworthy, and it is the part of the promo design that
matters most.

### 7.4 Interaction with user intent

- **Filters override promotion, always.** A promoted course that fails an active filter does
  not appear. No exceptions.
- **Explicit sort suppresses promotion.** In "Price: low to high", a paid placement at the top
  is straightforwardly broken — the user asked a precise question and received an answer to a
  different one. Promo injection is therefore active only in Recommended mode.

### 7.5 Two kinds of promotion, kept separate

| | **Sponsored** | **Featured** |
|---|---|---|
| Paid by | Third party (instructor, publisher) | No one — platform's own decision |
| Purpose | Advertising | Editorial curation: seasonal, new category, in-house content |
| Label | "Sponsored" | "Featured" |
| Disclosure | Legally required | Good practice |

Under the EU Digital Services Act and the Platform-to-Business Regulation, paid influence on
ranking must be disclosed, and the main ranking parameters must be described publicly.
Keeping paid and editorial promotion in separate pools with separate labels and separate slot
budgets satisfies this and prevents editorial curation from quietly becoming an unlabelled ad
channel.

---

## 8. Validation

The model above is a hypothesis. What makes it a ranking system rather than a formula is the
measurement around it.

**Offline.** NDCG@10 and MRR against held-out engagement, replayed on historical sessions.
Used for fast iteration on weights; never used alone to ship.

**Online (A/B).** Primary: enrolment rate from the listing, and completion rate of courses
enrolled *from* the listing — the second matters more, since optimising clicks alone selects
for misleading titles.

**Guardrails** — a variant that wins on the primary metric but trips any of these does not
ship:

| Guardrail | Why |
|---|---|
| Refund rate on listing-attributed enrolments | Detects ranking that sells the wrong course |
| Long-tail exposure (share of impressions outside the top 50 courses) | Detects incumbent lock-in |
| Promoted-slot CTR vs. organic CTR at the same position | If lower, the promotion is actively harming the page |
| Zero-result and dead-end filter rate | Detects filter design failures |
| Complaint and report rate | Catches manipulation the score missed |

**Weight tuning.** Weights start from product judgement — as stated above — and are then
adjusted by A/B, one factor at a time. Fitting all five simultaneously to a single engagement
metric reliably produces a popularity-dominated ranking, because engagement is what popular
courses already have.

---

## 9. Deliberately out of scope

Each of these is a real improvement, excluded to keep the first version explainable and
measurable.

**Personalisation.** The current model produces one ordering for everyone in a category. The
natural extension is a per-user relevance term added alongside Fit, built from prior
enrolments, completed levels, declared goals and language. It is excluded here because it
makes the ranking unauditable from the outside — two users see different lists and neither can
be explained by the published parameters — and because it requires a user history this design
does not assume.

**Learned relevance (learning-to-rank).** Replace the hand-weighted sum with a model trained
on click, enrolment and completion labels, in a two-stage retrieve-then-rank architecture.
Strictly better once there is traffic; strictly worse before there is, because it has nothing
to learn from and cannot be reasoned about when it misbehaves.

**Rating recency weighting.** Specified in §3.1, not applied to the static demo dataset.

**Trending / velocity.** Enrolments in the last 30 days against a trailing baseline, as a
separate factor and a separate sort mode. Surfaces courses on the way up rather than courses
that are already large.

**Per-category decay constants.** Explicit τ per category instead of relying on
within-category normalisation, for cases where absolute recency matters.

**Exploration slots.** One slot in the top 10 reserved for a cold-start course, ε-greedy.
Without exploration, a new good course never accumulates the signal it needs to rank, and the
catalogue slowly freezes. Cold-start seeding: the instructor's historical `R_adj` plus the
category prior, with the prior's weight decaying as real ratings arrive.

**Anti-gaming penalties.** Review-burst anomaly detection, instructor-level bad-actor
propagation, and coordinated-rating clustering. The Outcome factor already makes the cheapest
form of gaming ineffective, since behavioural signals cannot be purchased as easily as
reviews.

---

## 10. Worked example

Category: *AI & Machine Learning*, 16 courses in the normalisation basis (so the percentile
denominator is 15). Recommended mode, no search query. Category mean raw rating `C = 4.31`.

Three of the sixteen:

| | Course A | Course B | Course C |
|---|---|---|---|
| Raw rating | 5.00 | 4.60 | 4.75 |
| Ratings | 6 | 5,400 | 310 |
| `R_adj` | 4.38 | 4.60 | 4.69 |
| Completion | 41% | 22% | 58% |
| Refunds | 3% | 11% | 2% |
| Enrolments | 210 | 96,000 | 14,300 |
| Last updated | 1 month | 26 months | 5 months |

Percentiles within the basis, and the resulting score:

| Factor | Weight | A | B | C |
|---|---|---|---|---|
| Quality | 0.35 | 0.267 | 0.533 | 0.867 |
| Outcome | 0.20 | 0.467 | 0.067 | 0.933 |
| Popularity | 0.20 | 0.067 | 1.000 | 0.400 |
| Freshness | 0.15 | 0.933 | 0.133 | 0.667 |
| Fit | 0.10 | 0.500 | 0.500 | 0.500 |
| **Score** | | **0.39** | **0.47** | **0.72** |

Reading the result:

- **Course B** has 96,000 enrolments and the top popularity percentile in the category, and
  still loses — 22% completion and an 11% refund rate against a two-year-old syllabus. Under
  the Popularity-led weight preset it moves to first place, which is precisely the failure
  mode the Outcome factor was added to prevent.
- **Course A** has a perfect 5.00 rating and finishes well down the list. Six ratings carry no
  information, so shrinkage moves it to just above the category average; freshness is its only
  strength. A raw-rating sort would have placed it first.
- **Course C** leads this group on the factors that describe whether the course works —
  trustworthy rating, strong completion, recently updated — despite unremarkable demand. Six
  other courses in the category outscore it, so it is not the first result overall; it is the
  best of these three by a wide margin.

Both of the two most common ranking failures — rank-by-raw-rating and rank-by-enrolments —
would have put a different and worse course at the top of this group.

These are planted demo cases 1, 2 and 5 in the prototype dataset, so the table can be checked
against the deployed Score Inspector line by line.
