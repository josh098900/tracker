"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { HeatmapData } from "@/lib/analysis/types";
import type { UnifiedContributor } from "@/lib/analysis/identityUnification";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CELL_SIZE = 18;
const GAP = 2;
const LABEL_W = 32;
const HEADER_H = 20;

/**
 * Day-of-week × hour-of-day commit heatmap. Toggle between contributors.
 * Using a plain SVG (not visx HeatmapRect) for simplicity and bundle size.
 */
export function CommitHeatmap({
  heatmap,
  contributors,
  colourMap,
}: {
  heatmap: HeatmapData[];
  contributors: UnifiedContributor[];
  colourMap: Map<string, string>;
}) {
  const humans = contributors.filter((c) => !c.isBot);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Aggregate or per-contributor
  const activeData = useMemo(() => {
    if (selectedId) {
      return heatmap.find((h) => h.contributorId === selectedId) ?? null;
    }
    // Aggregate all contributors
    const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
    let max = 0;
    for (const h of heatmap) {
      for (let d = 0; d < 7; d++) {
        for (let hr = 0; hr < 24; hr++) {
          grid[d][hr] += h.grid[d][hr];
          if (grid[d][hr] > max) max = grid[d][hr];
        }
      }
    }
    return { contributorId: "__all__", grid, max: Math.max(1, max) };
  }, [heatmap, selectedId]);

  if (!activeData) return null;

  const baseColour = selectedId
    ? colourMap.get(selectedId) ?? CHART_PALETTE[0]
    : CHART_PALETTE[0];

  const width = LABEL_W + 24 * (CELL_SIZE + GAP);
  const height = HEADER_H + 7 * (CELL_SIZE + GAP);

  const textAlt = DAYS.map((day, d) => {
    const hourCounts = activeData.grid[d]
      .map((v, h) => (v > 0 ? `${h}:00 (${v})` : null))
      .filter(Boolean)
      .join(", ");
    return `${day}: ${hourCounts || "no commits"}`;
  }).join("\n");

  return (
    <ChartCard
      title="Commit Heatmap"
      sourceNote="Commits by day and hour (UTC)"
      textAlternative={textAlt}
      span={8}
    >
      {/* Contributor toggle */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedId(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedId === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {humans.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedId === c.id
                ? "text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={
              selectedId === c.id
                ? {
                    backgroundColor:
                      colourMap.get(c.id) ??
                      CHART_PALETTE[i % CHART_PALETTE.length],
                  }
                : undefined
            }
          >
            {c.displayName}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
        >
          {/* Hour labels */}
          {Array.from({ length: 24 }, (_, h) => (
            <text
              key={`h-${h}`}
              x={LABEL_W + h * (CELL_SIZE + GAP) + CELL_SIZE / 2}
              y={HEADER_H - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-muted-foreground, #6B6B66)"
            >
              {h % 3 === 0 ? h : ""}
            </text>
          ))}
          {/* Day labels + cells */}
          {DAYS.map((day, d) => (
            <g key={day}>
              <text
                x={0}
                y={HEADER_H + d * (CELL_SIZE + GAP) + CELL_SIZE / 2 + 4}
                fontSize={10}
                fill="var(--color-muted-foreground, #6B6B66)"
              >
                {day}
              </text>
              {Array.from({ length: 24 }, (_, h) => {
                const value = activeData.grid[d][h];
                const intensity = value / activeData.max;
                return (
                  <rect
                    key={`${d}-${h}`}
                    x={LABEL_W + h * (CELL_SIZE + GAP)}
                    y={HEADER_H + d * (CELL_SIZE + GAP)}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={3}
                    fill={
                      value === 0
                        ? "var(--color-muted, #F2F2EC)"
                        : baseColour
                    }
                    opacity={value === 0 ? 1 : 0.15 + intensity * 0.85}
                  >
                    <title>{`${day} ${h}:00 — ${value} commit${value === 1 ? "" : "s"}`}</title>
                  </rect>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </ChartCard>
  );
}
