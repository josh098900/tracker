import { getOctokit } from "./client";
import type { CommitRecord } from "./types";

const PER_PAGE = 100;
const COAUTHOR_RE = /^Co-authored-by:[ \t]*([^<\r\n]+?)[ \t]*<([^>\r\n]+)>[ \t]*$/gim;

/**
 * Fetch all commits reachable from the head SHA on the default branch.
 *
 * The list endpoint does not include diff stats, so we don't pull them
 * here — M2's metric calculations need them and will fan out per-commit
 * once we know which commits aren't filtered out. This keeps M1's
 * latency budget (~5s for fetched data) achievable.
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  options: { sinceSha?: string; maxPages?: number } = {},
): Promise<CommitRecord[]> {
  const octokit = getOctokit();
  const maxPages = options.maxPages ?? 50; // 5,000 commit ceiling — see PRD success criteria.
  const out: CommitRecord[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: PER_PAGE,
      page,
    });
    if (data.length === 0) break;

    for (const c of data) {
      out.push(toCommitRecord(c));
    }

    if (data.length < PER_PAGE) break;
  }

  // MVP File Ownership Hack: listCommits doesn't return `.files`.
  // Fetching all individual commits would hit rate limits.
  // Instead, we fetch full details for the 30 most recent commits in parallel.
  // This provides *some* recent file ownership data for the treemap.
  const recentToEnrich = out.slice(0, 30);
  await Promise.allSettled(
    recentToEnrich.map(async (c, i) => {
      try {
        const { data: fullCommit } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: c.sha,
        });
        out[i].files = fullCommit.files?.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          status: f.status,
        }));
      } catch (err) {
        // Ignore individual commit fetch failures
      }
    }),
  );

  return out;
}

type ListedCommit = Awaited<
  ReturnType<ReturnType<typeof getOctokit>["rest"]["repos"]["listCommits"]>
>["data"][number];

function toCommitRecord(c: ListedCommit): CommitRecord {
  const message = c.commit.message ?? "";
  return {
    sha: c.sha,
    message,
    authoredAt: c.commit.author?.date ?? "",
    author: {
      gitName: c.commit.author?.name ?? null,
      gitEmail: c.commit.author?.email ?? null,
      login: c.author?.login ?? null,
      githubId: c.author?.id ?? null,
      avatarUrl: c.author?.avatar_url ?? null,
    },
    coAuthors: parseCoAuthors(message),
    stats: {
      additions: 0,
      deletions: 0,
      total: 0,
    },
  };
}

/**
 * Pull `Co-authored-by:` trailers out of a commit message. Per
 * METRICS.md these get equal credit alongside the primary author when
 * computing per-contributor metrics.
 */
export function parseCoAuthors(
  message: string,
): Array<{ name: string; email: string }> {
  const out: Array<{ name: string; email: string }> = [];
  COAUTHOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COAUTHOR_RE.exec(message))) {
    out.push({ name: match[1].trim(), email: match[2].trim().toLowerCase() });
  }
  return out;
}
