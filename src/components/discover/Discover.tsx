"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Compass, RotateCw, SlidersHorizontal } from "lucide-react";
import type { FeedMatch, FeedSort } from "@/lib/feed";
import type { Eligibility } from "@/lib/eligibility";
import { STATUS_ORDER } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { WATCHLIST } from "@/config/watchlist";
import { Button, IconButton } from "@/components/hig/button";
import { SegmentedControl } from "@/components/hig/controls";
import { SearchField } from "@/components/hig/fields";
import { EmptyState, GroupedRow, Notice } from "@/components/hig/layout";
import { percentileRanks } from "@/components/hig/match-ring";
import { PullDownMenu } from "@/components/hig/menu";
import { ActivityIndicator, IndeterminateProgress } from "@/components/hig/status";
import { useToast } from "@/components/hig/toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { PostingDetail } from "@/components/discover/PostingDetail";
import { PostingRow } from "@/components/discover/PostingRow";
import { STATUS_META } from "@/components/discover/meta";

type RefreshReport = {
  error?: string;
  sources?: { error?: string }[];
  listingsUpserted?: number;
  sourcesRemaining?: number;
};

type Filters = { remoteOnly: boolean; hideTracked: boolean; showExcluded: boolean };

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "match", label: "Match" },
  { value: "newest", label: "Newest" },
];

