/**
 * Chart-ready data transformers.
 *
 * Takes raw commits / stats and shapes them into the structures each
 * chart component expects. All functions are pure — they don't fetch
 * anything.
 */

import type { CommitRecord } from "@/lib/github/types";
import type { ContributorStat } from "@/lib/github/fetchStats";
import type { UnifiedContributor } from "./identityUnification";
import type {
  TimelinePoint,
  ChurnPoint,
  HeatmapData,
  CoAuthorshipGraph,
} from "./types";

/**
 * Build the contribution timeline (stacked area chart data).
 *
 * Each point is one ISO week with per-contributor commit counts.
 * Uses the GitHub stats API weekly data when available, otherwise
 * falls back to bucketing raw commits by timestamp.
 */
export function buildTimeline(
  contributors: UnifiedContributor[],
  stats: ContributorStat[],
  commits: CommitRecord[],
): TimelinePoint[] {
  // Build login → contributor id lookup
  const loginToId = new Map<string, string>();
  const ghIdToId = new Map<number, string>();
  for (const c of contributors) {
    if (c.login) loginToId.set(c.login.toLowerCase(), c.id);
    if (c.githubId !== null) ghIdToId.set(c.githubId, c.id);
  }

  // Try GitHub stats API first (more accurate for LOC data)
  if (stats.length > 0) {
    const weekSet = new Set<number>();
    const weekData = new Map<number, Record<string, number>>();

    for (const stat of stats) {
      const cid =
        (stat.githubId !== null ? ghIdToId.get(stat.githubId) : undefined) ??
        (stat.login ? loginToId.get(stat.login.toLowerCase()) : undefined);
      if (!cid) continue;

      for (const w of stat.weeks) {
        if (w.c === 0) continue;
        weekSet.add(w.w);
        const entry = weekData.get(w.w) ?? {};
        entry[cid] = (entry[cid] ?? 0) + w.c;
        weekData.set(w.w, entry);
      }
    }

    const sortedWeeks = [...weekSet].sort((a, b) => a - b);
    return sortedWeeks.map((ts) => {
      const d = new Date(ts * 1000);
      const week = isoWeekLabel(d);
      const point: TimelinePoint = { week, weekTs: ts };
      const data = weekData.get(ts) ?? {};
      for (const c of contributors) {
        if (!c.isBot) point[c.id] = data[c.id] ?? 0;
      }
      return point;
    });
  }

  // Fallback: bucket from raw commits
  return buildTimelineFromCommits(contributors, commits);
}

function buildTimelineFromCommits(
  contributors: UnifiedContributor[],
  commits: CommitRecord[],
): TimelinePoint[] {
  const commitOwner = new Map<string, string>();
  for (const c of contributors) {
    for (const key of c.commitKeys) commitOwner.set(key, c.id);
  }

  const weekBuckets = new Map<number, Record<string, number>>();
  for (const commit of commits) {
    const ts = new Date(commit.authoredAt);
    if (isNaN(ts.getTime())) continue;
    const weekTs = mondayOf(ts);
    const cid = commitOwner.get(commit.sha);
    if (!cid) continue;
    const entry = weekBuckets.get(weekTs) ?? {};
    entry[cid] = (entry[cid] ?? 0) + 1;
    weekBuckets.set(weekTs, entry);
  }

  const sortedWeeks = [...weekBuckets.keys()].sort((a, b) => a - b);
  return sortedWeeks.map((ts) => {
    const d = new Date(ts * 1000);
    const week = isoWeekLabel(d);
    const point: TimelinePoint = { week, weekTs: ts };
    const data = weekBuckets.get(ts) ?? {};
    for (const c of contributors) {
      if (!c.isBot) point[c.id] = data[c.id] ?? 0;
    }
    return point;
  });
}

/**
 * Build churn data (additions vs deletions over time).
 */
export function buildChurn(
  codeFrequency: Array<{ week: number; additions: number; deletions: number }>,
): ChurnPoint[] {
  return codeFrequency
    .filter((cf) => cf.additions > 0 || cf.deletions > 0)
    .map((cf) => ({
      week: isoWeekLabel(new Date(cf.week * 1000)),
      weekTs: cf.week,
      additions: cf.additions,
      deletions: cf.deletions,
      net: cf.additions - cf.deletions,
    }));
}

/**
 * Build commit heatmap data (day-of-week × hour-of-day) per contributor.
 */
