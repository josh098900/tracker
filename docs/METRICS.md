# Metrics & Fairness Model

This is the heart of the product. Every metric defined here must be honest, defensible, and clearly explained to the user.

## Guiding principles

1. **Volume is not virtue.** A contributor who writes 1,000 lines of CSS is not "more contributing" than one who writes 100 lines of clever algorithm.
2. **Show the components, not just the score.** The balance score is a composite. The user can always see how it was built.
3. **Filter aggressively.** Lockfiles, generated code, and vendored dependencies will dominate raw counts and turn the balance score into noise.
4. **Acknowledge what we can't measure.** Code review quality, design decisions, pair programming, ideas in meetings — none of this lives in git.
5. **Never name-and-shame.** Phrasing throughout the product describes; it does not judge.

---

## Identity unification

Contributors often appear under multiple `(name, email)` pairs. Examples:
- `Josh Smith <josh@uni.ac.uk>` and `josh-smith <josh@gmail.com>`
- `Josh <12345+josh@users.noreply.github.com>` (GitHub-private email)

### Unification rules (in order of confidence)

1. **GitHub user ID match** — if the commit's `author.id` (from the GitHub API, not the raw git author) is the same, they're the same person. Highest confidence.
2. **Same email** (case-insensitive) — same person.
3. **Same normalised name across overlapping commits** — if `josh smith` and `Josh Smith` appear with different emails but the names normalise to the same string, merge.
4. **Manual override** — store a `merged_identities.json` per analysis (future enhancement; not in MVP).

### Display

Use the GitHub username as the canonical handle. Show the GitHub avatar. If a contributor has no associated GitHub account (e.g. used a fake email), display their first non-empty git name and a default avatar.

---

## Noise filter

These files are excluded from line-of-code counts and from file ownership calculations.

### Lockfiles (always excluded)
```
package-lock.json     yarn.lock           pnpm-lock.yaml
Cargo.lock            Gemfile.lock        poetry.lock
composer.lock         go.sum              *.lock
```

### Generated / build outputs (always excluded)
```
dist/        out/         build/       .next/
node_modules/  __pycache__/  .venv/  venv/
target/      coverage/    .nyc_output/
*.min.js     *.min.css    *.map
```

### Vendored / third-party (always excluded)
```
vendor/      third_party/  bower_components/
```

### Binaries (always excluded)
```
*.png  *.jpg  *.jpeg  *.gif  *.webp  *.svg
*.pdf  *.zip  *.tar.gz  *.exe  *.dll
*.woff  *.woff2  *.ttf  *.otf
*.mp3  *.mp4  *.mov
```

### Data files (excluded over a size threshold)
- `*.csv`, `*.json`, `*.xml`, `*.sql` files **over 50 KB** are excluded from LOC counts.
- The diff-stats line counts may still include them — we do a second pass to subtract.

### Respect `.gitattributes`
If the repo has `linguist-generated=true` or `linguist-vendored=true` flags, respect them.

### Reporting

Show in the dashboard: *"X commits / Y file changes were excluded as noise (lockfiles, generated code, binaries). [show details]"* Transparency is non-negotiable.

---

## Per-contributor metrics

For each unified contributor, compute:

### Volume
- `commits` — count of meaningful commits (after noise filter).
- `meaningful_loc_added` — lines added, excluding noise files.
- `meaningful_loc_removed` — lines removed, excluding noise files.
- `meaningful_loc_changed` — `added + removed`.
- `commits_share` — `commits / total_commits`.
- `loc_share` — `meaningful_loc_changed / total_meaningful_loc_changed`.

### Diversity
- `files_touched` — count of distinct meaningful files this contributor edited.
- `folders_touched` — count of distinct top-level folders edited.
- `diversity_score` — `files_touched / total_files_in_repo` (clipped to [0, 1]).

### Consistency
- `active_weeks` — count of ISO weeks containing at least one commit.
- `total_weeks` — count of ISO weeks between repo's first commit and last commit.
- `coverage` — `active_weeks / total_weeks`.
- `cv` — coefficient of variation of weekly commit counts (lower = more consistent).
- `consistency_score` — `coverage * (1 - clamp(cv / 2, 0, 1))`.
- Higher score = contributed regularly, not in one or two big bursts.

### Peer review
- `prs_opened` — count of PRs authored.
- `prs_reviewed` — count of PRs they reviewed (excluding their own).
- `review_comments` — count of review comments left.
- `review_score` — `(prs_reviewed + review_comments * 0.2) / total_review_actions`.

