# Product Requirements

## Summary
Contribution Analyser is a zero-setup web tool that turns a public GitHub repo URL into a contribution dashboard. Built for university SETAP-style coursework where students struggle to objectively measure who contributed what to a group project.

## Target user

**Primary:** University students taking SETAP (or equivalent) coursework, working in groups of 3–6 on a public GitHub repo. CS / Software Engineering undergraduates, comfortable with Git, but not necessarily with reading raw `git log` output.

**Secondary:** Lecturers / module leaders who want a quick, defensible read on how a group performed.

**Not in scope:** Professional teams, OSS maintainers, monorepos with hundreds of contributors, repos with restricted access.

## The problem
At the end of a group coursework, students are typically asked to assess each other's contributions. This conversation is awkward, often inaccurate, and prone to bias. People who:
- worked at unsociable hours,
- contributed quietly,
- did less visible work (e.g. fixing flaky tests, writing docs),
- pushed less frequently but in larger chunks,

…all get under-credited. People who made many small, visible commits get over-credited.

The git history *contains* an objective record of who did what — but no one reads it.

## The promise
Paste your group's repo URL. In ~10 seconds, get a dashboard that:
1. Shows everyone's contribution across multiple dimensions (volume, diversity, consistency, ownership).
2. Filters out noise (lockfiles, generated code) so the numbers are honest.
3. Produces a transparent **balance score** (0–1) showing how evenly the work was distributed.
4. Generates a plain-English summary the team can paste into their reflection.

## Core user journey
1. Student lands on `/`. Sees a clean hero with one input: a GitHub repo URL.
2. They paste e.g. `https://github.com/InterMaus1154/uop_setap_cw` and click **Analyse**.
3. A loading state shows progress: *Fetching commits… Identifying contributors… Calculating ownership…* (server-sent events stream the progress).
4. Dashboard loads at `/analyze/InterMaus1154/uop_setap_cw`. They see the 8 visualisations, the balance score, and a natural-language summary.
5. They can share the URL — it's stable and cached, so teammates get the same view instantly.

## MVP feature list

### Must-have (M1–M3)
- Paste-URL form with validation (must be a public GitHub repo).
- Server-side analysis using GitHub API + a single PAT.
- Identity unification across name/email aliases.
- Noise filtering for lockfiles, generated files, vendored code.
- 8 visualisations:
  1. **Contribution timeline** — stacked area chart of commits per contributor over time.
  2. **Contribution breakdown** — donut chart of overall contribution share.
  3. **File ownership treemap** — folders sized by code volume, coloured by primary owner.
  4. **Fairness radar** — multi-dimensional per-contributor radar (volume, diversity, consistency, review, initiative, ownership).
  5. **Commit hour heatmap** — day-of-week × hour-of-day grid of commit activity per contributor (toggle).
  6. **Code churn** — additions vs deletions over time.
  7. **Co-authorship graph** — force-directed graph of who reviewed/co-authored whose PRs.
  8. **Consistency timeline** — per-contributor weekly contribution regularity.
- Composite **balance score** (0–1) with breakdown.
- LLM-generated summary (Claude Sonnet via server route).
- Result caching by commit SHA.
- Shareable analysis URL.

### Should-have (M4)
- "Re-weight" UI to let users adjust the balance score formula.
- Export dashboard as PNG.
- "Last analysed" timestamp + manual refresh.
- OpenGraph share previews.

### Won't-have (explicit non-goals)
- Private repos.
- User accounts / saved history.
- Multi-repo / org-level views.
- Code-quality assessment (we measure volume, not quality).
- Automatic dispute resolution / lecturer reporting.
- Anything that ranks contributors as "best" or "worst".

## Tone & framing
This tool can cause arguments. Every part of the UI must:
- **Be transparent** — every number can be drilled into.
- **Avoid judgment** — we describe contributions, we don't grade them.
- **Acknowledge limits** — code volume ≠ effort, and the tool says so explicitly.

The natural-language summary uses neutral phrasing: *"Sam authored 38% of commits, concentrated in the backend"* — not *"Sam did the most work."*

## Success criteria
- A SETAP student can analyse their group repo from URL → dashboard in under 15 seconds (cold) and under 2 seconds (cached).
- 100% of CS coursework repos at our scale (under 5,000 commits, fewer than 10 contributors) analyse successfully without errors.
- Zero students are ever shown a wrong contributor name due to email aliasing.
- The fairness/balance methodology is documented in-app — students can read why their score is what it is.