export function buildHeatmap(
  contributors: UnifiedContributor[],
  commits: CommitRecord[],
): HeatmapData[] {
  const commitOwner = new Map<string, string>();
  for (const c of contributors) {
    for (const key of c.commitKeys) commitOwner.set(key, c.id);
  }

  const grids = new Map<string, number[][]>();

  for (const commit of commits) {
    const cid = commitOwner.get(commit.sha);
    if (!cid) continue;
    const ts = new Date(commit.authoredAt);
    if (isNaN(ts.getTime())) continue;

    // day: 0=Mon..6=Sun, hour: 0..23
    const day = (ts.getUTCDay() + 6) % 7; // shift so Monday=0
    const hour = ts.getUTCHours();

    if (!grids.has(cid)) {
      grids.set(cid, Array.from({ length: 7 }, () => new Array(24).fill(0)));
    }
    grids.get(cid)![day][hour] += 1;
  }

  return contributors
    .filter((c) => !c.isBot)
    .map((c) => {
      const grid = grids.get(c.id) ?? Array.from({ length: 7 }, () => new Array(24).fill(0));
      const max = Math.max(1, ...grid.flat());
      return { contributorId: c.id, grid, max };
    });
}

/**
 * Build the co-authorship graph from PRs and co-authored-by trailers.
 */
export function buildCoAuthorshipGraph(
  contributors: UnifiedContributor[],
  commits: CommitRecord[],
  pullRequests: Array<{
    authorLogin: string | null;
    authorGithubId: number | null;
    reviews: Array<{
      reviewerLogin: string | null;
      reviewerGithubId: number | null;
    }>;
  }>,
): CoAuthorshipGraph {
  const loginToId = new Map<string, string>();
  const ghIdToId = new Map<number, string>();
  for (const c of contributors) {
    if (c.login) loginToId.set(c.login.toLowerCase(), c.id);
    if (c.githubId !== null) ghIdToId.set(c.githubId, c.id);
  }

  const resolveId = (login: string | null, ghId: number | null): string | null => {
    if (ghId !== null && ghIdToId.has(ghId)) return ghIdToId.get(ghId)!;
    if (login && loginToId.has(login.toLowerCase())) return loginToId.get(login.toLowerCase())!;
    return null;
  };

  const edgeWeights = new Map<string, number>();
  const nodeWeights = new Map<string, number>();

  const addEdge = (a: string, b: string): void => {
    const key = [a, b].sort().join("→");
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    nodeWeights.set(a, (nodeWeights.get(a) ?? 0) + 1);
    nodeWeights.set(b, (nodeWeights.get(b) ?? 0) + 1);
  };

  // Co-authored-by relationships
  const commitOwner = new Map<string, string>();
  for (const c of contributors) {
    for (const key of c.commitKeys) commitOwner.set(key, c.id);
  }

  for (const commit of commits) {
    if (commit.coAuthors.length === 0) continue;
    const primaryId = commitOwner.get(commit.sha);
    if (!primaryId) continue;
    for (const co of commit.coAuthors) {
      // Try to resolve co-author to a contributor
      const coEmail = co.email.toLowerCase();
      const coContributor = contributors.find((c) =>
        c.emails.includes(coEmail),
      );
      if (coContributor && coContributor.id !== primaryId) {
        addEdge(primaryId, coContributor.id);
      }
    }
  }

  // PR review relationships
  for (const pr of pullRequests) {
    const authorId = resolveId(pr.authorLogin, pr.authorGithubId);
    if (!authorId) continue;
    for (const review of pr.reviews) {
      const reviewerId = resolveId(review.reviewerLogin, review.reviewerGithubId);
      if (reviewerId && reviewerId !== authorId) {
        addEdge(authorId, reviewerId);
      }
    }
  }

  const humans = contributors.filter((c) => !c.isBot);
  const nodes = humans.map((c) => ({
    id: c.id,
    login: c.login,
    displayName: c.displayName,
    avatarUrl: c.avatarUrl,
    weight: nodeWeights.get(c.id) ?? 1,
  }));

  const edges: CoAuthorshipGraph["edges"] = [];
  for (const [key, weight] of edgeWeights) {
    const [source, target] = key.split("→");
    edges.push({ source, target, weight });
  }

  return { nodes, edges };
}

// ── helpers ──────────────────────────────────────────────────────────

function isoWeekLabel(d: Date): string {
  const copy = new Date(d.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${copy.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function mondayOf(d: Date): number {
  const copy = new Date(d.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  const day = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - day);
  return Math.floor(copy.getTime() / 1000);
}
