# Course Catalogue — Ranking Prototype

A frontend-only demo that makes a course ranking algorithm visible and manipulable.

> **Status: Phase 1 (scaffold) complete.** The static export builds; the ranking engine and
> UI are not implemented yet. See [`docs/04-build-brief.md`](docs/04-build-brief.md) for the
> remaining phases. This README is replaced with the real one in Phase 5.

## Documents

Read in this order. `docs/01-ranking-algorithm.md` is the specification and wins on algorithm
questions; `docs/03-prototype-prd.md` wins on UI questions.

|                                                                |                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| [`docs/01-ranking-algorithm.md`](docs/01-ranking-algorithm.md) | The algorithm — formulas, weights, pipeline order, promo rules |
| [`docs/02-dataset-spec.md`](docs/02-dataset-spec.md)           | Schema, planted demo cases, generator invariants               |
| [`docs/03-prototype-prd.md`](docs/03-prototype-prd.md)         | Screens, components, behaviour, acceptance criteria            |
| [`docs/04-build-brief.md`](docs/04-build-brief.md)             | Implementation plan and deploy steps                           |
| [`docs/05-loom-script.md`](docs/05-loom-script.md)             | Video walkthrough                                              |

## Stack

Next.js (App Router) with static export, TypeScript strict, Tailwind CSS, Vitest. No backend,
no database, no API routes. State lives in the URL.

## Scripts

```bash
npm run dev              # dev server
npm run build            # static export into out/
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test             # vitest run
npm run format           # prettier --write .
npm run generate:dataset # regenerate src/data/*.json  (Phase 2)
npm run verify           # typecheck + lint + test + build
```

## Requirements

Node.js 20 or newer (developed against 24 LTS).
