"use client";

import { useMemo } from "react";
import type { ClientJob } from "@/lib/types";
import { startOfWeek } from "@/lib/format";

const SPARK_WEEKS = 8;
const SPARK_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Stat({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 font-mono text-sm">
      <span className={colorClass ?? "text-text"}>{value}</span>
      <span className="text-text-muted">{label}</span>
    </div>
  );
}

/** Applications per week for the last SPARK_WEEKS weeks, oldest first. */
function weeklyCounts(jobs: ClientJob[]): number[] {
  const counts = new Array<number>(SPARK_WEEKS).fill(0);
  const currentWeek = startOfWeek(new Date()).getTime();
  for (const job of jobs) {
    if (!job.appliedDate) continue;
    const week = startOfWeek(new Date(job.appliedDate)).getTime();
    const weeksBack = Math.round((currentWeek - week) / WEEK_MS);
    if (weeksBack >= 0 && weeksBack < SPARK_WEEKS) {
      counts[SPARK_WEEKS - 1 - weeksBack] += 1;
    }
  }
  return counts;
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

  const weeks = useMemo(() => weeklyCounts(jobs), [jobs]);
  const max = Math.max(...weeks, 1);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-panel px-4 py-3 sm:gap-x-6 sm:px-6">
      <span className="hidden font-mono text-xs text-text-dim sm:inline">$ stats --summary</span>
      <Stat label="total" value={stats.total} />
      <Stat label="active" value={stats.active} colorClass="text-applied" />
      <Stat label="offers" value={stats.offers} colorClass="text-offer" />
      <Stat label="this week" value={stats.thisWeek} colorClass="text-interview" />

      <div
        className="ml-auto hidden items-center gap-2 sm:flex"
        title={`applications per week, last ${SPARK_WEEKS} weeks (oldest → newest)`}
        aria-label={`applications per week, last ${SPARK_WEEKS} weeks: ${weeks.join(", ")}`}
      >
        <span aria-hidden className="font-mono text-sm leading-none tracking-[0.1em]">
          {weeks.map((count, i) => (
            <span key={i} className={count === 0 ? "text-text-dim" : "text-applied"}>
              {count === 0
                ? SPARK_GLYPHS[0]
                : SPARK_GLYPHS[Math.min(7, Math.max(1, Math.round((count / max) * 7)))]}
            </span>
          ))}
        </span>
        <span className="font-mono text-xs text-text-dim">{SPARK_WEEKS}w</span>
      </div>
    </div>
  );
}
