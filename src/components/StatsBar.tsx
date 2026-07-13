"use client";

import { useMemo } from "react";
import type { ClientJob } from "@/lib/types";
import { startOfWeek } from "@/lib/format";

function Stat({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 font-mono text-sm">
      <span className={colorClass ?? "text-text"}>{value}</span>
      <span className="text-text-muted">{label}</span>
    </div>
  );
}

export function StatsBar({ jobs }: { jobs: ClientJob[] }) {
  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return {
      total: jobs.length,
      active: jobs.filter((j) => j.stage === "applied" || j.stage === "interview").length,
      offers: jobs.filter((j) => j.stage === "offer").length,
      thisWeek: jobs.filter((j) => j.appliedDate && new Date(j.appliedDate) >= weekStart).length,
    };
  }, [jobs]);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-hairline bg-panel px-4 py-3 sm:px-6">
      <span className="font-mono text-xs text-text-dim">$ stats --summary</span>
      <Stat label="total" value={stats.total} />
      <Stat label="active" value={stats.active} colorClass="text-applied" />
      <Stat label="offers" value={stats.offers} colorClass="text-offer" />
      <Stat label="this week" value={stats.thisWeek} colorClass="text-interview" />
    </div>
  );
}
