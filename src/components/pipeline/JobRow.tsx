"use client";

import type { ClientJob } from "@/lib/types";
import { isFollowUpDue, isStale, STAGE_CONFIG, STAGE_ORDER, type Stage } from "@/lib/stage";
import { isPendingJob } from "@/lib/types";
import { daysAgo } from "@/lib/format";
import { StatusDot } from "@/components/hig/status";
import { PopUpButton } from "@/components/hig/popup-button";

export const STAGE_OPTIONS = STAGE_ORDER.map((stage) => ({
  value: stage,
  label: STAGE_CONFIG[stage].label,
  color: STAGE_CONFIG[stage].color,
}));

export function Badge({ tone, children }: { tone: "tint" | "warning"; children: React.ReactNode }) {
  return (
    <span
      className={
        tone === "tint"
          ? "rounded-[5px] bg-tint-soft px-1.5 py-px text-caption font-semibold text-tint"
          : "rounded-[5px] bg-warning-soft px-1.5 py-px text-caption font-semibold text-warning"
      }
    >
      {children}
    </span>
  );
}

export function JobRow({
  job,
  today,
  onOpen,
  onMove,
}: {
  job: ClientJob;
  today: string;
  onOpen: () => void;
  onMove: (stage: Stage) => void;
}) {
  const pending = isPendingJob(job);
  const followUp = isFollowUpDue(job, today);
  const stale = !followUp && isStale(job);
  const when = job.appliedDate ? `Applied ${daysAgo(job.appliedDate)}` : `Saved ${daysAgo(job.createdAt)}`;

  return (
    <li className="group/row flex items-center gap-3 pl-4 transition-colors hover:bg-fill" aria-busy={pending || undefined}>
      <StatusDot color={STAGE_CONFIG[job.stage].color} className="desk:hidden" />
      <div className="flex min-w-0 flex-1 items-center gap-3 border-b border-separator py-2.5 pr-3 group-last/row:border-b-0">
        <button
          type="button"
          onClick={onOpen}
          disabled={pending}
          className="flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-50"
        >
          <span className="flex max-w-full items-center gap-2">
            <span className="truncate text-headline text-text">{job.company}</span>
            {followUp && <Badge tone="tint">Follow up</Badge>}
            {stale && <Badge tone="warning">No reply in 2 weeks</Badge>}
          </span>
          <span className="max-w-full truncate text-callout text-text-muted">{job.role}</span>
        </button>
        <span className="hidden shrink-0 text-footnote text-text-dim tabular min-[520px]:inline">{pending ? "Saving" : when}</span>
        <div className="hidden desk:block">
          <PopUpButton
            value={job.stage}
            options={STAGE_OPTIONS}
            onChange={onMove}
            label={`Stage for ${job.company}`}
            size="sm"
            variant="plain"
            disabled={pending}
            className="w-[124px]"
          />
        </div>
      </div>
    </li>
  );
}
