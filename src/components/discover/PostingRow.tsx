"use client";

import { forwardRef } from "react";
import type { FeedMatch } from "@/lib/feed";
import { cn } from "@/lib/utils";
import { MatchRing } from "@/components/hig/match-ring";
import { StatusDot } from "@/components/hig/status";
import { STATUS_META, shortDate } from "@/components/discover/meta";

export const PostingRow = forwardRef<
  HTMLButtonElement,
  { match: FeedMatch; rank: number | undefined; ranked: boolean; selected: boolean; showStatus: boolean; onSelect: () => void }
>(function PostingRow({ match, rank, ranked, selected, showStatus, onSelect }, ref) {
  const closes = match.deadline ? `Closes ${shortDate(match.deadline)}` : null;
  const meta = [match.season, closes].filter(Boolean).join(", ");

  return (
    <li className="group/row has-[+li>[aria-current]]:[&_[data-separator]]:border-transparent">
      <button
        ref={ref}
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 pl-3 pr-3 text-left transition-colors",
          selected ? "bg-selected" : "hover:bg-fill",
        )}
      >
        {ranked && (
          <span className="pt-3">
            <MatchRing value={rank ?? null} size={24} />
          </span>
        )}
        <span
          data-separator
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 wrap-anywhere border-b border-separator py-2.5 group-last/row:border-b-0",
            selected && "border-transparent",
          )}
        >
          <span className="line-clamp-2 text-headline text-text">{match.title}</span>
          <span className="truncate text-callout text-text-muted">
            {match.company}
            {match.location ? `, ${match.location}` : ""}
          </span>
          {(showStatus || meta || match.trackedJobId) && (
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-footnote text-text-dim">
              {showStatus && (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot color={STATUS_META[match.status].color} className="size-1.5" />
                  {STATUS_META[match.status].label}
                </span>
              )}
              {meta && <span className="tabular">{meta}</span>}
              {match.trackedJobId && <span className="font-medium text-tint">In Pipeline</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  );
});
