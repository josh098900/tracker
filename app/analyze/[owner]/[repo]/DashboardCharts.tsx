"use client";

import { useMemo } from "react";
import { ContributionTimeline } from "@/components/charts/ContributionTimeline";
import { ContributionBreakdown } from "@/components/charts/ContributionBreakdown";
import { FileOwnershipTreemap } from "@/components/charts/FileOwnershipTreemap";
import { FairnessRadar } from "@/components/charts/FairnessRadar";
import { CommitHeatmap } from "@/components/charts/CommitHeatmap";
import { ChurnChart } from "@/components/charts/ChurnChart";
import { CoAuthorshipGraph } from "@/components/charts/CoAuthorshipGraph";
import { ConsistencyTimeline } from "@/components/charts/ConsistencyTimeline";
import type { FullAnalysisPayload } from "@/lib/analysis/types";

/**
 * Client component that renders all 8 charts. The server page passes
 * the full payload as serialised JSON to avoid passing non-serialisable
 * types across the server/client boundary.
 */
export function DashboardCharts({
  payload,
  colourMap: colourMapObj,
}: {
  payload: FullAnalysisPayload;
  colourMap: Record<string, string>;
}) {
  const colourMap = useMemo(
    () => new Map(Object.entries(colourMapObj)),
    [colourMapObj],
  );

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl">Visualisations</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {payload.totals.commits} commits across{" "}
        {payload.totals.humanContributors} contributors. All charts use
        consistent colours per contributor.
      </p>

      <div className="mt-6 grid grid-cols-12 gap-4">
        {/* 1. Contribution Timeline — full width */}
        <ContributionTimeline
          data={payload.timeline}
          contributors={payload.contributors}
          colourMap={colourMap}
        />

        {/* 2. Contribution Breakdown (donut) — half width */}
        <ContributionBreakdown
          contributors={payload.contributors}
          colourMap={colourMap}
        />

        {/* 3. Fairness Radar — half width */}
        <FairnessRadar
          contributors={payload.contributors}
          metrics={payload.metrics}
          consistency={payload.consistency}
          ownershipShares={payload.ownershipShares}
          colourMap={colourMap}
        />

        {/* 4. File Ownership Treemap — full width */}
        <FileOwnershipTreemap
          ownership={payload.fileOwnership}
          contributors={payload.contributors}
          colourMap={colourMap}
        />

        {/* 5. Commit Heatmap — 8 cols */}
        <CommitHeatmap
          heatmap={payload.heatmap}
          contributors={payload.contributors}
          colourMap={colourMap}
        />

        {/* 6. Co-authorship Graph — 6 cols (wraps below heatmap or next to it on small screens) */}
        <CoAuthorshipGraph
          graph={payload.coAuthorship}
          colourMap={colourMap}
        />

        {/* 7. Code Churn — full width */}
        <ChurnChart data={payload.churn} />

        {/* 8. Consistency Timeline — full width */}
        <ConsistencyTimeline
          contributors={payload.contributors}
          consistency={payload.consistency}
          colourMap={colourMap}
        />
      </div>
    </section>
  );
}
