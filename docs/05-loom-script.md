# Loom Script — 4:20

Screen: the deployed prototype, **staying in the AI & Machine Learning category the whole
time**. Every demonstration lives there, which is why the hero category exists. Do not show
the document — it is a separate deliverable, and reading from it on camera weakens both.

Seven blocks, five ideas, 4:20 total. Timestamps below are the target, not a suggestion.

---

## 0:00 — Frame the problem (25 s)

> "The task is ranking courses inside a category. The two obvious answers are 'sort by rating'
> and 'sort by popularity', and both are broken. I'll show you why on screen, then what I
> replaced them with."

Default view open: AI & Machine Learning, Recommended, Balanced weights.

---

## 0:25 — The distinction (30 s)

> "One separation the whole design rests on. When the user asks for something explicitly —
> sort by price, filter to four and a half stars and up — the system does exactly that.
> Nothing clever. But when the user hasn't asked for anything specific, something has to
> decide what goes first. That's the ranking, and that's what this is about."

Apply a filter, show it applying. Point at a card's score.

> "And notice the score didn't change when I filtered. Scores describe where a course stands
> in its category. Filters only decide which of those courses you see."

Clear the filter.

---

## 0:55 — Demo 1: why not sort by rating (50 s)

Sort → **Highest rated**. Point at the gate note.

> "A few courses just dropped out, and here's why."

Click the count, find *Machine Learning Fundamentals Reloaded*, expand the inspector.

> "Five out of five. Six ratings. Six ratings tell you nothing — so rather than trust it, the
> model pulls that rating toward the category average until enough reviews accumulate. Raw five
> point zero, adjusted four point three eight — barely above the category average of four point
> three one, instead of sitting on top of the list."

Back to **Recommended**. Point out it sits well down the list. Open the Ranking Lab, toggle
**shrinkage off**.

> "That's the same course without shrinkage."

It climbs six or more positions, animated.

> "Six positions, on six reviews. This is the one piece of the model I'd argue for hardest."

Toggle it back on.

---

## 1:45 — Demo 2: why not sort by popularity (50 s)

Find *The Complete AI & Machine Learning Bootcamp*, expand it.

> "Ninety-six thousand enrolments — the most in this category by a wide margin. Twenty-two
> percent completion. Eleven percent refunds. Last updated twenty-six months ago. It sells
> extremely well and it doesn't work."

Click the **Popularity-led** preset. It moves to position 1.

> "That's what a popularity-weighted ranking gives you, and it's roughly what a lot of
> marketplaces ship."

Back to **Balanced**, then toggle the **Outcome factor** off and on.

> "So there's a factor for whether people actually finish — completion, watch time, refunds.
> Behavioural, so much harder to fake than a review. Switching it off moves that course up
> several places. Switching it on pushes it back behind courses that are smaller and healthier.
> That's the layer most listings don't have at all."

---

## 2:35 — Demo 3: the five factors (25 s)

Gesture across the sliders.

> "Five factors, each answering a plain question. Is it good — the trustworthy rating. Do
> people finish it. Is there demand. Is it still current. Does it match what was asked for.
> Weighted sum, quality heaviest at thirty-five percent."

Move one slider; the list reorders.

> "Each factor becomes a percentile inside its own category before combining, which is what
> lets one weight set work across categories with very different absolute numbers."

---

## 3:00 — Demo 4: promoted placements (55 s)

Point at slot 1.

> "The platform needs to promote courses. The interesting part is how. This one is promoted,
> it's labelled, and the inspector says it would rank seventh organically. Promotion never
> touches the score — it's a reserved slot applied afterwards, so organic quality stays
> measurable. Slot six is the same mechanism for editorial picks rather than paid ones,
> different label, different pool."

Scroll to *AI Growth Hacking Masterclass 2026*.

> "Now this one is also paid for, and it's sitting in its organic position. Adjusted rating
> three point nine seven, category average four point three one. It fails the quality gate, so
> it doesn't get a slot."

Toggle the **promo quality gate** off. It jumps to position 1, badge attached.

> "That's what you're buying if you skip the gate. Promotion should accelerate a good course,
> not replace being good."

Toggle it back. Switch to **Price: low to high**.

> "And in explicit sort modes promotion is suppressed entirely. A paid result on top of
> 'cheapest first' is just a broken page."

---

## 3:55 — Close (25 s)

> "There's a diversity cap so one instructor can't own the first screen, deterministic
> tie-breakers so pagination stays stable, and the whole thing is measured — the guardrail I
> care about most is refund rate on courses enrolled from this listing, because optimising
> clicks alone selects for good titles rather than good courses."

> "Not built: personalisation and learned ranking. Both are the obvious next step, both need
> traffic this doesn't have, and both make the ranking harder to explain than a first version
> should be. The written document has the formulas and how I'd validate it. Thanks."

---

## Recording notes

- Clean browser profile, no bookmarks bar, no extensions. Zoom to ~110% so the inspector
  numbers survive video compression.
- Open the four deep links from the README in tabs beforehand, so no beat depends on finding
  the right card live.
- **Do not claim a course goes to position 1 when it goes to position 3.** Two moments reach
  first place for certain: the Popularity-led preset and the disabled promo gate. The
  shrinkage-off moment is guaranteed only to climb six or more positions — it may or may not
  top the list, so **check the deployed build and say what actually happens**. A reviewer who
  verifies one inflated claim will discount everything else.
- One dry run before recording. 4:20 is the target and it is comfortable; the usual failure is
  spending ninety seconds on the intro and then racing the promo section, which is the most
  distinctive part of the work.
- Don't read the script. Know the seven blocks and the three numbers that matter: 5.00 from 6
  ratings · 96k enrolments at 22% completion · 3.97 against a 4.31 category average.
