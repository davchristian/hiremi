"use client";

import type { ClientJob } from "@/lib/types";
import { STAGE_CONFIG } from "@/lib/stage";
import { daysAgo, shortId } from "@/lib/format";

export function JobCard({ job, onOpen }: { job: ClientJob; onOpen: () => void }) {
  const config = STAGE_CONFIG[job.stage];
  const age = daysAgo(job.appliedDate ?? job.createdAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex w-full flex-col gap-1 rounded-sm border-l-4 bg-panel-alt px-3 py-2.5 text-left transition-colors hover:bg-hairline/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-applied ${config.borderClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-text-dim">{shortId(job.id)}</span>
        <span className="font-mono text-xs text-text-muted">{age}</span>
      </div>
      <span className="truncate font-mono text-sm font-medium text-text">{job.company}</span>
      <span className="truncate text-xs text-text-muted">{job.role}</span>
    </button>
  );
}
