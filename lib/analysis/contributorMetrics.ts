/**
 * Per-contributor metrics — see docs/METRICS.md.
 *
 * Computes volume, diversity, peer review, and initiative scores for
 * each unified contributor. Consistency is handled separately in
 * `consistency.ts` because it needs its own weekly-bucketing logic.
 */

import type { CommitRecord, PullRequestRecord } from "@/lib/github/types";
import type { ContributorStat } from "@/lib/github/fetchStats";
import type { UnifiedContributor } from "./identityUnification";
import { classifyFile } from "./noiseFilter";

export type ContributorMetrics = {
  id: string;
  /** Raw commit count (after noise filtering doesn't apply to commit counts). */
  commits: number;
  /** Fraction of total commits. */
  commitsShare: number;
  /** Meaningful lines added (excluding noise files). */
  meaningfulLocAdded: number;
  /** Meaningful lines removed. */
  meaningfulLocRemoved: number;
  /** `added + removed`. */
  meaningfulLocChanged: number;
  /** Fraction of total meaningful LOC changed. */
  locShare: number;
  /** Distinct meaningful files this contributor edited. */
  filesTouched: number;
  /** Distinct top-level folders edited. */
  foldersTouched: number;
  /** `filesTouched / totalFilesInRepo`, clipped to [0, 1]. */
  diversityScore: number;
  /** PRs opened. */
  prsOpened: number;
  /** PRs reviewed (excluding own). */
  prsReviewed: number;
  /** Review comments left. */
  reviewComments: number;
  /** `(prsReviewed + reviewComments * 0.2) / totalReviewActions`. */
  reviewScore: number;
  /** `prsOpened / totalPrs`. */
  initiativeScore: number;
};

/**
 * Compute per-contributor metrics. Needs:
 * - Unified contributors (from identityUnification)
 * - GitHub stats (weekly a/d/c per contributor)
 * - Commits (for file-level noise filtering)
 * - PRs (for review metrics)
 */
export function computeContributorMetrics(
  contributors: UnifiedContributor[],
  stats: ContributorStat[],
  commits: CommitRecord[],
  pullRequests: PullRequestRecord[],
  totalFilesInRepo: number,
): ContributorMetrics[] {
  // Build lookup: githubId or login → unified contributor id
  const loginToId = new Map<string, string>();
  const ghIdToId = new Map<number, string>();
  for (const c of contributors) {
    if (c.login) loginToId.set(c.login.toLowerCase(), c.id);
    if (c.githubId !== null) ghIdToId.set(c.githubId, c.id);
  }

  const resolveContributorId = (
    login: string | null,
    githubId: number | null,
  ): string | null => {
    if (githubId !== null && ghIdToId.has(githubId)) return ghIdToId.get(githubId)!;
    if (login && loginToId.has(login.toLowerCase())) return loginToId.get(login.toLowerCase())!;
    return null;
  };

  // Aggregate LOC from GitHub stats per contributor
  const locAdded = new Map<string, number>();
  const locRemoved = new Map<string, number>();
  for (const stat of stats) {
    const cid = resolveContributorId(stat.login, stat.githubId);
    if (!cid) continue;
    let added = 0;
    let removed = 0;
    for (const w of stat.weeks) {
      added += w.a;
      removed += w.d;
    }
    locAdded.set(cid, (locAdded.get(cid) ?? 0) + added);
    locRemoved.set(cid, (locRemoved.get(cid) ?? 0) + removed);
  }

  // Track files/folders touched per contributor from commits with file data
  const filesTouchedByContributor = new Map<string, Set<string>>();
  const foldersTouchedByContributor = new Map<string, Set<string>>();
  for (const commit of commits) {
    const cid = resolveContributorId(commit.author.login, commit.author.githubId);
    if (!cid || !commit.files) continue;
    for (const file of commit.files) {
      if (classifyFile({ path: file.filename }).excluded) continue;
      if (!filesTouchedByContributor.has(cid)) {
        filesTouchedByContributor.set(cid, new Set());
      }
      filesTouchedByContributor.get(cid)!.add(file.filename);
      const topFolder = file.filename.split("/")[0];
      if (!foldersTouchedByContributor.has(cid)) {
        foldersTouchedByContributor.set(cid, new Set());
      }
      foldersTouchedByContributor.get(cid)!.add(topFolder);
    }
  }

  // PR metrics
  const prsOpenedBy = new Map<string, number>();
  const prsReviewedBy = new Map<string, number>();
  const reviewCommentsBy = new Map<string, number>();
  for (const pr of pullRequests) {
    const authorId = resolveContributorId(pr.authorLogin, pr.authorGithubId);
    if (authorId) {
      prsOpenedBy.set(authorId, (prsOpenedBy.get(authorId) ?? 0) + 1);
    }
    for (const review of pr.reviews) {
      const reviewerId = resolveContributorId(review.reviewerLogin, review.reviewerGithubId);
      if (reviewerId && reviewerId !== authorId) {
        prsReviewedBy.set(reviewerId, (prsReviewedBy.get(reviewerId) ?? 0) + 1);
      }
    }
    // reviewCommentCount is aggregated, we split evenly among reviewers for now
    if (pr.reviewCommentCount > 0 && pr.reviews.length > 0) {
      const perReviewer = pr.reviewCommentCount / pr.reviews.length;
      for (const review of pr.reviews) {
        const reviewerId = resolveContributorId(review.reviewerLogin, review.reviewerGithubId);
        if (reviewerId && reviewerId !== resolveContributorId(pr.authorLogin, pr.authorGithubId)) {
          reviewCommentsBy.set(reviewerId, (reviewCommentsBy.get(reviewerId) ?? 0) + perReviewer);
        }
      }
    }
  }

  const totalCommits = contributors.reduce((s, c) => s + c.commitKeys.length, 0);
  const totalLocChanged = [...locAdded.values()].reduce((s, v) => s + v, 0)
    + [...locRemoved.values()].reduce((s, v) => s + v, 0);
  const totalPrs = pullRequests.length || 1; // avoid divide-by-zero
  const totalReviewActions = Math.max(
    1,
    [...prsReviewedBy.values()].reduce((s, v) => s + v, 0)
    + [...reviewCommentsBy.values()].reduce((s, v) => s + v, 0) * 0.2,
  );

  return contributors.filter((c) => !c.isBot).map((c) => {
    const added = locAdded.get(c.id) ?? 0;
    const removed = locRemoved.get(c.id) ?? 0;
    const changed = added + removed;
    const files = filesTouchedByContributor.get(c.id)?.size ?? 0;
    const folders = foldersTouchedByContributor.get(c.id)?.size ?? 0;
    const reviewed = prsReviewedBy.get(c.id) ?? 0;
    const comments = reviewCommentsBy.get(c.id) ?? 0;

    return {
      id: c.id,
      commits: c.commitKeys.length,
      commitsShare: totalCommits > 0 ? c.commitKeys.length / totalCommits : 0,
      meaningfulLocAdded: added,
      meaningfulLocRemoved: removed,
      meaningfulLocChanged: changed,
      locShare: totalLocChanged > 0 ? changed / totalLocChanged : 0,
      filesTouched: files,
      foldersTouched: folders,
      diversityScore: totalFilesInRepo > 0
        ? Math.min(1, files / totalFilesInRepo)
        : 0,
      prsOpened: prsOpenedBy.get(c.id) ?? 0,
      prsReviewed: reviewed,
      reviewComments: Math.round(comments),
      reviewScore: (reviewed + comments * 0.2) / totalReviewActions,
      initiativeScore: (prsOpenedBy.get(c.id) ?? 0) / totalPrs,
    };
  });
}
