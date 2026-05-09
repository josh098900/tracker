import type { UnifiedContributor } from "./identityUnification";
import type { NoiseReason } from "./noiseFilter";
import type { ContributorMetrics } from "./contributorMetrics";
import type { ConsistencyMetrics } from "./consistency";
import type { OwnershipNode } from "./fileOwnership";

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

/** Full analysis payload including chart-ready data (M2). */
export type FullAnalysisPayload = M1AnalysisPayload & {
  metrics: ContributorMetrics[];
  consistency: ConsistencyMetrics[];
  fileOwnership: OwnershipNode;
  ownershipShares: Record<string, number>;
  timeline: TimelinePoint[];
  churn: ChurnPoint[];
  heatmap: HeatmapData[];
  coAuthorship: CoAuthorshipGraph;
};

/** Weekly commit counts per contributor for the stacked area chart. */
export type TimelinePoint = {
  /** ISO week string (YYYY-Www). */
  week: string;
  /** Unix timestamp for the week start. */
  weekTs: number;
  /** Contributor id → commit count this week. */
  [contributorId: string]: number | string;
};

/** Weekly additions / deletions for the churn chart. */
export type ChurnPoint = {
  week: string;
  weekTs: number;
  additions: number;
  deletions: number;
  net: number;
};

/** Per-contributor heatmap data (day × hour). */
export type HeatmapData = {
  contributorId: string;
  /** 7 × 24 grid of commit counts. rows = days (0=Mon..6=Sun), cols = hours (0..23). */
  grid: number[][];
  /** Max value in this contributor's grid (for colour scaling). */
  max: number;
};

/** Force-directed co-authorship graph. */
export type CoAuthorshipGraph = {
  nodes: Array<{
    id: string;
    login: string | null;
    displayName: string;
    avatarUrl: string | null;
    /** Number of PRs authored or reviewed. */
    weight: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    /** Strength of collaboration (co-authored commits + PR reviews). */
    weight: number;
  }>;
};

/** Bundle of fetched + filtered data passed between analysis steps. */
export type FetchedRepoData = {
  meta: import("@/lib/github/types").RepoMeta;
  commits: import("@/lib/github/types").CommitRecord[];
  pullRequests: import("@/lib/github/types").PullRequestRecord[];
};

export type NoiseSummary = {
  totalFiles: number;
  excludedFiles: number;
  byReason: Partial<Record<NoiseReason, number>>;
};
