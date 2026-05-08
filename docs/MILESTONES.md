# Milestones

Phase-gated. Do **not** skip ahead. After each milestone, stop and let the human review.

---

## M0 — Project scaffold (½ day)

**Goal:** A working Next.js app skeleton, deployable to Vercel, with all dependencies installed.

**Tasks:**
- `pnpm create next-app` with TypeScript, Tailwind, App Router, ESLint.
- Install: `@octokit/rest`, `zod`, `recharts`, `@visx/hierarchy` (provides Treemap), `@visx/heatmap`, `@visx/network`, `@visx/scale`, `@visx/group`, `@visx/responsive`, `d3-force`, `d3-hierarchy`, `@anthropic-ai/sdk`, `@vercel/kv`.
- Add shadcn/ui: `button`, `card`, `tabs`, `tooltip`, `dialog`, `skeleton`, `sonner` (replaces old `toast`), `input`, `slider`.
- Set up `pnpm typecheck` and `pnpm lint` scripts.
- Wire fonts: Instrument Serif, Inter, JetBrains Mono via `next/font`.
- Apply colour tokens from `DESIGN_SYSTEM.md` to `globals.css`.
- Push to GitHub, deploy to Vercel preview, confirm `/` renders an empty page with the right fonts and colours.

**Acceptance:**
- `pnpm dev` runs without warnings.
- `pnpm typecheck` passes.
- Vercel preview URL renders the index page.
- Fonts and colour tokens are loaded and visible in DOM.

---

## M1 — Paste-URL → fetched data (1 day)

**Goal:** A user can paste a URL and the server fetches and unifies the contributor + commit data, returning JSON. No dashboard UI yet.

**Tasks:**
- Build the landing page (`/`): hero, paste-URL input, "Analyse" button. Use Instrument Serif for the hero per `DESIGN_SYSTEM.md`.
- Implement `lib/github/parseUrl.ts` — extract `owner` and `repo` from a GitHub URL, with Zod validation.
- Implement `lib/github/client.ts` — Octokit factory using `GITHUB_TOKEN`.
- Implement `lib/github/fetchRepo.ts`, `fetchCommits.ts`, `fetchPRs.ts`. Handle pagination. Cache repo metadata for 5 min.
- Implement `lib/analysis/identityUnification.ts` per `METRICS.md`.
- Implement `lib/analysis/noiseFilter.ts` per `METRICS.md`.
- Implement `app/api/analyze/route.ts` — POST endpoint that returns JSON (SSE comes later in M3).
- Implement IP rate limiter (`lib/rateLimit.ts`).

**Acceptance:**
- `POST /api/analyze` with `{ url: "https://github.com/InterMaus1154/uop_setap_cw" }` returns a JSON payload with unified contributors and basic commit data within 5 seconds.
- All inputs validated with Zod.
- Rate limit enforced (verifiable by hitting the endpoint 11 times from one IP).
- Cache hit on second identical request.
- No `any` types anywhere.

---

## M2 — Core visualisations (2 days)

**Goal:** All 8 charts rendering with real data. No fairness score yet, no LLM summary.

**Tasks:**
- Build dashboard route `/analyze/[owner]/[repo]/page.tsx` with the layout grid from `DESIGN_SYSTEM.md`.
- Implement all 8 charts as separate components in `components/charts/`. Use the table in `DESIGN_SYSTEM.md` for which library to use for each.
- Each chart has: title, axis labels, source note, tooltip, and a `<details>` text alternative.
- Implement `lib/analysis/contributorMetrics.ts`, `consistency.ts`, `fileOwnership.ts` per `METRICS.md`.
- Build the loading skeleton state for the dashboard (use shadcn `Skeleton`).

**Acceptance:**
- All 8 charts render correctly for at least 3 different test repos: a small one (<50 commits), a medium one (~500 commits), and `uop_setap_cw`.
- No chart breaks when given a 1-contributor repo, a 10-contributor repo, or an empty repo.
- All charts respect the categorical palette (consistent colour for the same contributor across all charts).
- Mobile layout: charts stack into single column under `md:`.

---

## M3 — Balance score, LLM summary, SSE streaming (1.5 days)

**Goal:** The dashboard now shows the balance score and natural-language summary, and the analysis is streamed live via SSE.

**Tasks:**
- Implement `lib/analysis/balanceScore.ts` per `METRICS.md`. Composite formula + Gini.
- Build `BalanceScore.tsx` component — large Instrument Serif number, breakdown bars, methodology link.
- Implement `lib/llm.ts` — Anthropic SDK call with the prompt template (below).
- Build `LlmSummary.tsx` — render summary as plain text, never raw HTML.
- Convert `/api/analyze` to SSE: emit `progress`, `partial`, `result` events.
- Wire the dashboard to consume the SSE stream and progressively render charts.
- Add the **"What we can't see"** disclaimer panel and the noise-filter notes.

**Prompt template (in `lib/llm.ts`):**

```
You are summarising the contribution distribution of a student group software project.

Repo: {{owner}}/{{repo}}
Period: {{first_commit_date}} to {{last_commit_date}}
Contributors: {{count}}
Balance score: {{balance_score}} / 1.00

Per-contributor data (JSON): {{contributor_metrics_json}}

Write a 3-paragraph summary that:
1. States overall balance plainly (e.g. "The work was reasonably evenly distributed.").
2. Describes each contributor in one sentence using their commit share, primary area of work, and consistency. Use neutral, descriptive language. Do not rank or judge.
3. Notes one or two factual observations (e.g. "Most commits occurred in the final two weeks.").

Tone: descriptive, factual, neutral. No praise, no criticism, no advice. Use UK English. Reference contributors by their GitHub username.

Do not invent any facts not present in the data.
```

**Acceptance:**
- Cold analysis end-to-end (paste URL → final dashboard) under 15 seconds for a 500-commit repo.
- SSE progress events update a visible progress strip.
- Balance score recomputes correctly when weights are changed (re-weight UI is M4; for now just verify the formula is correct via a unit test).
- LLM summary never invents contributor names not in the data.
- "What we can't see" panel is visible.

---

## M4 — Polish, sharing, error states (1 day)

**Goal:** Production-ready.

**Tasks:**
- Stable share URLs (`/analyze/[owner]/[repo]` works for any visitor; cache hit serves instantly).
- "Last analysed" timestamp + manual refresh button.
- Re-weight UI: sliders for the 7 weights with live balance score recompute.
- Export dashboard to PNG (via `html-to-image` or similar).
- Comprehensive error states: 404 repo, private repo, empty repo, single contributor, rate-limited, GitHub down.
- About / methodology page at `/about` summarising `METRICS.md`.
- OpenGraph image generation for share previews.
- Lighthouse pass: performance ≥ 90, accessibility ≥ 95.

**Acceptance:**
- Every error state has a designed screen, not a stack trace.
- Share URL produces an OpenGraph card showing the repo and balance score.
- All `DEFINITION_OF_DONE.md` items pass.

---

## Out of scope for v1
- Private repo support
- User accounts
- Persistent analysis history
- Multi-repo / org views
- Lecturer dashboard
- Dark mode
