"use client";

import * as React from "react";
import { PhaseGroupedTable } from "./phase-grouped-table";
import { ViewToggle } from "./view-toggle";
import type { EngagementRow } from "@/lib/derive";

interface EngagementsListProps {
  rows: EngagementRow[];
}

/**
 * Top-level client wrapper for /engagements list.
 * Owns the grouped/flat view mode toggle state.
 */
export function EngagementsList({ rows }: EngagementsListProps) {
  const [viewMode, setViewMode] = React.useState<"grouped" | "flat">("grouped");

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      <PhaseGroupedTable rows={rows} viewMode={viewMode} />
    </div>
  );
}
