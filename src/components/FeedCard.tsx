"use client";

import { Badge } from "@/components/ui/badge";
import { daysAgo } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/source-meta";
import type { FeedMatch } from "@/lib/feed";

const BAR_SEGMENTS = 8;

function ScoreBar({ score }: { score: number }) {
  const filled = Math.min(BAR_SEGMENTS, Math.max(1, Math.round(score * BAR_SEGMENTS)));
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs" title={`${score.toFixed(3)} cosine similarity`}>
      <span aria-hidden className="tracking-[0.1em] text-offer">
        {"▓".repeat(filled)}
        <span className="text-text-dim">{"░".repeat(BAR_SEGMENTS - filled)}</span>
      </span>
      <span className="text-text-muted">{Math.round(score * 100)}%</span>
    </span>
  );
}

export function FeedCard({
  match,
  selected,
  onToggle,
}: {
  match: FeedMatch;
  selected: boolean;
  onToggle: () => void;
}) {
  const tracked = Boolean(match.trackedJobId);
  const inputId = `select-${match.id}`;

  return (
    <li
      className={`group relative rounded-sm border-l-4 transition duration-150 hover:bg-hairline/40 hover:ring-1 hover:ring-hairline focus-within:bg-hairline/40 focus-within:ring-1 focus-within:ring-hairline ${
        selected
          ? "border-applied bg-panel-alt"
          : match.indonesia
            ? "border-offer bg-offer/[0.04]"
            : "border-hairline bg-panel-alt"
      }`}
    >
      <div className="flex gap-3 px-3 py-3">
        <input
          id={inputId}
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={tracked}
          aria-label={`select ${match.title} at ${match.company}`}
          className="mt-1 size-4 shrink-0 accent-applied disabled:opacity-30"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {match.score !== null ? (
              <ScoreBar score={match.score} />
            ) : (
              <span className="font-mono text-xs text-text-dim">unranked</span>
            )}
            <span className="flex items-center gap-2 font-mono text-xs text-text-dim">
              <span>{SOURCE_LABELS[match.source]}</span>
              {match.postedAt && <span>{daysAgo(match.postedAt)}</span>}
            </span>
          </div>

          <label htmlFor={inputId} className="cursor-pointer">
            <span className="block truncate font-mono text-sm font-medium text-text">
              {match.company}
            </span>
            <span className="block truncate text-xs text-text-muted">{match.title}</span>
          </label>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-dim">
            <span className={match.indonesia ? "text-offer" : undefined}>
              {match.location || "—"}
            </span>
            {match.indonesia && (
              <Badge className="h-4 bg-offer/15 px-1 font-mono text-[10px] uppercase tracking-wide text-offer">
                indonesia
              </Badge>
            )}
            {match.remote && <span className="text-text-muted">remote</span>}
            {tracked && (
              <Badge className="h-4 bg-wishlist/15 px-1 font-mono text-[10px] uppercase tracking-wide text-wishlist">
                on board
              </Badge>
            )}
          </div>

          {match.matchedTerms.length > 0 && (
            <p className="font-mono text-[11px] text-text-muted">
              <span className="text-text-dim">matched:</span> {match.matchedTerms.join(", ")}
            </p>
          )}

          {match.snippet && (
            <p className="line-clamp-2 text-xs leading-relaxed text-text-muted">{match.snippet}</p>
          )}

          <a
            href={match.url}
            target="_blank"
            rel="noreferrer"
            className="w-fit font-mono text-xs text-applied hover:underline"
          >
            open posting ↗
          </a>
        </div>
      </div>
    </li>
  );
}
