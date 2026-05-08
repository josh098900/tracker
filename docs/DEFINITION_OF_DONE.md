# Definition of Done

A milestone is not "done" until every item below is true.

## Code quality
- [ ] `pnpm typecheck` passes with no errors.
- [ ] `pnpm lint` passes with no warnings.
- [ ] No `any` types. No `// @ts-ignore`. No `console.log` outside dev-only blocks.
- [ ] Every `lib/*` function has a JSDoc comment explaining its inputs and outputs.
- [ ] All API inputs validated with Zod. No raw user data flows into Octokit calls.

## Testing
- [ ] Every metric in `METRICS.md` has at least one unit test in `lib/analysis/__tests__/`.
- [ ] Identity unification has tests covering: same-email merge, GitHub-noreply email, multiple aliases, single-contributor repo.
- [ ] Noise filter has tests for each major file pattern (lockfile, generated, binary, large data file).
- [ ] Balance score has tests for the four interpretation buckets (0.85+, 0.65–0.85, 0.45–0.65, <0.45).
- [ ] At least one integration test that runs `/api/analyze` against a tiny fixture repo (mock Octokit).

## UX
- [ ] Every chart has: title, axis labels, source note, tooltip, text alternative in `<details>`.
- [ ] Every error state has a designed screen with a clear next action.
- [ ] Loading state is never blank — always either skeleton, progress strip, or partial result.
- [ ] Mobile layout (`375px` width) renders without horizontal scroll.
- [ ] All interactive elements keyboard-navigable; focus rings visible.

## Performance
- [ ] Cold analysis of a 500-commit repo completes in < 15s.
- [ ] Cached analysis loads in < 2s.
- [ ] Lighthouse mobile performance ≥ 90, accessibility ≥ 95 on `/analyze/[owner]/[repo]`.
- [ ] No JS bundle over 200KB gzipped on the landing page.

## Honesty
- [ ] "What we can't see" panel is visible on every dashboard.
- [ ] Noise filter exclusions are reported on the dashboard ("X lockfile changes excluded").
- [ ] Balance score methodology is one click away from the score itself.
- [ ] LLM summary is labelled as AI-generated.
- [ ] No metric is shown without a tooltip explaining how it was calculated.

## Operational
- [ ] All env vars documented in `.env.example`.
- [ ] Vercel deploy works from `main` branch automatically.
- [ ] GitHub PAT has only `public_repo` scope, nothing more.
- [ ] Rate limit is in place and tested.

## Documentation
- [ ] `README.md` has install + run instructions.
- [ ] `CLAUDE.md` is up to date with any architectural changes.
- [ ] If any decision deviates from the docs in `docs/`, the doc is updated in the same PR.

## Subjective bar
- [ ] If a SETAP classmate pastes their repo URL, can they immediately tell:
  1. Who contributed roughly how much?
  2. Whether the work was balanced?
  3. What this tool is *not* measuring?
- [ ] If yes to all three, it's done. If no to any, it isn't.
