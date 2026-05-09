"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { UnifiedContributor } from "@/lib/analysis/identityUnification";

/**
 * Donut chart of overall contribution share (by commit count).
 * Inner radius 60%, labels outside.
 */
export function ContributionBreakdown({
  contributors,
  colourMap,
}: {
  contributors: UnifiedContributor[];
  colourMap: Map<string, string>;
}) {
  const humans = contributors.filter((c) => !c.isBot);
  const data = humans
    .map((c) => ({
      id: c.id,
      name: c.displayName,
      value: c.commitKeys.length,
    }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);
  const textAlt = data
    .map(
      (d) =>
        `${d.name}: ${d.value} commits (${Math.round((d.value / total) * 100)}%)`,
    )
    .join("\n");

  return (
    <ChartCard
      title="Contribution Breakdown"
      sourceNote="Share of total commits"
      textAlternative={textAlt}
      span={6}
    >
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            animationDuration={300}
            animationEasing="ease-out"
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.id}
                fill={
                  colourMap.get(entry.id) ??
                  CHART_PALETTE[i % CHART_PALETTE.length]
                }
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-border, #E5E5E0)",
              borderRadius: 8,
              fontSize: 13,
              padding: 12,
            }}
            formatter={(value) => {
              const v = Number(value);
              return [
                `${v} commits (${Math.round((v / total) * 100)}%)`,
                "",
              ];
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
