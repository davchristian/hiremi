"use client";

import type { ClientJob } from "@/lib/types";
import type { Stage } from "@/lib/stage";
import { STAGE_CONFIG } from "@/lib/stage";
import { JobCard } from "@/components/JobCard";

export function Column({
  stage,
  jobs,
  onOpenJob,
}: {
  stage: Stage;
  jobs: ClientJob[];
  onOpenJob: (id: string) => void;
}) {
  const config = STAGE_CONFIG[stage];

  return (
    <div className="flex h-full w-[280px] shrink-0 snap-start flex-col sm:w-[300px]">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted">
          {config.label}
        </span>
        <span className="font-mono text-xs text-text-dim">{jobs.length}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-hairline bg-panel p-2">
        {jobs.length === 0 ? (
          <p className="px-2 py-6 text-center font-mono text-xs text-text-dim">— empty —</p>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} onOpen={() => onOpenJob(job.id)} />)
        )}
      </div>
    </div>
  );
}
