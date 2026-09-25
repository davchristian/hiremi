"use client";

import type { ClientJob } from "@/lib/types";
import { STAGE_CONFIG, isStale, nextStage, previousStage, type Stage } from "@/lib/stage";
import { daysAgo, shortId } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function JobCard({
  job,
  onOpen,
  onMove,
}: {
  job: ClientJob;
  onOpen: () => void;
  onMove: (stage: Stage) => void;
}) {
  const config = STAGE_CONFIG[job.stage];
  const age = daysAgo(job.appliedDate ?? job.createdAt);
  const stale = isStale(job);
  const back = previousStage(job.stage);
  const forward = nextStage(job.stage);

  return (
    <div
      className={`group relative rounded-sm border-l-4 bg-panel-alt transition duration-150 hover:-translate-y-0.5 hover:bg-hairline/40 hover:shadow-lg hover:shadow-black/40 hover:ring-1 hover:ring-hairline focus-within:-translate-y-0.5 focus-within:bg-hairline/40 focus-within:shadow-lg focus-within:shadow-black/40 focus-within:ring-1 focus-within:ring-hairline ${config.borderClass}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-1 px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-applied"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-text-dim">{shortId(job.id)}</span>
          <span className="flex items-center gap-1.5 font-mono text-xs transition-opacity pointer-fine:group-hover:opacity-0 pointer-fine:group-focus-within:opacity-0">
            {stale && (
              <Badge className="h-4 bg-interview/15 px-1 font-mono text-[10px] uppercase tracking-wide text-interview">
                stale
              </Badge>
            )}
            {job.link && (
              <span aria-hidden className="text-text-dim">
                ↗
              </span>
            )}
            <span className="text-text-muted">{age}</span>
          </span>
        </div>
        <span className="truncate font-mono text-sm font-medium text-text">{job.company}</span>
        <span className="truncate text-xs text-text-muted">{job.role}</span>
      </button>

      {/* Quick stage-move: an always-visible footer row on touch devices,
          a hover/focus-revealed overlay on mouse devices */}
      <div className="flex justify-end gap-1.5 px-2 pb-2 pointer-fine:absolute pointer-fine:right-2 pointer-fine:top-2 pointer-fine:p-0 pointer-fine:gap-1 pointer-fine:opacity-0 pointer-fine:pointer-events-none pointer-fine:transition-opacity pointer-fine:group-hover:opacity-100 pointer-fine:group-hover:pointer-events-auto pointer-fine:group-focus-within:opacity-100 pointer-fine:group-focus-within:pointer-events-auto">
        {back && (
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`move back to ${STAGE_CONFIG[back].label}`}
            title={`move back to ${STAGE_CONFIG[back].label}`}
            onClick={() => onMove(back)}
            className="size-8 bg-panel font-mono text-xs text-text-muted pointer-fine:size-6 pointer-fine:text-[11px]"
          >
            ←
          </Button>
        )}
        {forward && (
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`move forward to ${STAGE_CONFIG[forward].label}`}
            title={`move forward to ${STAGE_CONFIG[forward].label}`}
            onClick={() => onMove(forward)}
            className="size-8 bg-panel font-mono text-xs text-text-muted pointer-fine:size-6 pointer-fine:text-[11px]"
          >
            →
          </Button>
        )}
        {(job.stage === "applied" || job.stage === "interview") && (
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="move to rejected"
            title="move to rejected"
            onClick={() => onMove("rejected")}
            className="size-8 bg-panel font-mono text-xs text-text-muted hover:border-rejected hover:bg-rejected/10 hover:text-rejected pointer-fine:size-6 pointer-fine:text-[11px]"
          >
            ✗
          </Button>
        )}
      </div>
    </div>
  );
}
