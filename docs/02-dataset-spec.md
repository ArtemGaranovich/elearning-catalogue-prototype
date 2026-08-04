# Demo Dataset Specification

The dataset is not filler. Every mechanic described in `01-ranking-algorithm.md` must be
**visible in the prototype without the reviewer having to imagine it**. That means the data is
designed, not randomly generated: specific courses are planted to make specific behaviours
observable, and the rest is generated around them to make the catalogue feel real.

---

## 1. Hard constraints

- **Static and committed.** JSON files in the repository. No backend, no database, no runtime
  generation. What the reviewer sees is what is in the repo.
- **Deterministic.** Generated once by a seeded script, then frozen. Re-running the script must
  reproduce the same files byte-for-byte.
- **Frozen "today".** A constant `DATASET_AS_OF = "2026-08-01"` is used as *now* in every age
  and decay calculation, instead of `Date.now()`. Without this, freshness percentiles drift
  over time and the planted cases stop demonstrating what they were built to demonstrate.
- **No image assets.** Course cards use a deterministic CSS gradient derived from the course id
  plus a category colour and icon. Nothing to host, nothing to break.

---

## 2. Shape

**64 courses across 6 categories, 22 instructors.**

| Category | Courses | Role |
|---|---|---|
| **AI & Machine Learning** | **16** | **Hero category.** The default view. Carries almost every planted case. |
| Web Development | 13 | The only promo case outside the hero category; general depth |
| Data & Analytics | 10 | Balanced baseline; one non-English course |
| Design & UX | 10 | Low prices, high completion — a visibly different profile |
| Business & Marketing | 10 | Weakest outcome metrics, strongest marketing |
| Cybersecurity | 5 | **Deliberately small** — the only category below the < 10 fallback threshold |

Every category except Cybersecurity sits at 10 or above, so Cybersecurity is the *only* one
that uses the global normalisation basis. This is deliberate: if two categories fell below the
threshold the fallback would stop reading as a designed edge case and start looking like an
accident.

**Why one hero category.** The reviewer opens the link and sees one category. If the
demonstrations are scattered across six, most of them are never found. AI & Machine Learning
therefore holds shrinkage, outcome, cold-start, all three hero promo cases, the diversity cap,
the free course and a non-English course — so the default view alone proves the model. The
other five categories exist to make percentile normalisation meaningful and to give the
catalogue plausible breadth.

16 in the hero category means the largest page is full (12 per page) with a second page,
while the set stays small enough to hand-tune and hand-verify.

**Hero category mean raw rating is 4.31**, and this number is load-bearing: cases 5 and 6
below are defined relative to it.

Instructor distribution is uneven on purpose: one instructor owns 5 courses in AI & Machine
Learning, most own 1–3.

---

## 3. Course schema

```jsonc
{
  "id": "c-042",
  "slug": "applied-ml-for-analysts",
  "title": "Applied ML for Analysts",
  "subtitle": "From spreadsheets to a deployed model in 8 weeks",
  "categoryId": "ai-ml",
  "subcategoryId": "applied-ml",
  "tags": ["python", "scikit-learn", "feature-engineering"],
  "instructorId": "i-07",

  "level": "intermediate",          // beginner | intermediate | advanced
  "language": "en",                 // en | de | es | pl
  "durationHours": 14.5,
  "lessonsCount": 62,
  "hasCertificate": true,

  "price": 79,                      // USD; 0 = free
  "originalPrice": 129,             // null when not discounted

  "publishedAt": "2024-03-11",
  "lastContentUpdateAt": "2026-03-01",

  "ratingAvg": 4.75,
  "ratingCount": 310,
  "ratingDistribution": [2, 3, 8, 45, 252],   // 1★ → 5★

  "enrollments": 14300,
  "enrollments30d": 940,            // unused in v1; kept for the Trending extension

  "completionRate": 0.58,
  "medianWatchPercent": 0.71,
  "refundRate": 0.02,

  "promo": {
    "type": "sponsored",            // sponsored | featured | null
    "priority": 0.8,                // 0..1, within-pool ordering
    "predictedCtr": 0.061
  },

  "policyFlags": []                 // e.g. ["under-review"]
}
```

