"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { TimelinePoint } from "@/lib/analysis/types";
import type { UnifiedContributor } from "@/lib/analysis/identityUnification";

/**
 * Stacked area chart of commits per contributor over time.
 * x = ISO week; soft fills, no strokes between layers.
 */
export function ContributionTimeline({
  data,
  contributors,
  colourMap,
}: {
  data: TimelinePoint[];
  contributors: UnifiedContributor[];
  colourMap: Map<string, string>;
}) {
  const humans = contributors.filter((c) => !c.isBot);
  // Sort by commit count descending so largest area is at bottom
  const sorted = [...humans].sort(
    (a, b) => b.commitKeys.length - a.commitKeys.length,
  );

  const textAlt = sorted
    .map((c) => `${c.displayName}: ${c.commitKeys.length} commits`)
    .join("\n");

  return (
    <ChartCard
      title="Contribution Timeline"
      sourceNote="Commits per week per contributor"
      textAlternative={textAlt}
      span={12}
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-muted, #F2F2EC)"
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #6B6B66)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border, #E5E5E0)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #6B6B66)" }}
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
          {sorted.map((c, i) => (
            <Area
              key={c.id}
              type="monotone"
              dataKey={c.id}
              name={c.displayName}
              stackId="1"
              fill={colourMap.get(c.id) ?? CHART_PALETTE[i % CHART_PALETTE.length]}
              fillOpacity={0.7}
              stroke="none"
              animationDuration={300}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
