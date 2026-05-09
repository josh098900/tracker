import { getCache } from "@/lib/cache";
import { getOctokit } from "./client";
import type { RepoMeta } from "./types";

const META_TTL_SECONDS = 5 * 60;
const SHA_TTL_SECONDS = 2 * 60;

/**
 * Fetch repository metadata, including the head SHA at the tip of the
 * default branch. Cached for 5 minutes per docs/ARCHITECTURE.md so the
 * "is this analysis still fresh?" check doesn't spam GitHub on every
 * dashboard refresh.
 */
export async function fetchRepoMeta(
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  const cache = getCache();
  const cacheKey = `repo_meta:${owner}/${repo}`;
  const cached = await cache.get<RepoMeta>(cacheKey);
  if (cached) return cached;

  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.get({ owner, repo });

  const headSha = await fetchLatestSha(owner, repo, data.default_branch);

  const meta: RepoMeta = {
    owner: data.owner.login,
    name: data.name,
    defaultBranch: data.default_branch,
    headSha,
    isPrivate: data.private,
    archived: data.archived ?? false,
    size: data.size ?? 0,
    stargazers: data.stargazers_count ?? 0,
    pushedAt: data.pushed_at ?? null,
  };
  await cache.set(cacheKey, meta, META_TTL_SECONDS);
  return meta;
}

/**
 * Fetch the latest commit SHA on `branch`. Cached for 2 minutes — the
 * cheapest way to detect "is the analysis stale?" without paying for
 * the full repo metadata round-trip.
 */
export async function fetchLatestSha(
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const cache = getCache();
  const cacheKey = `latest_sha:${owner}/${repo}@${branch}`;
  const cached = await cache.get<string>(cacheKey);
  if (cached) return cached;

  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch });
  const sha = data.commit.sha;
  await cache.set(cacheKey, sha, SHA_TTL_SECONDS);
  return sha;
}
