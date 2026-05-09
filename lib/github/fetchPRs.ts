import { getOctokit } from "./client";
import type { PullRequestRecord } from "./types";

const PER_PAGE = 100;

/**
 * Fetch all pull requests for the repo (both open and closed). M1
 * surfaces only counts; M3 uses these for review-quality metrics and
 * for correctly attributing squash-merge commits per docs/METRICS.md.
 *
 * We deliberately don't pull review comments here — that's a per-PR
 * round-trip and would blow the M1 latency budget on busy repos. The
 * dashboard fetcher in M3 will do that.
 */
export async function fetchPullRequests(
  owner: string,
  repo: string,
  options: { maxPages?: number } = {},
): Promise<PullRequestRecord[]> {
  const octokit = getOctokit();
  const maxPages = options.maxPages ?? 20;
  const out: PullRequestRecord[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: PER_PAGE,
      page,
      sort: "created",
      direction: "desc",
    });
    if (data.length === 0) break;

    for (const pr of data) {
      out.push({
        number: pr.number,
        state: pr.state === "open" ? "open" : "closed",
        merged: !!pr.merged_at,
        mergeCommitSha: pr.merge_commit_sha ?? null,
        authorLogin: pr.user?.login ?? null,
        authorGithubId: pr.user?.id ?? null,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at ?? null,
        reviews: [],
        reviewCommentCount: 0,
      });
    }

    if (data.length < PER_PAGE) break;
  }

  return out;
}
