import { getOctokit } from "./client";

/**
 * Weekly contribution stats from the GitHub Statistics API.
 *
 * `GET /repos/{owner}/{repo}/stats/contributors` returns an array of
 * contributor objects, each with a `weeks` array containing weekly
 * additions, deletions, and commits. GitHub caches these and may
 * return 202 (computing) on first request — we retry with back-off.
 *
 * This is far cheaper than fetching per-commit diff stats individually
 * and gives us everything we need for: contribution timeline, churn
 * chart, consistency metrics, and per-contributor volume metrics.
 */

export type WeekStat = {
  /** Unix timestamp for the start of the week (Sunday midnight UTC). */
  w: number;
  /** Lines added this week. */
  a: number;
  /** Lines deleted this week. */
  d: number;
  /** Commits this week. */
  c: number;
};

export type ContributorStat = {
  login: string | null;
  githubId: number | null;
  avatarUrl: string | null;
  total: number;
  weeks: WeekStat[];
};

const MAX_RETRIES = 4;
const INITIAL_DELAY_MS = 1000;

/**
 * Fetch per-contributor weekly stats. Handles the 202 "computing"
 * response by retrying with exponential back-off (GitHub computes
 * stats lazily on first request and caches them server-side).
 */
export async function fetchContributorStats(
  owner: string,
  repo: string,
): Promise<ContributorStat[]> {
  const octokit = getOctokit();
  let delay = INITIAL_DELAY_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/stats/contributors",
      { owner, repo },
    );

    if (response.status === 200 && Array.isArray(response.data)) {
      return (response.data as Array<{
        author: { login?: string; id?: number; avatar_url?: string } | null;
        total: number;
        weeks: WeekStat[];
      }>).map((entry) => ({
        login: entry.author?.login ?? null,
        githubId: entry.author?.id ?? null,
        avatarUrl: entry.author?.avatar_url ?? null,
        total: entry.total,
        weeks: entry.weeks,
      }));
    }

    // 202 = GitHub is computing stats; retry after a delay.
    if (response.status === 202 && attempt < MAX_RETRIES) {
      await sleep(delay);
      delay *= 2;
      continue;
    }

    // Empty repo or unexpected response — return empty.
    return [];
  }

  return [];
}

/**
 * Fetch weekly code frequency (total additions + deletions, not per
 * contributor). Lighter weight alternative when we only need aggregate
 * churn data.
 */
export async function fetchCodeFrequency(
  owner: string,
  repo: string,
): Promise<Array<{ week: number; additions: number; deletions: number }>> {
  const octokit = getOctokit();
  let delay = INITIAL_DELAY_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/stats/code_frequency",
      { owner, repo },
    );

    if (response.status === 200 && Array.isArray(response.data)) {
      return (response.data as Array<[number, number, number]>).map(
        ([week, additions, deletions]) => ({
          week,
          additions,
          deletions: Math.abs(deletions),
        }),
      );
    }

    if (response.status === 202 && attempt < MAX_RETRIES) {
      await sleep(delay);
      delay *= 2;
      continue;
    }

    return [];
  }

  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
