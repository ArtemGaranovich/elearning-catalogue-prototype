# Loom Script — 4:45

Screen: the deployed prototype, **staying in the AI & Machine Learning category the whole
time**. Every demonstration lives there, which is why the hero category exists. Do not show the
document — it is a separate deliverable, and reading from it on camera weakens both.

Nine blocks, 4:45 total. Timestamps are the target, not a suggestion.

**Start the recording on the User-view deep link**, not the default page. The opening 20 seconds
are much stronger if the audience sees an ordinary course listing before they see the machinery
— and the reveal costs nothing, because the toggle has to be shown anyway.

**Every deep link carries `all=1`.** The two cases that carry the most weight sit at positions 13
and 14, which is page 2 at the default page size. Without "Show all" on, the reordering
animations cannot run at all — a card cannot animate across a page boundary — and Demo 1 loses
its entire payoff. Check this before you start recording, not after.

Positions quoted below are from the deployed build. Re-check them if the dataset or weights
change.

---

## 0:00 — Open in User view (20 s)

A plain course listing on screen. Do not mention the algorithm yet.

> "This is a course category on a marketplace. Nothing unusual — filters, a sort dropdown,
> sixteen courses, a couple of them marked as promoted. This is what a customer sees."

Hit **D**, or click the toggle. The explanatory layer appears: scores, position numbers, the
Ranking Lab.

> "And this is the same page with the ranking exposed. Same courses, same order — I'll come back
> to that at the end. Everything I'm about to show is this layer."

---

## 0:20 — Frame the problem (25 s)

> "The task is ranking courses inside a category. The two obvious answers are 'sort by rating'
> and 'sort by popularity', and both are broken. I'll show you why on screen, then what I
> replaced them with."

---

## 0:45 — The distinction (25 s)

> "One separation the whole design rests on. When the user asks for something explicitly — sort
> by price, filter to four and a half stars and up — the system does exactly that. Nothing
> clever. But when the user hasn't asked for anything specific, something has to decide what
> goes first. That's the ranking, and that's what this is about."

Apply a filter. Point at a card's score.

> "And notice the score didn't change when I filtered. Scores describe where a course stands in
> its category. Filters only decide which of those courses you see."

Clear the filter.

---

## 1:10 — Demo 1: why not sort by rating (50 s)

Sort → **Highest rated**. Point at the gate note.

> "A few courses just dropped out, and here's why."

Click the count, find *Machine Learning Fundamentals Reloaded*, expand the inspector.

> "Five out of five. Six ratings. Six ratings tell you nothing — so rather than trust it, the
> model pulls that rating toward the category average until enough reviews accumulate. Raw five
> point zero, adjusted four point three eight — barely above the category average of four point
> three one, instead of sitting on top of the list."

Back to **Recommended**. It sits at position 13 of 16. Open the Ranking Lab, toggle
**shrinkage off**.

> "That's the same course without shrinkage."

It travels from 13 to 3, animated.

> "Thirteenth to third, on six reviews. This is the one piece of the model I'd argue for
> hardest."

Toggle it back on.

---

## 2:00 — Demo 2: why not sort by popularity (45 s)

Find *The Complete AI & Machine Learning Bootcamp*, expand it.

> "Ninety-six thousand enrolments — the most in this category by a wide margin. Twenty-two
> percent completion. Eleven percent refunds. Last updated twenty-six months ago. It sells
> extremely well and it doesn't work."

Click the **Popularity-led** preset. It rises to the top of the organic results — third on the
page, below the two-course promoted band.

> "That's what a popularity-weighted ranking gives you: first of the real results, right under the
> promoted band. And it's roughly what a lot of marketplaces ship."

Back to **Balanced**, then toggle the **Outcome factor** off and on.

> "So there's a factor for whether people actually finish — completion, watch time, refunds.
> Behavioural, so much harder to fake than a review. Switching it off moves that course from
> eighth to fourth. Switching it back on pushes it behind courses that are smaller and healthier.
> That's the layer most listings don't have at all."

---

## 2:45 — Demo 3: the five factors (20 s)

Gesture across the sliders.

> "Five factors, each answering a plain question. Is it good — the trustworthy rating. Do people
> finish it. Is there demand. Is it still current. Does it match what was asked for. Weighted
> sum, quality heaviest at thirty-five percent, and each factor becomes a percentile inside its
> own category before they're combined."

---

## 3:05 — Demo 4: promoted placements (55 s)

Point at the top two results.