**Instructor record**

```jsonc
{
  "id": "i-07",
  "name": "Dr. Elena Marsh",
  "headline": "ML engineer, ex-search infrastructure",
  "coursesCount": 3,
  "historicalRatingAvg": 4.61       // used for cold-start seeding
}
```

### Field notes

- `ratingCount` is a **plain integer count**. The recency weighting described in
  `01-ranking-algorithm.md` §3.1 is not applied to this dataset — per-rating timestamps are not
  part of it — and the prototype's limitations note says so.
- `ratingDistribution` must sum to `ratingCount` and reproduce `ratingAvg` to within 0.05. It
  is skewed realistically: real course ratings are J-shaped, heavy on 5★ with a small 1★ tail,
  not bell-shaped. The example above: sum 310, weighted mean 4.748.
- `lastContentUpdateAt` is always ≥ `publishedAt`, and for the stale cases the gap is large and
  intentional.
- `promo` is non-null on **exactly 4 courses** — cases 5, 6, 7 and 15 below, and no others. One
  of them fails the quality gate by design.

---

## 4. Planted cases

These are the reason the dataset exists. Each row is a course whose numbers were chosen so that
a specific mechanic becomes visible on screen. Unless stated otherwise, the course is in the
hero category.

| # | Course | Planted numbers | What it demonstrates |
|---|---|---|---|
| 1 | *Machine Learning Fundamentals Reloaded* | raw 5.00, **6** ratings, 210 enrolments, completion 41%, refunds 3%, updated 1 month ago | **Bayesian shrinkage.** `R_adj` 4.38. Perfect score, well outside the top 8. In "Highest rated" it is removed by the ≥ 20 gate. This is Course A of the worked example in `01` §10. |
| 2 | *The Complete AI & Machine Learning Bootcamp* | raw 4.60, **5,400** ratings, **96,000** enrolments, completion **22%**, watch 31%, refunds **11%**, updated **26 months** ago | **Outcome layer.** Top popularity percentile in the category and still not first. Course B of `01` §10. |
| 3 | *Deep Learning with TensorFlow 2* | raw 4.81, 3,100 ratings, updated **34 months** ago | **Freshness decay.** Genuinely well-reviewed, visibly demoted for being stale. Shows the model punishing content rot, not bad teaching. |
| 4 | *Prompt Engineering for Product Teams* | published 6 weeks ago, raw 4.90, **11** ratings, 780 enrolments | **Cold start.** Good but unproven; mid-table. Makes the case for the exploration slot in `01` §9. |
| 5 | *Applied ML for Analysts* | `promo.type = "sponsored"`, raw 4.75, 310 ratings, `R_adj` 4.69 — **above** the 4.31 category mean | **Promo, gate passed.** Injected into slot 1, labelled, organic rank #7 shown in the inspector. Course C of `01` §10, and the `c-042` schema example in §3. |
| 6 | *AI Growth Hacking Masterclass 2026* | `promo.type = "sponsored"`, raw **3.90**, **243** ratings → `R_adj` **3.97**, **below** the 4.31 category mean | **The quality gate.** Paid promotion *refused* a slot; appears in its organic position instead. The single most important case in the dataset. The 243 count is exact: it is what makes `R_adj` land on 3.97. |
| 7 | *AI Product Management Essentials* | `promo.type = "featured"`, no third-party payment, passes the gate | **Featured vs Sponsored.** Different label, different pool, editorial rather than paid. Takes slot 6. |
| 8 | *Marcus Webb* — **5** courses in the hero category, 3 of them strong enough for the top 10 | | **Diversity cap.** The third is demoted below position 10. Toggle the cap off and it returns. |
| 9 | *Intro to Python for ML* | `price = 0`, raw 4.55, 41,000 enrolments | **Free-only filter**, and price sorting with zeros first. |
| 10 | *Advanced MLOps on Kubernetes* | raw 4.72, completion **34%**, advanced, **31 hours** | **The Outcome caveat.** Low completion that is normal for the level — shows why completion is read relative to the category, not absolutely. |
| 11 | *Maschinelles Lernen mit Python* | `language = "de"`, in the hero category | **Language filter with a visible effect in the default view.** |
| 12 | *Reinforcement Learning Crash Course* | **14** ratings | Third sub-20-rating course in the hero category, so the "Highest rated" gate note reports a count above 2. |
| 13 | Cybersecurity category — 5 courses, one of them case 14 | below the 10-course threshold | **Small-category fallback.** The inspector states that normalisation used the global pool. |
| 14 | *Ethical Hacking Bootcamp* (Cybersecurity) | `policyFlags: ["under-review"]` | **Gate removal.** Present in the data, absent from results, with a stated reason. Leaves 4 candidates in Cybersecurity. |
| 15 | *The Full-Stack TypeScript Path* (Web Development) | `promo.type = "sponsored"`, passes the gate | Shows promo is a platform-wide mechanism, not a hero-category prop. |
| 16 | *Data Storytelling* (Data & Analytics, `de`), *UX Research Foundations* (Design & UX, `es`) | | Language filter outside the hero category. |

