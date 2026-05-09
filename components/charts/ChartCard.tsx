"use client";

import type { ReactNode } from "react";

/**
 * Shared wrapper for every chart on the dashboard.
 *
 * Provides: surface card, title, source note, optional text
 * alternative in a `<details>` block. Styling per DESIGN_SYSTEM.md:
 * rounded-2xl, 1px border, p-6, no shadows.
 */
export function ChartCard({
  title,
  sourceNote,
  textAlternative,
  span = 6,
  children,
}: {
  title: string;
  sourceNote?: string;
  textAlternative?: string;
  /** Grid column span: 6, 8, or 12. */
  span?: 6 | 8 | 12;
  children: ReactNode;
}) {
  const colClass =
    span === 12
      ? "col-span-12"
      : span === 8
        ? "col-span-12 lg:col-span-8"
        : "col-span-12 lg:col-span-6";

  return (
    <div
      className={`${colClass} rounded-2xl border border-border bg-card p-6`}
    >
      <h3 className="text-lg font-semibold font-sans">{title}</h3>
      <div className="mt-4 w-full">{children}</div>
      {sourceNote && (
        <p className="mt-3 text-xs text-muted-foreground italic">
          {sourceNote}
        </p>
      )}
      {textAlternative && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Text alternative
          </summary>
          <p className="mt-2 text-muted-foreground whitespace-pre-line">
            {textAlternative}
          </p>
        </details>
      )}
    </div>
  );
}
