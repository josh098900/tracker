"use client";

import { useMemo } from "react";
import { Group } from "@visx/group";
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { OwnershipNode } from "@/lib/analysis/fileOwnership";
import type { UnifiedContributor } from "@/lib/analysis/identityUnification";

const WIDTH = 800;
const HEIGHT = 420;

/**
 * File ownership treemap. Folders sized by code volume, coloured by
 * primary owner. Squarified layout via d3-hierarchy.
 */
export function FileOwnershipTreemap({
  ownership,
  contributors,
  colourMap,
}: {
  ownership: OwnershipNode;
  contributors: UnifiedContributor[];
  colourMap: Map<string, string>;
}) {
  const humans = contributors.filter((c) => !c.isBot);

  const root = useMemo(() => {
    const h = hierarchy(ownership)
      .sum((d) => (d.children ? 0 : d.size))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<OwnershipNode>()
      .size([WIDTH, HEIGHT])
      .tile(treemapSquarify)
      .paddingInner(2)
      .paddingOuter(3)
      .round(true)(h);

    return h;
  }, [ownership]);

  const leaves = root.leaves() as HierarchyRectangularNode<OwnershipNode>[];

  if (leaves.length === 0 || (leaves.length === 1 && leaves[0].data.path === "")) {
    return (
      <ChartCard
        title="File Ownership Treemap"
        sourceNote="Sized by file size, coloured by last-touched author (MVP approximation)"
        textAlternative="No file ownership data available."
        span={12}
      >
        <div className="flex h-[420px] w-full flex-col items-center justify-center rounded-md border border-dashed text-center p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No files detected</p>
          <p className="mt-1">
            Could not fetch the repository file tree, or all files were excluded by the noise filter.
          </p>
        </div>
      </ChartCard>
    );
  }

  // Build text alternative
  const ownerCounts = new Map<string, number>();
  for (const leaf of leaves) {
    const owner = leaf.data.owner ?? "unattributed";
    ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);
  }
  const textAlt = humans
    .map((c) => `${c.displayName}: ${ownerCounts.get(c.id) ?? 0} files owned`)
    .join("\n");

  return (
    <ChartCard
      title="File Ownership Treemap"
      sourceNote="Sized by file size, coloured by last-touched author (MVP approximation)"
      textAlternative={textAlt}
      span={12}
    >
      <div className="overflow-x-auto">
        <svg
          width="100%"
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block"
        >
          <Group>
            {leaves.map((leaf) => {
              const x0 = leaf.x0 ?? 0;
              const y0 = leaf.y0 ?? 0;
              const x1 = leaf.x1 ?? 0;
              const y1 = leaf.y1 ?? 0;
              const w = x1 - x0;
              const h = y1 - y0;
              if (w < 1 || h < 1) return null;

              const colour = leaf.data.owner
                ? colourMap.get(leaf.data.owner) ?? CHART_PALETTE[0]
                : "var(--color-muted, #F2F2EC)";

              return (
                <g key={leaf.data.path}>
                  <rect
                    x={x0}
                    y={y0}
                    width={w}
                    height={h}
                    fill={colour}
                    opacity={0.75}
                    rx={2}
                  >
                    <title>
                      {leaf.data.path}
                      {leaf.data.owner
                        ? ` — owned by ${humans.find((c) => c.id === leaf.data.owner)?.displayName ?? leaf.data.owner}`
                        : ""}
                      {` (${formatSize(leaf.data.size)})`}
                    </title>
                  </rect>
                  {w > 40 && h > 14 && (
                    <text
                      x={x0 + 4}
                      y={y0 + 12}
                      fontSize={10}
                      fill="#fff"
                      style={{
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        pointerEvents: "none",
                      }}
                    >
                      {leaf.data.name}
                    </text>
                  )}
                </g>
              );
            })}
          </Group>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {humans.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{
                backgroundColor:
                  colourMap.get(c.id) ??
                  CHART_PALETTE[i % CHART_PALETTE.length],
              }}
            />
            {c.displayName}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
