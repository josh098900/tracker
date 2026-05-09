/**
 * Categorical chart palette from docs/DESIGN_SYSTEM.md.
 *
 * Order is intentional — first colour goes to the contributor with the
 * most commits, and so on. The same contributor uses the same colour
 * across every chart on the dashboard.
 *
 * If a repo has more than 10 contributors, the extras are grouped
 * into an "Other" bucket using the last colour.
 */

export const CHART_PALETTE = [
  "#4E79A7", // blue
  "#F28E2B", // orange
  "#59A14F", // green
  "#E15759", // red
  "#B07AA1", // purple
  "#76B7B2", // teal
  "#EDC948", // yellow
  "#FF9DA7", // pink
  "#9C755F", // brown
  "#BAB0AC", // grey
] as const;

export const MAX_CONTRIBUTORS = CHART_PALETTE.length;

/**
 * Build a stable id → colour mapping. Contributors are sorted by commit
 * count (descending) before assigning colours so the ordering is
 * deterministic across charts.
 */
export function buildColourMap(
  contributors: Array<{ id: string; commitKeys: string[] }>,
): Map<string, string> {
  const sorted = [...contributors].sort(
    (a, b) => b.commitKeys.length - a.commitKeys.length,
  );
  const map = new Map<string, string>();
  sorted.forEach((c, i) => {
    map.set(c.id, CHART_PALETTE[Math.min(i, CHART_PALETTE.length - 1)]);
  });
  return map;
}