Roughly 18 courses are specified above. The remaining ~46 are generated with plausible
correlated distributions — enrolments log-normal; raw ratings concentrated 4.1–4.8; price
loosely tracking duration and level; completion inversely related to duration; J-shaped rating
distributions — so that percentile ranking has a realistic spread to work against and the
planted cases do not look like the only real rows.

---

## 5. Generation and verification

A single script, `scripts/generate-dataset.ts`, holds the planted courses as literals,
generates the remainder from a fixed seed, and writes `src/data/courses.json` and
`src/data/instructors.json`.

The same script asserts the invariants below before writing anything. If any fails, no file is
produced.

**Data integrity**

- `lastContentUpdateAt >= publishedAt` for every course
- `sum(ratingDistribution) === ratingCount`
- `ratingAvg` matches `ratingDistribution` to within 0.05
- all rates in `[0, 1]`; `durationHours > 0`; `price >= 0`
- every `instructorId`, `categoryId` and `subcategoryId` resolves
- category counts are exactly 16 / 13 / 10 / 10 / 10 / 5, summing to 64
- exactly one category has fewer than 10 courses

**Demo integrity** — these are the ones that matter. They assert that the *demonstrations*
still work, so that a future change to the weights or the gate fails the build instead of
quietly making the demo unconvincing.

- the hero category's mean raw rating rounds to **4.31**
- every other category's mean raw rating falls in `[3.9, 4.7]`
- exactly 4 courses carry a `promo` object; exactly 1 of them fails the quality gate, so
  exactly 3 pass
- case 6's `R_adj` rounds to **3.97** and is strictly below the hero category mean
- **at least 3** courses in the hero category have `ratingCount < 20`
- one instructor has exactly 5 courses in the hero category, at least 3 of which would enter
  the top 10 without the diversity cap
- with default weights, case 1 is **outside the top 8** of the hero category
- with shrinkage disabled, case 1 rises by **at least 6 positions**
- with the Outcome factor disabled, case 2 rises by **at least 3 positions**
- under the Popularity-led preset, case 2 is **position 1**
- with default weights, case 5's organic rank is in `[5, 9]` — the inspector's "would rank #N
  organically" line needs a non-trivial N
- Cybersecurity yields exactly 4 candidates after gating, and reports the global
  normalisation basis

The generator prints a summary table on success: courses per category, category mean ratings,
the four promo courses with their gate status, and the computed positions referenced by the
assertions above.