> "The platform needs to promote courses. The interesting part is how. These top two are the
> promoted band — paid first, then the platform's own editorial pick, and never more than two.
> Promotion never touches the score: the band is lifted on afterwards, so the organic ranking
> underneath stays intact and measurable. The inspector shows this one would rank fifth
> organically."

> "The cap is the part I'd defend. Without it, promotion is available to anyone who pays, so the
> band grows with adoption until the whole first screen is paid and the organic ranking is
> decoration below the fold. Nothing in the formula changed, and yet you've ended up with results
> ordered by who paid — which is exactly what keeping promotion out of the score was supposed to
> prevent."

Scroll to *AI Growth Hacking Masterclass 2026* at position 14 — or use the deep link, which
focuses it directly.

> "Now this one is also paid for, and it's sitting in its organic position, fourteenth. Adjusted
> rating three point nine seven, category average four point three one. It fails the quality gate,
> so it never reaches the band."

Toggle the **promo quality gate** off. It jumps to position 1, badge attached.

> "That's what you're buying if you skip the gate. Promotion should accelerate a good course, not
> replace being good."

> "One aside, because it's the kind of thing that only shows up when you build it. This started as
> reserved slots at positions one and six, interleaved with the organic results — and a promoted
> course sitting at organic rank four got 'promoted' into slot six, two places *lower* than if
> nobody had paid. A capped band at the top removes that by construction instead of patching it."

Toggle it back. Switch to **Price: low to high**.

> "And in explicit sort modes promotion is suppressed entirely. A paid result on top of 'cheapest
> first' is just a broken page."

---

## 4:00 — Back to User view: the payoff (25 s)

Return to **Recommended**, **Balanced**. Hit **D**.

> "Back to what a customer sees. Same order, exactly — the explanation layer doesn't touch the
> ranking, it just makes it inspectable. Notice the promoted labels are still here: those are for
> the user, not for you, and in the EU they're a legal requirement."

Scroll to the 5.00-rated course.

> "One thing I'd flag as a decision rather than an oversight. This card shows five point zero
> from six ratings — the raw average, not the adjusted one. Users shouldn't be shown a rating
> that isn't the average of their own reviews. The honest way to signal low confidence to a
> customer is the review count, right there next to it — and then let the ordering do the work.
> Perfect score, still near the bottom of the page."

Hit **D** back to Demo view, then flip to the **Popularity-led** deep link and hit **D** again.

> "And this is why the toggle is useful. Popularity-weighted ranking, seen as a customer would
> see it: a course that twenty-two percent of buyers finish, first of the real results. That's the cost of
> a weighting decision, as a product screenshot."

---

## 4:25 — Close (20 s)

> "There's a diversity cap so one instructor can't own the first screen, deterministic
> tie-breakers so pagination stays stable, and the whole thing is measured — the guardrail I care
> about most is refund rate on courses enrolled from this listing, because optimising clicks alone
> selects for good titles rather than good courses."

> "Not built: personalisation and learned ranking. Both are the obvious next step, both need
> traffic this doesn't have. The written document has the formulas and how I'd validate it.
> Thanks."

---

## Recording notes

- Open all five README deep links in tabs beforehand — **User view first**, since the recording
  starts there — so no beat depends on finding the right card live. Confirm each one has
  "Show all" active.
- Clean browser profile, no bookmarks bar, no extensions. Zoom to ~110% so the inspector numbers
  survive video compression.
- **Learn the `D` shortcut.** The script switches modes four times. Hunting for the toggle with
  the cursor each time reads as unfamiliarity with your own prototype.
- **Every position quoted in this script is measured, not estimated.** From the deployed build:
  the 5.00 course is 13th and goes to 3rd with shrinkage off; the megacourse is 8th and goes to
  4th with Outcome off; the sponsored course's organic rank is 5; the gate-refused course is 14th
  and goes to 1st with the gate disabled. **The only result rendered at position 1 by a
  weighting change is the gate-refused one** — under Popularity-led the megacourse is second,
  third, below the promoted band, so say "top of the organic results". Re-measure after any dataset or
  weight change. A reviewer who verifies one inflated claim will discount everything else.
- The 4:00 block is the one most likely to get cut for time, and it is the one that answers "is
  this a product or a debug screen?". Protect it — trim Demo 3 instead, it is the most
  compressible.
- One dry run before recording. 4:45 is comfortable; the usual failure is spending ninety seconds
  on the intro and then racing the promo section, which is the most distinctive part of the work.
- Don't read the script. Know the nine blocks and the three numbers that matter: 5.00 from 6
  ratings · 96k enrolments at 22% completion · 3.97 against a 4.31 category average.
