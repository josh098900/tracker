"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { ConsistencyMetrics } from "@/lib/analysis/consistency";
import type { UnifiedContributor } from "@/lib/analysis/identityUnification";

/**
 * Per-contributor weekly contribution regularity. One line per
 * contributor showing commit count each ISO week.
 */
export function ConsistencyTimeline({
  contributors,
  consistency,
  colourMap,
}: {
  contributors: UnifiedContributor[];
  consistency: ConsistencyMetrics[];
  colourMap: Map<string, string>;
}) {
  const humans = contributors.filter((c) => !c.isBot);

  // Merge all contributors' weekly data into a single dataset
  const allWeeks = new Map<string, Record<string, number>>();
  for (const cm of consistency) {
    for (const wc of cm.weeklyCommits) {
      const entry = allWeeks.get(wc.week) ?? {};
      entry[cm.id] = wc.commits;
      allWeeks.set(wc.week, entry);
    }
  }

  const sortedWeeks = [...allWeeks.keys()].sort();
  const data = sortedWeeks.map((week) => ({
    week,
    ...allWeeks.get(week),
  }));

  const textAlt = humans
    .map((c) => {
      const cm = consistency.find((m) => m.id === c.id);
      return cm
        ? `${c.displayName}: ${cm.activeWeeks}/${cm.totalWeeks} active weeks, consistency ${(cm.consistencyScore * 100).toFixed(0)}%`
        : `${c.displayName}: no data`;
    })
    .join("\n");

  const sorted = [...humans].sort(
    (a, b) => b.commitKeys.length - a.commitKeys.length,
  );

  return (
    <ChartCard
      title="Consistency Timeline"
      sourceNote="Commits per week per contributor"
      textAlternative={textAlt}
      span={12}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-muted, #F2F2EC)"
          />
          <XAxis
            dataKey="week"
            tick={{
              fontSize: 11,
              fill: "var(--color-muted-foreground, #6B6B66)",
            }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border, #E5E5E0)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{
              fontSize: 11,
              fill: "var(--color-muted-foreground, #6B6B66)",
            }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border, #E5E5E0)" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-border, #E5E5E0)",
              borderRadius: 8,
              fontSize: 13,
              padding: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="line"
            iconSize={16}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          {sorted.map((c, i) => (
            <Line
              key={c.id}
              type="monotone"
              dataKey={c.id}
              name={c.displayName}
              stroke={
                colourMap.get(c.id) ??
                CHART_PALETTE[i % CHART_PALETTE.length]
              }
              strokeWidth={2}
              dot={false}
              animationDuration={300}
              animationEasing="ease-out"
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
