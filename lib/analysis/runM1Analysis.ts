import { getCache } from "@/lib/cache";
import type { CommitRecord } from "@/lib/github/types";
import { fetchCommits } from "@/lib/github/fetchCommits";
import { fetchPullRequests } from "@/lib/github/fetchPRs";
import { fetchRepoMeta } from "@/lib/github/fetchRepo";
import { unifyIdentities, type RawCommitAuthor } from "./identityUnification";
import type { M1AnalysisPayload } from "./types";

const ANALYSIS_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days per docs/ARCHITECTURE.md.

/**
 * Cache-aware variant: looks up the analysis by `${owner}/${repo}@${headSha}`
 * and either returns the cached payload or computes-and-caches a fresh one.
 *
 * Both the API route and the dashboard page use this so they hit the same
 * cache keys and run the same analysis pipeline.
 */
export async function getOrComputeM1Analysis(
  owner: string,
  repo: string,
): Promise<{ payload: M1AnalysisPayload; cacheHit: boolean; headSha: string }> {
  const meta = await fetchRepoMeta(owner, repo);
  const cache = getCache();
  const cacheKey = `analysis:${meta.owner}/${meta.name}@${meta.headSha}`;

  const cached = await cache.get<M1AnalysisPayload>(cacheKey);
  if (cached) {
    return { payload: cached, cacheHit: true, headSha: meta.headSha };
  }

  const payload = await runM1Analysis(meta.owner, meta.name);
  await cache.set(cacheKey, payload, ANALYSIS_TTL_SECONDS);
  return { payload, cacheHit: false, headSha: meta.headSha };
}

/**
 * Run the M1 slice of the analysis: fetch repo meta, commits and PRs,
 * unify identities, return a JSON payload. M2 layers chart-shaped data
 * on top; M3 adds the balance score, SSE streaming, and (optionally)
 * the LLM summary.
 *
 * Caller is responsible for caching by `${owner}/${repo}@${headSha}`.
 */
export async function runM1Analysis(
  owner: string,
  repo: string,
): Promise<M1AnalysisPayload> {
  const meta = await fetchRepoMeta(owner, repo);
  const [commits, pullRequests] = await Promise.all([
    fetchCommits(owner, repo),
    fetchPullRequests(owner, repo),
  ]);

  const authors = commits.map(toRawAuthor);
  const { contributors } = unifyIdentities(authors);

  const humans = contributors.filter((c) => !c.isBot);
  const bots = contributors.filter((c) => c.isBot);

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
