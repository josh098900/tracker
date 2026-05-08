# Architecture

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | Single repo, single deploy |
| Language | TypeScript (strict mode) | No `any` allowed |
| Styling | Tailwind CSS v4 + shadcn/ui (base-nova) | Use shadcn primitives, don't reinvent buttons |
| GitHub client | `@octokit/rest` | Handles pagination + rate limit headers |
| Validation | Zod | Validate all API inputs and external data |
| Charts (standard) | Recharts | Timeline, donut, churn, consistency, radar |
| Charts (custom) | visx (`@visx/hierarchy` for treemap) + d3-force | Treemap, heatmap, co-authorship graph |
| Cache | `@vercel/kv` (Upstash Redis) — **deprecated upstream**, swap to `@upstash/redis` before prod | Key-value, no schema |
| LLM | `@anthropic-ai/sdk` — **optional extra** for the AI summary; dashboard works without it | Server-side only |
| Notifications | `sonner` (replaces shadcn's old `toast` component) | Wired in `app/layout.tsx` |
| Hosting | Vercel | Free tier sufficient |
| Package manager | pnpm | Faster, disk-friendly |

## High-level data flow

```
User
  │ pastes URL
  ▼
Browser ── POST /api/analyze ──▶ Next.js Server Route
                                       │
                                       ├─ Validate URL (Zod)
                                       ├─ Resolve owner/repo via Octokit
                                       ├─ Fetch latest commit SHA
                                       │
                                       ├─ Cache check: kv.get("analysis:${owner}/${repo}@${sha}")
                                       │     │
                                       │     ├─ HIT: stream cached payload, end.
                                       │     └─ MISS: continue ↓
                                       │
                                       ├─ Fetch contributors, commits, PRs (paginated)
                                       ├─ Unify identities
                                       ├─ Filter noise (lockfiles, generated, vendored)
                                       ├─ Compute per-contributor metrics (see METRICS.md)
                                       ├─ Compute file ownership
                                       ├─ Compute balance score
                                       ├─ Cache the analysis payload
                                       ├─ Call Anthropic API → natural-language summary
                                       │
                                       └─ Stream payload back via SSE

Browser renders dashboard incrementally as events arrive.
```

## Repository structure

```
contribution-analyser/
├── CLAUDE.md
├── README.md
├── .env.example
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── METRICS.md
│   ├── DESIGN_SYSTEM.md
│   ├── MILESTONES.md
│   └── DEFINITION_OF_DONE.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # landing page with paste-URL form
│   ├── analyze/
│   │   └── [owner]/[repo]/page.tsx       # dashboard route
│   ├── about/page.tsx                    # methodology / disclaimers
│   └── api/
│       └── analyze/route.ts              # POST: kicks off analysis (SSE)
├── components/
│   ├── ui/                                # shadcn components
│   ├── PasteUrlForm.tsx
│   ├── DashboardLayout.tsx
│   ├── MetricCard.tsx
│   ├── BalanceScore.tsx
│   ├── ContributorChip.tsx
│   ├── LlmSummary.tsx
│   ├── WhatWeCantSee.tsx
│   └── charts/
│       ├── ContributionTimeline.tsx
│       ├── ContributionBreakdown.tsx
│       ├── FileOwnershipTreemap.tsx
│       ├── FairnessRadar.tsx
│       ├── CommitHeatmap.tsx
│       ├── ChurnChart.tsx
│       ├── CoAuthorshipGraph.tsx
│       └── ConsistencyTimeline.tsx
├── lib/
│   ├── github/
│   │   ├── client.ts                     # Octokit factory
│   │   ├── parseUrl.ts                   # extract owner/repo from URL
│   │   ├── fetchRepo.ts
│   │   ├── fetchCommits.ts               # paginated, with diff stats
│   │   ├── fetchPRs.ts                   # PRs + reviews
│   │   └── types.ts
│   ├── analysis/
│   │   ├── identityUnification.ts
│   │   ├── noiseFilter.ts                # lockfiles, generated, vendored
│   │   ├── contributorMetrics.ts
│   │   ├── fileOwnership.ts
│   │   ├── balanceScore.ts
│   │   ├── consistency.ts
│   │   └── types.ts
│   ├── cache.ts                          # KV wrapper
│   ├── rateLimit.ts                      # IP rate limiting
│   ├── llm.ts                            # Anthropic call + prompt
│   └── sse.ts                            # SSE helper
├── public/
└── ...
```

## API design

### `POST /api/analyze`

**Request body:**
```json
{ "url": "https://github.com/owner/repo" }
```

**Response:** `text/event-stream`

Event types streamed in order:
1. `progress` — `{ stage: "fetching_repo" | "fetching_commits" | "fetching_prs" | "unifying_identities" | "computing_metrics" | "computing_ownership" | "generating_summary", percent: 0..100 }`
2. `partial` — `{ contributors: [...], timeline: [...] }` (sent as soon as basic data is ready, before ownership/summary)
3. `result` — full analysis payload (see schema below)
4. `error` — `{ code, message }`

**Cache:** if a fresh analysis exists for the repo's latest commit SHA, immediately emit the cached `result` event and close.

**Rate limit:** 10 analyses per IP per hour (KV-backed bucket). Cached results don't count.

### Result payload schema
```ts
type AnalysisResult = {
  repo: { owner: string; name: string; commit_sha: string; analyzed_at: string };
  contributors: Contributor[];
  timeline: TimelinePoint[];          // weekly buckets
  file_ownership: TreemapNode;
  co_authorship: { nodes: Node[]; edges: Edge[] };
  commit_heatmap: HeatmapCell[];      // per contributor
  churn: ChurnPoint[];                // weekly additions/deletions
  consistency: ConsistencyPoint[];    // per contributor weekly
  balance_score: BalanceScore;
  summary: string;                    // LLM-generated
  notes: string[];                    // e.g. "12 lockfile changes excluded from LOC counts"
};
```

## Caching strategy

**Cache key:** `analysis:${owner}/${repo}@${commit_sha}`
**TTL:** 7 days
**Storage:** Vercel KV (Upstash Redis under the hood).

Why commit SHA, not time? Because the analysis is deterministic for a given commit. Same SHA = same result, forever.

Also cached:
- `repo_meta:${owner}/${repo}` — repo metadata, TTL 5 min.
- `latest_sha:${owner}/${repo}` — latest commit SHA, TTL 2 min (so we don't hit GitHub on every refresh).

## Rate limiting

The GitHub PAT gives 5,000 req/hour. One analysis costs ~50–200 req depending on repo size. With caching, in practice we'll average <100 req per unique analysis.

To prevent abuse:
- IP rate limit: max 10 analyses (cache misses) per hour per IP.
- Add an `X-RateLimit-Remaining` header so the client can show "you have 7 analyses left this hour".
- If the GitHub quota itself drops below 500 remaining, return 503 with a friendly "service is temporarily busy, try again in a few minutes" message.

## Environment variables

```
GITHUB_TOKEN=ghp_xxx                # personal access token, public_repo scope only
ANTHROPIC_API_KEY=sk-ant-xxx
KV_REST_API_URL=https://...         # Vercel KV
KV_REST_API_TOKEN=...
NEXT_PUBLIC_APP_URL=https://...     # for share links
```

A complete `.env.example` lives in the repo root.

## Security

- The GitHub PAT is **never** sent to the client. Only the server route uses it.
- All API inputs validated with Zod before any external calls.
- Repo URL is sanitised: must match `^https?://github\.com/[\w.-]+/[\w.-]+/?$`.
- LLM summary is rendered as plain text, never as raw HTML.
- No user data is stored. The only state is the cache, keyed by public repo URLs.
- The PAT scope is `public_repo` only — no write, no private access, no account modification.
