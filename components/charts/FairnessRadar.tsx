"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { ContributorMetrics } from "@/lib/analysis/contributorMetrics";
import type { ConsistencyMetrics } from "@/lib/analysis/consistency";
import type { UnifiedContributor } from "@/lib/analysis/identityUnification";

type RadarDimension =
  | "Volume"
  | "Diversity"
  | "Consistency"
  | "Review"
  | "Initiative"
  | "Ownership";

type RadarDataPoint = {
  dimension: RadarDimension;
  [contributorId: string]: number | string;
};

/**
 * Multi-dimensional per-contributor radar chart showing volume,
 * diversity, consistency, review, initiative, and ownership scores.
 * One polygon per contributor, 0.2 fill opacity.
 */
export function FairnessRadar({
  contributors,
  metrics,
  consistency,
  ownershipShares,
  colourMap,
}: {
  contributors: UnifiedContributor[];
  metrics: ContributorMetrics[];
  consistency: ConsistencyMetrics[];
  ownershipShares: Record<string, number>;
  colourMap: Map<string, string>;
}) {
  const humans = contributors.filter((c) => !c.isBot);
  const metricsMap = new Map(metrics.map((m) => [m.id, m]));
  const consistencyMap = new Map(consistency.map((c) => [c.id, c]));

  // Normalise each dimension to [0, 1] across all contributors
  const dimensions: RadarDimension[] = [
    "Volume",
    "Diversity",
    "Consistency",
    "Review",
    "Initiative",
    "Ownership",
  ];

  const getRaw = (id: string, dim: RadarDimension): number => {
    const m = metricsMap.get(id);
    const c = consistencyMap.get(id);
    switch (dim) {
      case "Volume":
        return m?.commitsShare ?? 0;
      case "Diversity":
        return m?.diversityScore ?? 0;
      case "Consistency":
        return c?.consistencyScore ?? 0;
      case "Review":
        return m?.reviewScore ?? 0;
      case "Initiative":
        return m?.initiativeScore ?? 0;
      case "Ownership":
        return ownershipShares[id] ?? 0;
    }
  };

  // For each dimension, find max across contributors for normalisation
  const maxPerDim = new Map<RadarDimension, number>();
  for (const dim of dimensions) {
    const max = Math.max(...humans.map((c) => getRaw(c.id, dim)), 0.01);
    maxPerDim.set(dim, max);
  }

  const data: RadarDataPoint[] = dimensions.map((dim) => {
    const point: RadarDataPoint = { dimension: dim };
    const maxVal = maxPerDim.get(dim) ?? 1;
    for (const c of humans) {
      point[c.id] = Math.round((getRaw(c.id, dim) / maxVal) * 100);
    }
    return point;
  });

  const sorted = [...humans].sort(
    (a, b) => b.commitKeys.length - a.commitKeys.length,
  );

  const textAlt = sorted
    .map((c) => {
      const parts = dimensions.map(
        (d) => `${d}: ${Math.round(((data.find((p) => p.dimension === d)?.[c.id] as number) ?? 0))}%`,
      );
      return `${c.displayName}: ${parts.join(", ")}`;
    })
    .join("\n");

  return (
    <ChartCard
      title="Fairness Radar"
      sourceNote="Relative scores normalised across contributors"
      textAlternative={textAlt}
      span={6}
    >
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="var(--color-border, #E5E5E0)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #6B6B66)" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #6B6B66)" }}
            tickCount={4}
          />
          {sorted.map((c, i) => (
            <Radar
              key={c.id}
              name={c.displayName}
              dataKey={c.id}
              fill={
                colourMap.get(c.id) ??
                CHART_PALETTE[i % CHART_PALETTE.length]
              }
              fillOpacity={0.2}
              stroke={
                colourMap.get(c.id) ??
                CHART_PALETTE[i % CHART_PALETTE.length]
              }
              strokeWidth={1.5}
              animationDuration={300}
              animationEasing="ease-out"
            />
          ))}
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
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
