import type { CommitRecord, PullRequestRecord, RepoMeta } from "@/lib/github/types";
import type { UnifiedContributor } from "./identityUnification";
import type { NoiseReason } from "./noiseFilter";

/** What the M1 endpoint hands back. M2 layers on chart-shaped data. */
export type M1AnalysisPayload = {
  repo: {
    owner: string;
    name: string;
    headSha: string;
    defaultBranch: string;
    analysedAt: string;
  };
  contributors: UnifiedContributor[];
  totals: {
    commits: number;
    contributors: number;
    humanContributors: number;
    botContributors: number;
  };
  notes: string[];
};

/** Bundle of fetched + filtered data passed between analysis steps. */
export type FetchedRepoData = {
  meta: RepoMeta;
  commits: CommitRecord[];
  pullRequests: PullRequestRecord[];
};

export type NoiseSummary = {
  totalFiles: number;
  excludedFiles: number;
  byReason: Partial<Record<NoiseReason, number>>;
};
