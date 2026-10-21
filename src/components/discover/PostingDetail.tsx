"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronLeft, Clock, Landmark, Plus, RotateCcw } from "lucide-react";
import type { FeedMatch } from "@/lib/feed";
import type { Eligibility } from "@/lib/eligibility";
import { SOURCE_LABELS } from "@/lib/source-meta";
import { daysAgo } from "@/lib/format";
import { Button } from "@/components/hig/button";
import { GroupedRow, GroupedSection, Notice } from "@/components/hig/layout";
import { Markdown } from "@/components/hig/markdown";
import { MatchRing, matchPhrase } from "@/components/hig/match-ring";
import { PopUpButton } from "@/components/hig/popup-button";
import { ActivityIndicator } from "@/components/hig/status";
import { STATUS_META, STATUS_OPTIONS, WORKPLACE_LABELS, longDate } from "@/components/discover/meta";

type DescriptionState = { status: "loading" } | { status: "ready"; text: string } | { status: "error" };

const descriptions = new Map<string, string>();

export function primeDescriptions(entries: Record<string, string>) {
  for (const [id, text] of Object.entries(entries)) descriptions.set(id, text);
}

export function PostingDetail({
  match,
  rank,
  ranked,
  busy,
  onBack,
  onAdd,
  onReview,
}: {
  match: FeedMatch;
  rank: number | undefined;
  ranked: boolean;
  busy: boolean;
  onBack: () => void;
  onAdd: () => void;
  onReview: (change: { status?: Eligibility | null; approved?: boolean }) => void;
}) {
  const cached = descriptions.get(match.id);
  const [description, setDescription] = useState<DescriptionState>(
    cached !== undefined ? { status: "ready", text: cached } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (descriptions.has(match.id)) return;
    let cancelled = false;
    fetch(`/api/listings/${match.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("request failed");
        const { listing } = (await res.json()) as { listing: { description: string } };
        descriptions.set(match.id, listing.description);
        if (!cancelled) setDescription({ status: "ready", text: listing.description });
      })
      .catch(() => {
        if (!cancelled) setDescription({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [match.id, attempt]);

  const status = STATUS_META[match.status];
  const phrase = matchPhrase(rank);
  const himalayas = match.source === "himalayas";

  return (
    <article aria-labelledby="posting-title" className="flex min-w-0 flex-col gap-6 wrap-anywhere px-4 pb-10 pt-4 desk:px-8 desk:pt-6">
      <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-0.5 self-start text-body text-tint desk:hidden">
        <ChevronLeft className="size-5" strokeWidth={2.25} />
        Discover
      </button>

      <header className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-callout text-text-muted">{match.company}</p>
          <h2 id="posting-title" className="text-title text-text">
            {match.title}
          </h2>
          <p className="text-callout text-text-muted">{match.location || "Location not stated"}</p>
        </div>
        {ranked && rank !== undefined && <MatchRing value={rank} size={52} label={phrase ?? undefined} className="mt-1" />}
      </header>

      <div className="flex flex-wrap gap-2">
        {match.trackedJobId ? (
          <Link
            href="/board"
            className="inline-flex h-8 items-center gap-1.5 rounded-control bg-fill-strong px-3.5 text-body font-medium text-text transition-transform active:scale-[0.97]"
          >
            <Check className="size-4" strokeWidth={2.5} />
            In Pipeline
          </Link>
        ) : (
          <Button variant="accent" icon={<Plus strokeWidth={2.5} />} onClick={onAdd} disabled={busy}>
            Add to Pipeline
          </Button>
        )}
        <a
          href={match.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-control bg-fill-strong px-3.5 text-body font-medium text-text transition-transform hover:bg-fill-hover active:scale-[0.97]"
        >
          {himalayas ? "View on Himalayas" : "View posting"}
          <ArrowUpRight className="size-4" strokeWidth={2} />
        </a>
      </div>

      {(phrase || match.matchedTerms.length > 0) && (
        <section className="flex flex-col gap-2">
          <h3 className="text-headline text-text">Why it matches</h3>
          {phrase && <p className="text-callout text-text-muted">{phrase}, compared with your profile.</p>}
          {match.matchedTerms.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Profile terms found in this posting">
              {match.matchedTerms.map((term) => (
                <li key={term} className="rounded-[6px] bg-tint-soft px-2 py-0.5 text-callout text-text">
                  {term}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <GroupedSection header="Can you take it?">
        <GroupedRow
          label={match.reason ?? status.label}
          trailing={
            <PopUpButton
              value={match.status}
              options={STATUS_OPTIONS}
              onChange={(next) => onReview({ status: next })}
              label="Change status"
              size="sm"
              variant="plain"
              disabled={busy}
              className="w-auto"
            />
          }
        />
        {match.quote && match.quote !== match.location && (
          <div className="border-b border-separator py-3 pl-4 pr-4 last:border-b-0">
            <blockquote className="border-l-2 border-hairline pl-3 text-callout italic text-text-muted">&ldquo;{match.quote}&rdquo;</blockquote>
          </div>
        )}
        {match.status === "check_manually" && (
          <GroupedRow
            label={match.approved ? "You approved this posting" : "Approve it if you've checked it's open to you"}
            trailing={
              match.approved ? (
                <Button size="sm" variant="plain" onClick={() => onReview({ approved: false })} disabled={busy}>
                  Undo
                </Button>
              ) : (
                <Button size="sm" variant="accent" onClick={() => onReview({ approved: true })} disabled={busy}>
                  Approve
                </Button>
              )
            }
          />
        )}
        {match.overridden && (
          <GroupedRow
            label="You changed this status"
            trailing={
              <Button size="sm" variant="plain" icon={<RotateCcw />} onClick={() => onReview({ status: null })} disabled={busy}>
                Reset
              </Button>
            }
          />
        )}
      </GroupedSection>

      {match.workAuthorizationNote && (
        <Notice icon={<Landmark className="size-4 text-text-muted" strokeWidth={2} />} title="Work authorization">
          {match.workAuthorizationNote}
        </Notice>
      )}
      {match.overlapNote && (
        <Notice icon={<Clock className="size-4 text-text-muted" strokeWidth={2} />} title="Working hours">
          {match.overlapNote}
        </Notice>
      )}

      <GroupedSection header="Details">
        <GroupedRow label="Workplace" value={WORKPLACE_LABELS[match.workplace] ?? "Not stated"} />
        {match.duration && <GroupedRow label="Duration" value={match.duration} />}
        {match.season && <GroupedRow label="Season" value={match.season} />}
        <GroupedRow label="Deadline" value={match.deadline ? longDate(match.deadline) : "Not stated"} />
        {match.postedAt && <GroupedRow label="Posted" value={daysAgo(match.postedAt)} />}
        <GroupedRow
          label="Source"
          value={himalayas ? "Himalayas" : SOURCE_LABELS[match.source]}
          href={himalayas ? "https://himalayas.app" : undefined}
          external
        />
      </GroupedSection>

      <section className="flex flex-col gap-3">
        <h3 className="text-headline text-text">Description</h3>
        {description.status === "loading" && (
          <span className="flex items-center gap-2 text-callout text-text-muted">
            <ActivityIndicator size={14} label="Loading the description" />
            Loading the description
          </span>
        )}
        {description.status === "error" && (
          <Notice
            tone="error"
            title="Couldn't load the description"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setDescription({ status: "loading" });
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </Button>
            }
          >
            You can still read it on the original posting.
          </Notice>
        )}
        {description.status === "ready" &&
          (description.text ? (
            <Markdown source={description.text} />
          ) : (
            <p className="text-callout text-text-muted">This board didn&apos;t include a description. Open the posting to read it.</p>
          ))}
      </section>
    </article>
  );
}
