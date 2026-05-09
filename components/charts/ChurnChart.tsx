"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { ChurnPoint } from "@/lib/analysis/types";

/**
 * Code churn chart: bars for additions (green) and deletions (red),
 * with a line for net change. Recharts ComposedChart.
 */
export function ChurnChart({ data }: { data: ChurnPoint[] }) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Code Churn"
        sourceNote="Lines added and deleted per week"
        textAlternative="No code churn data available yet."
        span={12}
      >
        <div className="flex h-[280px] w-full flex-col items-center justify-center rounded-md border border-dashed text-center p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Data processing</p>
          <p className="mt-1">
            GitHub is currently computing this repository's code frequency
            statistics. Please check back in a few minutes.
          </p>
        </div>
      </ChartCard>
    );
  }

  const totalAdded = data.reduce((s, d) => s + d.additions, 0);
  const totalDeleted = data.reduce((s, d) => s + d.deletions, 0);

  const textAlt = `Total lines added: ${totalAdded.toLocaleString()}. Total lines deleted: ${totalDeleted.toLocaleString()}. Net: ${(totalAdded - totalDeleted).toLocaleString()} across ${data.length} weeks.`;

  return (
    <ChartCard
      title="Code Churn"
      sourceNote="Lines added and deleted per week"
      textAlternative={textAlt}
      span={12}
    >
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
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
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-border, #E5E5E0)",
              borderRadius: 8,
              fontSize: 13,
              padding: 12,
            }}
            formatter={(value, name) => [
              Number(value).toLocaleString(),
              String(name),
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="rect"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar
            dataKey="additions"
            name="Additions"
            fill="#2F7D4F"
            fillOpacity={0.8}
            radius={[2, 2, 0, 0]}
            animationDuration={300}
          />
          <Bar
            dataKey="deletions"
            name="Deletions"
            fill="#B33A3A"
            fillOpacity={0.8}
            radius={[2, 2, 0, 0]}
            animationDuration={300}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="#0F4C75"
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
