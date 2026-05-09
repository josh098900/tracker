/**
 * Consistency metrics — see docs/METRICS.md.
 *
 * Measures how regularly each contributor committed over the project's
 * lifetime. Higher score = contributed regularly, not in one or two
 * big bursts.
 *
 * Formula:
 *   consistency_score = coverage × (1 − clamp(cv / 2, 0, 1))
 *
 * Where:
 *   coverage = active_weeks / total_weeks
 *   cv       = coefficient of variation of weekly commit counts
 */

import type { CommitRecord } from "@/lib/github/types";
import type { UnifiedContributor } from "./identityUnification";

export type ConsistencyMetrics = {
  id: string;
  /** ISO weeks containing at least one commit. */
  activeWeeks: number;
  /** Total ISO weeks between first and last commit in the repo. */
  totalWeeks: number;
  /** `activeWeeks / totalWeeks`. */
  coverage: number;
  /** Coefficient of variation of weekly commit counts. */
  cv: number;
  /** `coverage × (1 − clamp(cv / 2, 0, 1))`. */
  consistencyScore: number;
  /** Weekly commit counts for the consistency timeline chart. */
  weeklyCommits: Array<{ week: string; commits: number }>;
};

/**
 * Get the ISO week key (YYYY-Www) for a timestamp.
 */
function isoWeekKey(date: Date): string {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  // Set to nearest Thursday (ISO week definition)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Generate all ISO week keys between two dates (inclusive).
 */
function allWeeksBetween(start: Date, end: Date): string[] {
  const weeks: string[] = [];
  const current = new Date(start.getTime());
  // Move to Monday
  current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
  current.setUTCHours(0, 0, 0, 0);

  const endTime = end.getTime();
  while (current.getTime() <= endTime) {
    weeks.push(isoWeekKey(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return weeks;
}

/**
 * Compute consistency metrics for all human contributors.
 */
export function computeConsistency(
  contributors: UnifiedContributor[],
  commits: CommitRecord[],
): ConsistencyMetrics[] {
  if (commits.length === 0) return [];

  // Find repo-wide first and last commit dates
  const timestamps = commits
    .map((c) => new Date(c.authoredAt).getTime())
    .filter((t) => !isNaN(t));
  if (timestamps.length === 0) return [];

  const repoStart = new Date(Math.min(...timestamps));
  const repoEnd = new Date(Math.max(...timestamps));
  const allWeeks = allWeeksBetween(repoStart, repoEnd);
  const totalWeeks = Math.max(1, allWeeks.length);

  // Build commit-key → authoredAt lookup
  const commitDateMap = new Map<string, string>();
  for (const c of commits) {
    commitDateMap.set(c.sha, c.authoredAt);
  }

  return contributors.filter((c) => !c.isBot).map((contributor) => {
    // Count commits per week for this contributor
    const weekCounts = new Map<string, number>();
    for (const key of contributor.commitKeys) {
      const dateStr = commitDateMap.get(key);
      if (!dateStr) continue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;
      const week = isoWeekKey(date);
      weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    }

    const activeWeeks = weekCounts.size;
    const coverage = activeWeeks / totalWeeks;

    // CV = stddev / mean of weekly commit counts (over ALL weeks, not just active)
    const values = allWeeks.map((w) => weekCounts.get(w) ?? 0);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 0;

    const consistencyScore = coverage * (1 - Math.min(1, cv / 2));

    // Weekly data for the timeline chart
    const weeklyCommits = allWeeks.map((w) => ({
      week: w,
      commits: weekCounts.get(w) ?? 0,
    }));

    return {
      id: contributor.id,
      activeWeeks,
      totalWeeks,
      coverage,
      cv,
      consistencyScore,
      weeklyCommits,
    };
  });
}