### Initiative
- `prs_authored_share` — `prs_opened / total_prs`.
- `first_commit_at` — earliest commit timestamp (used for "started early" display, not in score).
- `initiative_score` — `prs_authored_share` (simple; revisit later).

### Codebase ownership
- For each meaningful file, the "owner" is the contributor who has authored the largest share of that file's *current* lines (using `git blame` semantics on the head SHA).
- `ownership_share` — fraction of total LOC in the head version that this contributor owns.

> ⚠️ Computing per-file blame from the GitHub API alone is expensive. **For MVP, approximate ownership by *last-touched author per file*.** True blame is a phase-2 enhancement that would require server-side cloning.

---

## Balance score

A 0–1 number where **1.0 = perfectly equal contribution** and **0.0 = one person did everything**.

### Composite formula

For each contributor, compute their **composite contribution percentage**:

```
composite_pct = 0.30 * commits_share
              + 0.20 * loc_share
              + 0.10 * diversity_score_normalised
              + 0.15 * consistency_score_normalised
              + 0.10 * review_score
              + 0.10 * initiative_score
              + 0.05 * ownership_share
```

(All weights sum to 1.00. *Normalised* means: divide by the sum across contributors so the values sum to 1.)

The vector of `composite_pct` values across contributors is then fed into:

```
balance_score = 1 - gini(composite_pct_vector)
```

Where Gini is the standard inequality measure (0 = perfect equality, 1 = perfect inequality), so `1 - Gini` flips it to "balance".

### Interpretation
| Balance | Meaning |
|---|---|
| 0.85+ | Highly balanced — everyone contributed similarly |
| 0.65–0.85 | Reasonably balanced — typical of healthy groups |
| 0.45–0.65 | Uneven — some members noticeably outweigh others |
| < 0.45 | Heavily skewed — one or two members carried the project |

### Why this formula

- **Volume (commits + LOC)** is weighted 50% combined. Both matter; neither dominates.
- **Diversity & consistency** capture *quality of engagement* — did they actually engage with the codebase over time, or copy-paste 2,000 lines in one commit?
- **Review & initiative** reward the meta-work that drives a project — opening PRs, reviewing teammates' code.
- **Ownership** is a small weight because it's heavily correlated with volume already.

### Sensitivity & user override

The `/about` page (and a panel on the dashboard in M4) includes a re-weight UI where users can adjust the weights and see the score recompute live. The default weights are clearly labelled as a *starting point*, not the truth.

---

## Edge cases & how we handle them

### Squash merges
A squash merge collapses a PR's commits into one, attributed to the merger. Without PR data, you'd undercount the actual author.

**Fix:** Always pull PR data alongside commit data. For commits that are squash-merge commits (heuristic: commit message contains a PR number, e.g. `(#42)`), look up the PR and credit the PR author with the additions/deletions, not the merger.

### Force pushes / rebases
Rewriting history doesn't change the *current* commit graph, just the past. We only care about the current head's reachable commits, so rebases are invisible to us. That's fine.

### Co-authored commits
If a commit has `Co-authored-by:` trailers, split the credit equally across all listed authors.

### Bots
Filter out commits authored by GitHub Apps (e.g. `dependabot[bot]`, `github-actions[bot]`, `renovate[bot]`) entirely. Show them in a separate "Bots" section with their changes excluded from contributor metrics.

### Single-contributor repos
If only one human contributor exists, skip the balance score entirely and show a notice: *"This repo has one contributor. Balance scoring requires two or more."*

### Very small repos (< 10 commits)
Show all metrics but display a warning: *"This repo has fewer than 10 commits. Take all numbers with a grain of salt."*

### Empty repos / no permission
Surface a clear, friendly error. Never crash.

---

## What we explicitly do not measure

The dashboard must include a **"What we can't see"** panel listing these limitations:

- **Code quality.** A 5-line elegant fix and a 500-line copy-paste look the same to git.
- **Pair programming.** If two students sat at one laptop, only one gets credit.
- **Design & planning work.** Whiteboards, Figma, meetings, documents — none of it is in git.
- **External commits.** If a teammate pushed via someone else's machine, attribution is wrong.
- **Squashed history.** If your team rebases everything into one commit before submission, this tool will produce nonsense. Don't do that.

This panel is required. It is the single most important thing for the tool's credibility.
