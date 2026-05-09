"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { ChartCard } from "./ChartCard";
import { CHART_PALETTE } from "./palette";
import type { CoAuthorshipGraph } from "@/lib/analysis/types";

type NodeDatum = SimulationNodeDatum & {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  weight: number;
};

type LinkDatum = SimulationLinkDatum<NodeDatum> & {
  weight: number;
};

const WIDTH = 600;
const HEIGHT = 400;

/**
 * Force-directed co-authorship graph. Node size by PR/co-author count,
 * edge weight by collaboration strength.
 */
export function CoAuthorshipGraph({
  graph,
  colourMap,
}: {
  graph: CoAuthorshipGraph;
  colourMap: Map<string, string>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [links, setLinks] = useState<LinkDatum[]>([]);

  const initialNodes = useMemo<NodeDatum[]>(
    () =>
      graph.nodes.map((n, i) => {
        // Deterministic spread based on index — avoids Math.random() during render
        const angle = (i / Math.max(graph.nodes.length, 1)) * 2 * Math.PI;
        const radius = 60;
        return {
          id: n.id,
          displayName: n.displayName,
          avatarUrl: n.avatarUrl,
          weight: n.weight,
          x: WIDTH / 2 + Math.cos(angle) * radius,
          y: HEIGHT / 2 + Math.sin(angle) * radius,
        };
      }),
    [graph.nodes],
  );

  const initialLinks = useMemo<LinkDatum[]>(
    () =>
      graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })),
    [graph.edges],
  );

  useEffect(() => {
    const nodesCopy = initialNodes.map((n) => ({ ...n }));
    const linksCopy = initialLinks.map((l) => ({ ...l }));

    const sim = forceSimulation<NodeDatum>(nodesCopy)
      .force(
        "link",
        forceLink<NodeDatum, LinkDatum>(linksCopy)
          .id((d) => d.id)
          .distance(120)
          .strength((l) => 0.3 + (l.weight / 10) * 0.7),
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide(30));

    sim.on("tick", () => {
      setNodes([...nodesCopy]);
      setLinks([...linksCopy]);
    });

    sim.alpha(1).restart();

    return () => {
      sim.stop();
    };
  }, [initialNodes, initialLinks]);

  const hasEdges = graph.edges.length > 0;

  const textAlt = hasEdges
    ? graph.edges
        .map((e) => `${e.source} ↔ ${e.target}: ${e.weight} interaction${e.weight === 1 ? "" : "s"}`)
        .join("\n")
    : "No co-authorship or PR review relationships detected.";

  return (
    <ChartCard
      title="Co-authorship Graph"
      sourceNote="Based on co-authored-by trailers and PR reviews"
      textAlternative={textAlt}
      span={6}
    >
      {!hasEdges ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No co-authorship or review relationships detected.
          <br />
          This is common in repos without PRs or co-authored commits.
        </div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block"
        >
          {/* Edges */}
          {links.map((link, i) => {
            const source = link.source as NodeDatum;
            const target = link.target as NodeDatum;
            if (!source.x || !source.y || !target.x || !target.y) return null;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="var(--color-border, #E5E5E0)"
                strokeWidth={1 + link.weight}
                strokeOpacity={0.6}
              />
            );
          })}
          {/* Nodes */}
          {nodes.map((node, i) => {
            if (!node.x || !node.y) return null;
            const r = 12 + Math.min(node.weight, 10) * 2;
            const colour =
              colourMap.get(node.id) ??
              CHART_PALETTE[i % CHART_PALETTE.length];
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={colour}
                  opacity={0.85}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={node.x}
                  y={node.y + r + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--color-muted-foreground, #6B6B66)"
                >
                  {node.displayName}
                </text>
                <title>
                  {node.displayName}: {node.weight} collaboration{node.weight === 1 ? "" : "s"}
                </title>
              </g>
            );
          })}
        </svg>
      )}
    </ChartCard>
  );
}
