"use client";

import type { ClientJob } from "@/lib/types";
import type { Stage } from "@/lib/stage";
import { STAGE_CONFIG } from "@/lib/stage";
import { JobCard } from "@/components/JobCard";

export function Column({
  stage,
  jobs,
  filtered,
  onOpenJob,
  onMoveJob,
}: {
  stage: Stage;
  jobs: ClientJob[];
  filtered: boolean;
  onOpenJob: (id: string) => void;
  onMoveJob: (id: string, stage: Stage) => void;
}) {
  const config = STAGE_CONFIG[stage];

  return (
    <div className="flex h-full min-w-[224px] max-w-[460px] flex-1 basis-0 snap-start flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted">
          {config.label}
        </span>
        <span className="font-mono text-xs text-text-dim">{jobs.length}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-hairline bg-panel p-2">
        {jobs.length === 0 ? (
          <p className="px-2 py-6 text-center font-mono text-xs text-text-dim">
            {filtered ? "no matches" : config.emptyHint}
          </p>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onOpen={() => onOpenJob(job.id)}
              onMove={(next) => onMoveJob(job.id, next)}
            />
          ))
        )}
      </div>
    </div>
  );
}
