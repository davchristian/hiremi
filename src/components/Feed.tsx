"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedCard } from "@/components/FeedCard";
import { ProfileForm } from "@/components/ProfileForm";
import { SourceManager } from "@/components/SourceManager";
import type { FeedMatch } from "@/lib/feed";
import type { ClientProfile, ClientSource } from "@/lib/types";

type IngestResponse = {
  error?: string;
  sources?: { error?: string }[];
  embeddingSkipped?: string;
  embeddingError?: string;
};

export function Feed({
  initialMatches,
  initialProfile,
  initialSources,
  initialRanked,
}: {
  initialMatches: FeedMatch[];
  initialProfile: ClientProfile | null;
  initialSources: ClientSource[];
  initialRanked: boolean;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [profile, setProfile] = useState(initialProfile);
  const [sources, setSources] = useState(initialSources);
  const [ranked, setRanked] = useState(initialRanked);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [hideTracked, setHideTracked] = useState(true);
  const [indonesiaOnly, setIndonesiaOnly] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [managingSources, setManagingSources] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  function flash(message: string) {
    setBanner(message);
    setTimeout(() => setBanner((current) => (current === message ? null : current)), 5000);
  }

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (remoteOnly) params.set("remote", "1");
      if (hideTracked) params.set("hideTracked", "1");
      if (indonesiaOnly) params.set("indonesia", "1");

      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setMatches(data.matches);
      setRanked(data.ranked);
    } catch {
      flash("failed to load the feed");
    } finally {
      setLoading(false);
    }
  }, [query, remoteOnly, hideTracked, indonesiaOnly]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(reload, 250);
    return () => clearTimeout(timer);
  }, [reload]);

  async function reloadSources() {
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) return;
      const data = (await res.json()) as { sources: ClientSource[] };
      setSources(data.sources);
    } catch {}
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const report = (await res.json().catch(() => null)) as IngestResponse | null;
      if (!res.ok) throw new Error(report?.error ?? "ingest failed");

      const failed = report?.sources?.filter((source) => source.error).length ?? 0;
      const notices = [
        failed > 0
          ? `${failed} source${failed === 1 ? "" : "s"} failed — check job sources for details`
          : "",
        report?.embeddingSkipped ?? "",
        report?.embeddingError ? `embedding stopped early: ${report.embeddingError}` : "",
      ].filter(Boolean);
      if (notices.length > 0) flash(notices.join(" · "));
      await reload();
    } catch (error) {
      flash(error instanceof Error ? error.message : "refresh failed");
    } finally {
      setRefreshing(false);
      void reloadSources();
    }
  }

  async function handleAddSelected() {
    const listingIds = [...selected];
    if (listingIds.length === 0) return;

    const previous = matches;
    setMatches((prev) =>
      prev.map((match) =>
        selected.has(match.id) ? { ...match, trackedJobId: "pending" } : match,
      ),
    );
    setSelected(new Set());

    try {
      const res = await fetch("/api/feed/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds }),
      });
      if (!res.ok) throw new Error("request failed");
      const { added } = await res.json();
      flash(`added ${added} to the wishlist column`);
      if (hideTracked) await reload();
    } catch {
      setMatches(previous);
      flash("failed to add to board");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtering = Boolean(query.trim()) || remoteOnly || indonesiaOnly;
  const needsSources = sources.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-panel px-4 py-3 sm:gap-3 sm:px-6">
        <span className="hidden font-mono text-xs text-text-dim sm:inline">$ feed --ranked</span>
        <p className="font-mono text-xs text-text-dim">
          {matches.length} match{matches.length === 1 ? "" : "es"}
          {!ranked &&
            matches.length > 0 &&
            (profile ? " (by date — profile not embedded yet)" : " (by date — no profile yet)")}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManagingSources(true)}
            className="font-mono text-xs text-text-muted"
          >
            sources {sources.length > 0 && <span className="text-text-dim">{sources.length}</span>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingProfile(true)}
            className="font-mono text-xs text-text-muted"
          >
            profile
          </Button>
          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || needsSources}
            title={needsSources ? "add a job source first" : "fetch new listings now"}
            className="font-mono text-xs"
          >
            {refreshing ? "fetching..." : "refresh ⟳"}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="grep company or title"
          aria-label="filter listings"
          className="basis-full bg-panel font-mono text-xs sm:max-w-xs sm:basis-64"
        />
        <Toggle active={remoteOnly} onClick={() => setRemoteOnly((v) => !v)}>
          remote only
        </Toggle>
        <Toggle
          active={indonesiaOnly}
          accent="offer"
          onClick={() => setIndonesiaOnly((v) => !v)}
        >
          indonesia only
        </Toggle>
        <Toggle active={hideTracked} onClick={() => setHideTracked((v) => !v)}>
          hide tracked
        </Toggle>
        {loading && <span className="font-mono text-xs text-text-dim">loading…</span>}
      </div>

      {banner && (
        <div
          role="status"
          className="mx-4 mb-2 shrink-0 rounded border border-interview/40 bg-interview/10 px-3 py-2 font-mono text-xs text-interview sm:mx-6"
        >
          {banner}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 sm:px-6">
        {!profile && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded border border-hairline bg-panel px-3 py-2.5">
            <p className="text-xs leading-relaxed text-text-muted">
              <span className="font-mono text-text">no matching profile yet</span> — listings are
              sorted by date until you add the roles and skills to rank them against.
            </p>
            <Button size="sm" onClick={() => setEditingProfile(true)} className="font-mono text-xs">
              set up profile
            </Button>
          </div>
        )}

        {matches.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <FeedCard
                key={match.id}
                match={match}
                selected={selected.has(match.id)}
                onToggle={() => toggle(match.id)}
              />
            ))}
          </ul>
        ) : needsSources && !filtering ? (
          <EmptyState
            title="no job sources yet"
            body="Add a board to poll. Kalibrr covers Indonesia with no setup, as do RemoteOK and We Work Remotely for remote roles; Greenhouse, Lever, and Ashby need a company's board slug."
            action={
              <Button size="sm" onClick={() => setManagingSources(true)} className="font-mono text-xs">
                add a source
              </Button>
            }
          />
        ) : filtering ? (
          <EmptyState title="nothing to show" body="No listings match these filters." />
        ) : (
          <EmptyState
            title="nothing to show"
            body={
              hideTracked
                ? "No untracked listings yet. Fetch the latest from your sources."
                : "Sources are configured but no listings have been fetched yet."
            }
            action={
              <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="font-mono text-xs">
                fetch listings
              </Button>
            }
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-hairline bg-panel px-4 py-3 shadow-lg shadow-black/40 sm:px-6">
          <span className="font-mono text-xs text-text-muted">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="font-mono text-xs text-text-muted"
            >
              clear
            </Button>
            <Button size="sm" onClick={handleAddSelected} className="font-mono text-xs">
              add {selected.size} to wishlist
            </Button>
          </div>
        </div>
      )}

      {editingProfile && (
        <ProfileForm
          profile={profile}
          onClose={() => setEditingProfile(false)}
          onSaved={(saved) => {
            setProfile(saved);
            void reload();
          }}
        />
      )}

      {managingSources && (
        <SourceManager
          sources={sources}
          onClose={() => setManagingSources(false)}
          onChange={setSources}
        />
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  accent = "applied",
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: "applied" | "offer";
  children: React.ReactNode;
}) {
  const activeClass =
    accent === "offer"
      ? "border-offer bg-panel-alt text-offer"
      : "border-applied bg-panel-alt text-applied";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
        active ? activeClass : "border-hairline text-text-muted hover:border-text-dim"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <p className="font-mono text-sm text-text">{title}</p>
      <p className="text-xs leading-relaxed text-text-muted">{body}</p>
      {action}
    </div>
  );
}
