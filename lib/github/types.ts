/**
 * Repo metadata returned by the GitHub REST API for a single repository.
 * We keep only the fields the analyser actually uses; everything else is
 * dropped at the fetch boundary so downstream code doesn't reach into
 * Octokit response shapes.
 */
export type RepoMeta = {
  owner: string;
  name: string;
  defaultBranch: string;
  /** SHA at the tip of the default branch when this metadata was fetched. */
  headSha: string;
  isPrivate: boolean;
  archived: boolean;
  size: number;
  stargazers: number;
  pushedAt: string | null;
};

/**
 * One commit, normalised to the analyser's view.
 *
 * We track both the GitHub-resolved author (login + id, may be null) and
 * the raw git author signature, because the unification step in
 * docs/METRICS.md needs both signals.
 */
export type CommitRecord = {
  sha: string;
  message: string;
  authoredAt: string;
  author: {
    gitName: string | null;
    gitEmail: string | null;
    login: string | null;
    githubId: number | null;
    avatarUrl: string | null;
  };
  /** Co-authors parsed from `Co-authored-by:` trailers. */
  coAuthors: Array<{ name: string; email: string }>;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  /** File-level diff stats. Optional — the list endpoint doesn't include them. */
  files?: Array<{ filename: string; additions: number; deletions: number; status: string }>;
};

/**
 * One pull request, normalised. Used for review-quality metrics and to
 * correctly attribute squash-merge commits in METRICS.md.
 */
export type PullRequestRecord = {
  number: number;
  state: "open" | "closed";
  merged: boolean;
  mergeCommitSha: string | null;
  authorLogin: string | null;
  authorGithubId: number | null;
  createdAt: string;
  mergedAt: string | null;
  reviews: Array<{
    reviewerLogin: string | null;
    reviewerGithubId: number | null;
    state: string;
    submittedAt: string | null;
  }>;
  reviewCommentCount: number;
};
