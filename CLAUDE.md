# Contribution Analyser — Claude Code Orientation

## What this is
Contribution Analyser is a web tool where students paste a public GitHub repo URL and instantly get a contribution dashboard for their group project. Built specifically for SETAP coursework, where contribution disputes are common.

## Read these in order before writing code
1. `docs/PRD.md` — what we're building and for whom.
2. `docs/ARCHITECTURE.md` — tech stack, file structure, data flow.
3. `docs/METRICS.md` — **the most important doc.** The fairness model. Read carefully.
4. `docs/DESIGN_SYSTEM.md` — typography, colours, chart styling.
5. `docs/MILESTONES.md` — phase-gated build plan. Don't skip ahead.
6. `docs/DEFINITION_OF_DONE.md` — quality bar before considering anything complete.

## Tech stack at a glance
- Next.js 16 (App Router) + TypeScript (strict)
- Tailwind v4 + shadcn/ui (base-nova preset, `@base-ui/react` primitives)
- Octokit (`@octokit/rest`) for GitHub API
- Recharts for standard charts; visx for treemap, heatmap, force graph
- Vercel KV for caching (note: `@vercel/kv` is deprecated upstream — see docs/ARCHITECTURE.md)
- Anthropic SDK (Claude Sonnet) for the natural-language summary — **optional extra**, not required to ship a dashboard
- Single GitHub PAT in env var, no user auth
- Deployed on Vercel

## Build approach
This is a phase-gated build. Do **not** skip ahead. Each milestone in `docs/MILESTONES.md` has acceptance criteria; meet them before moving on. After each milestone, stop and let the human review.

## Non-negotiables
- **Public repos only.** No OAuth, no auth flows of any kind.
- The `GITHUB_TOKEN` server env var is the only way the app talks to GitHub. Never expose it to the client.
- Cache aggressively by `${owner}/${repo}@${commit_sha}`.
- IP rate limit the analyse endpoint (10/hour per IP) to prevent quota abuse.
- Never call the Anthropic API from the client. Server-side only.
- Type safety: Zod-validate all API inputs. No `any`. No `@ts-ignore`.
- The "What we can't see" disclaimer panel must be visible on every dashboard.

## How to work
- `pnpm dev` for the dev server.
- `pnpm typecheck` and `pnpm lint` before every commit.
- Stop and ask if a metric calculation is ambiguous — don't guess. The fairness model is the heart of the product; getting it wrong undermines the whole tool.
- If you deviate from any doc in `docs/`, update the doc in the same PR.

## What success looks like
A SETAP student pastes their group repo URL and within ~10 seconds sees an honest, defensible breakdown of who did what, with a balance score and a summary they can use in their team meeting.