export function Discover({
  initialMatches,
  ranked,
  hasProfile,
  sourceCount,
}: {
  initialMatches: FeedMatch[];
  ranked: boolean;
  hasProfile: boolean;
  sourceCount: number;
}) {
  const toast = useToast();
  const [matches, setMatches] = useState(initialMatches);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FeedSort>("priority");
  const [filters, setFilters] = useState<Filters>({ remoteOnly: false, hideTracked: false, showExcluded: false });
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestId = useRef(0);

  const desktop = useMediaQuery("(min-width: 761px)");
  const ranks = useMemo(() => percentileRanks(matches), [matches]);
  const visibleSelected = matches.find((match) => match.id === selectedId) ?? (desktop ? (matches[0] ?? null) : null);

  const params = useMemo(() => {
    const next = new URLSearchParams({ sort, limit: "100" });
    if (query.trim()) next.set("q", query.trim());
    if (filters.remoteOnly) next.set("remote", "1");
    if (filters.hideTracked) next.set("hideTracked", "1");
    if (filters.showExcluded) next.set("excluded", "1");
    return next.toString();
  }, [sort, query, filters]);
  const loadedParams = useRef(params);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    loadedParams.current = params;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) throw new Error("request failed");
      const body = (await res.json()) as { matches: FeedMatch[] };
      if (id === requestId.current) {
        setMatches(body.matches);
        setLoadFailed(false);
      }
    } catch {
      if (id !== requestId.current) return;
      if (matches.length > 0) {
        toast({ tone: "error", message: "Couldn't update the list. Showing the last results." });
      } else {
        setLoadFailed(true);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [params, matches.length, toast]);

  useEffect(() => {
    if (params === loadedParams.current) return;
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, params, query]);

  const sections = useMemo(() => {
    if (sort !== "priority") return [{ status: null as Eligibility | null, items: matches }];
    return STATUS_ORDER.map((status) => ({ status, items: matches.filter((match) => match.status === status) })).filter(
      (section) => section.items.length > 0,
    );
  }, [matches, sort]);

  function patchMatch(id: string, patch: Partial<FeedMatch>) {
    setMatches((current) => current.map((match) => (match.id === id ? { ...match, ...patch } : match)));
  }

  async function addToPipeline(match: FeedMatch) {
    setBusyId(match.id);
    try {
      const res = await fetch("/api/feed/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: [match.id] }),
      });
      if (!res.ok) throw new Error("request failed");
      const body = (await res.json()) as { jobs: { id: string }[] };
      patchMatch(match.id, { trackedJobId: body.jobs[0]?.id ?? "added" });
      toast({ message: `Added ${match.company} to your Wishlist` });
    } catch {
      toast({ tone: "error", message: "Couldn't add it to your pipeline. Try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function review(match: FeedMatch, change: { status?: Eligibility | null; approved?: boolean }) {
    setBusyId(match.id);
    const before = match;
    if (change.status !== undefined) {
      patchMatch(match.id, change.status ? { status: change.status, statusLabel: STATUS_META[change.status].label, overridden: true, reason: "You changed this status", quote: null } : {});
    }
    if (change.approved !== undefined) patchMatch(match.id, { approved: change.approved });
    try {
      const res = await fetch(`/api/listings/${match.id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (!res.ok) throw new Error("request failed");
      if (change.status === null) await load();
    } catch {
      patchMatch(match.id, before);
      toast({ tone: "error", message: "Couldn't save that change. Try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const report = (await res.json().catch(() => ({}))) as RefreshReport;
      if (!res.ok) {
        toast({ tone: res.status === 429 ? "neutral" : "error", message: report.error ?? "Couldn't refresh. Try again later." });
        return;
      }
      const checked = report.sources?.length ?? 0;
      const failed = report.sources?.filter((source) => source.error).length ?? 0;
      const remaining = report.sourcesRemaining ?? 0;
      const parts = [`Checked ${checked} ${checked === 1 ? "board" : "boards"}`];
      if (failed) parts.push(`${failed} failed`);
      if (remaining) parts.push(`${remaining} more over the next few hours`);
      toast({ tone: failed ? "error" : "neutral", message: `${parts.join(", ")}.` });
      await load();
    } catch {
      toast({ tone: "error", message: "Couldn't reach the server to refresh." });
    } finally {
      setRefreshing(false);
    }
  }

  const filterCount = Number(filters.remoteOnly) + Number(filters.hideTracked) + Number(filters.showExcluded);
  const eligibleCount = matches.filter((match) => match.status !== "excluded" && match.status !== "check_manually").length;
  const filtering = query.trim().length > 0 || filterCount > 0;

  return (
    <div className="flex min-h-dvh flex-col desk:h-dvh">
      <header className={cn("flex shrink-0 flex-col gap-3 border-b border-separator px-4 pb-3 pt-6 desk:px-6", visibleSelected && "max-desk:hidden")}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-large-title text-text">Discover</h1>
            <p className="text-callout text-text-muted tabular">
              {matches.length === 0 ? "Software internships you can take from Indonesia" : `${eligibleCount} you can take, ${matches.length} shown`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={query} onChange={setQuery} label="Search postings" placeholder="Search" className="w-full min-[480px]:w-52" />
            <SegmentedControl label="Sort by" value={sort} onChange={setSort} options={SORTS} />
            <PullDownMenu
              title="Show"
              trigger={
                <button
                  type="button"
                  aria-label={filterCount ? `Filters, ${filterCount} on` : "Filters"}
                  className={cn(
                    "relative inline-flex size-8 items-center justify-center rounded-control transition-[background-color,transform] active:scale-[0.97] data-popup-open:bg-fill-strong",
                    filterCount ? "bg-tint-soft text-tint" : "text-text-muted hover:bg-fill hover:text-text",
                  )}
                >
                  <SlidersHorizontal className="size-4" strokeWidth={2} />
                </button>
              }
              toggles={[
                { label: "Remote only", checked: filters.remoteOnly, onChange: (remoteOnly) => setFilters((f) => ({ ...f, remoteOnly })) },
                { label: "Hide ones in my pipeline", checked: filters.hideTracked, onChange: (hideTracked) => setFilters((f) => ({ ...f, hideTracked })) },
                { label: "Include not eligible", checked: filters.showExcluded, onChange: (showExcluded) => setFilters((f) => ({ ...f, showExcluded })) },
              ]}
            />
            <IconButton
              label={refreshing ? "Refreshing" : "Refresh now"}
              icon={refreshing ? <ActivityIndicator size={15} label="Refreshing" /> : <RotateCw />}
              onClick={refresh}
              disabled={refreshing}
            />
          </div>
        </div>
        {refreshing && (
          <div className="flex flex-col gap-1.5">
            <IndeterminateProgress label="Checking job boards" />
            <p className="text-footnote text-text-muted">
              Checking job boards for new internships and closing ones that were taken down. This can take up to a minute.
            </p>
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] desk:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
        <div className={cn("min-h-0 overflow-y-auto border-separator desk:border-r", visibleSelected && "max-desk:hidden")}>
          {!hasProfile && (
            <Notice
              className="m-3"
              title="Add your profile to rank by match"
              action={
                <Link href="/profile" className="text-callout font-medium text-tint hover:underline">
                  Set up
                </Link>
              }
            >
              Your target roles and skills power the match ring.
            </Notice>
          )}

          {loadFailed ? (
            <EmptyState
              icon={<Compass />}
              title="Couldn't load postings"
              action={
                <Button variant="accent" onClick={load}>
                  Try again
                </Button>
              }
            >
              The server didn&apos;t respond. Check your connection and try again.
            </EmptyState>
          ) : matches.length === 0 ? (
            sourceCount === 0 ? (
              <EmptyState icon={<Compass />} title="No job boards yet" action={<Link href="/sources" className="text-body font-medium text-tint hover:underline">Add a board</Link>}>
                Add a company&apos;s job board in Sources, then refresh to find internships.
              </EmptyState>
            ) : filtering ? (
              <EmptyState icon={<Compass />} title="No matches">
                Nothing fits these filters. Clear the search or turn a filter off.
              </EmptyState>
            ) : (
              <EmptyState
                icon={<Compass />}
                title="Nothing to show yet"
                action={
                  <Button variant="accent" onClick={refresh} disabled={refreshing}>
                    Refresh now
                  </Button>
                }
              >
                Boards are checked every 3 days. Refresh to check them now.
              </EmptyState>
            )
          ) : (
            <div className={cn("flex flex-col gap-4 py-3 transition-opacity", loading && "opacity-60")}>
              {sections.map((section) => (
                <section key={section.status ?? "all"} className="flex flex-col gap-1">
                  {section.status && (
                    <h2 className="flex items-baseline gap-1.5 px-4 text-footnote font-semibold text-text-dim">
                      {STATUS_META[section.status].section}
                      <span className="font-normal tabular">{section.items.length}</span>
                    </h2>
                  )}
                  <ul className="mx-2 overflow-hidden rounded-group bg-panel">
                    {section.items.map((match) => (
                      <PostingRow
                        key={match.id}
                        match={match}
                        rank={ranks.get(match.id)}
                        ranked={ranked}
                        selected={match.id === visibleSelected?.id}
                        showStatus={sort !== "priority"}
                        onSelect={() => {
                          setSelectedId(match.id);
                          if (!desktop) window.scrollTo({ top: 0 });
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <details className="group mx-2 mb-6 mt-2">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-group px-2 py-2 text-footnote font-semibold text-text-dim hover:text-text-muted">
              Check by hand
              <span className="font-normal">Career sites without a public feed</span>
            </summary>
            <div className="overflow-hidden rounded-group bg-panel">
              {WATCHLIST.map((entry) => (
                <GroupedRow
                  key={entry.company}
                  label={entry.company}
                  detail={entry.note}
                  href={entry.url}
                  external
                  trailing={<ArrowUpRight className="size-4 text-text-dim" strokeWidth={2} />}
                />
              ))}
            </div>
          </details>
        </div>

        <div className={cn("min-h-0 overflow-y-auto", !visibleSelected && "max-desk:hidden")}>
          {visibleSelected ? (
            <PostingDetail
              key={visibleSelected.id}
              match={visibleSelected}
              rank={ranks.get(visibleSelected.id)}
              ranked={ranked}
              busy={busyId === visibleSelected.id}
              onBack={() => setSelectedId(null)}
              onAdd={() => addToPipeline(visibleSelected)}
              onReview={(change) => review(visibleSelected, change)}
            />
          ) : (
            <div className="hidden h-full items-center justify-center text-callout text-text-dim desk:flex">Select a posting to read it</div>
          )}
        </div>
      </div>
    </div>
  );
}
