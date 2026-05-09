/**
 * Full analysis pipeline (M2).
 *
 * Extends the M1 pipeline (identity unification + basic counts) with:
 * - Per-contributor metrics (volume, diversity, review, initiative)
 * - Consistency scores
 * - File ownership treemap
 * - All chart-ready data shapes (timeline, churn, heatmap, co-authorship)
 *
 * The caller is responsible for cache keying — see `getOrComputeAnalysis`.
 */

import { getCache } from "@/lib/cache";
import { fetchCommits } from "@/lib/github/fetchCommits";
import { fetchPullRequests } from "@/lib/github/fetchPRs";
import { fetchRepoMeta } from "@/lib/github/fetchRepo";
import { fetchContributorStats, fetchCodeFrequency } from "@/lib/github/fetchStats";
import { fetchRepoTree } from "@/lib/github/fetchTree";
import { unifyIdentities, type RawCommitAuthor } from "./identityUnification";
import { computeContributorMetrics } from "./contributorMetrics";
import { computeConsistency } from "./consistency";
import { buildFileOwnership, computeOwnershipShares } from "./fileOwnership";
import {
  buildTimeline,
  buildChurn,
  buildHeatmap,
  buildCoAuthorshipGraph,
} from "./chartData";
import type { FullAnalysisPayload } from "./types";
import type { CommitRecord } from "@/lib/github/types";

const ANALYSIS_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Cache-aware entry point. Looks up by `${owner}/${repo}@${headSha}`
 * and either returns cached or computes fresh.
 */
export async function getOrComputeAnalysis(
  owner: string,
  repo: string,
): Promise<{ payload: FullAnalysisPayload; cacheHit: boolean; headSha: string }> {
  const meta = await fetchRepoMeta(owner, repo);
  const cache = getCache();
  const cacheKey = `analysis:v3:${meta.owner}/${meta.name}@${meta.headSha}`;

  const cached = await cache.get<FullAnalysisPayload>(cacheKey);
  if (cached) {
    return { payload: cached, cacheHit: true, headSha: meta.headSha };
  }

  const payload = await runFullAnalysis(meta.owner, meta.name);
  await cache.set(cacheKey, payload, ANALYSIS_TTL_SECONDS);
  return { payload, cacheHit: false, headSha: meta.headSha };
}

/**
 * Run the full M2 analysis pipeline.
 */
export async function runFullAnalysis(
  owner: string,
  repo: string,
): Promise<FullAnalysisPayload> {
  const meta = await fetchRepoMeta(owner, repo);

  // Fetch all data sources in parallel
  const [commits, pullRequests, contributorStats, codeFrequency, tree] =
    await Promise.all([
      fetchCommits(owner, repo),
      fetchPullRequests(owner, repo),
      fetchContributorStats(owner, repo),
      fetchCodeFrequency(owner, repo),
      fetchRepoTree(owner, repo, meta.headSha).catch(() => []),
    ]);

  // Identity unification (same as M1)
  const authors = commits.map(toRawAuthor);
  const { contributors } = unifyIdentities(authors);
  const humans = contributors.filter((c) => !c.isBot);
  const bots = contributors.filter((c) => c.isBot);

  // Notes
  const notes: string[] = [];
  if (humans.length === 0) {
    notes.push("No human contributors detected — repo may be empty or all commits are bot-authored.");
  } else if (humans.length === 1) {
    notes.push("Single contributor — balance scoring will be skipped on the dashboard.");
  }
  if (commits.length < 10) {
    notes.push("Fewer than 10 commits — take all numbers with a grain of salt.");
  }
  if (pullRequests.length === 0) {
    notes.push("No pull requests found — review-quality metrics will be limited.");
  }

  // Count total meaningful files for diversity score
  const totalMeaningfulFiles = tree.filter((e) => e.type === "blob").length;

  // Compute metrics
  const metrics = computeContributorMetrics(
    contributors,
    contributorStats,
    commits,
    pullRequests,
    totalMeaningfulFiles,
  );
  const consistency = computeConsistency(contributors, commits);

  // File ownership
  const fileOwnershipTree = buildFileOwnership(tree, commits, contributors);
  const ownershipSharesMap = computeOwnershipShares(fileOwnershipTree);
  const ownershipShares: Record<string, number> = {};
  for (const [id, share] of ownershipSharesMap) {
    ownershipShares[id] = share;
  }

  // Chart data
  const timeline = buildTimeline(contributors, contributorStats, commits);
  const churn = buildChurn(codeFrequency);
  const heatmap = buildHeatmap(contributors, commits);
  const coAuthorship = buildCoAuthorshipGraph(contributors, commits, pullRequests);

  return {
    repo: {
      owner: meta.owner,
      name: meta.name,
      headSha: meta.headSha,
      defaultBranch: meta.defaultBranch,
      analysedAt: new Date().toISOString(),
    },
    contributors,
    totals: {
      commits: commits.length,
      contributors: contributors.length,
      humanContributors: humans.length,
      botContributors: bots.length,
    },
    notes,
    metrics,
    consistency,
    fileOwnership: fileOwnershipTree,
    ownershipShares,
    timeline,
    churn,
    heatmap,
    coAuthorship,
  };
}

function toRawAuthor(c: CommitRecord): RawCommitAuthor {
  return {
    key: c.sha,
    gitName: c.author.gitName,
    gitEmail: c.author.gitEmail,
    githubLogin: c.author.login,
    githubId: c.author.githubId,
    githubAvatarUrl: c.author.avatarUrl,
  };
}
