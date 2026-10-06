"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Plus, RotateCw } from "lucide-react";
import type { RefreshOverview } from "@/lib/refresh";
import type { ClientSource } from "@/lib/types";
import {
  parseBoardInput,
  SOURCE_KINDS,
  SOURCE_LABELS,
  SOURCE_NEEDS_SLUG,
  SOURCE_SLUG_HINTS,
  type JobSourceKind,
} from "@/lib/source-meta";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/hig/button";
import { Field, TextField } from "@/components/hig/fields";
import { GroupedRow, GroupedSection, Notice, PageHeader } from "@/components/hig/layout";
import { PopUpButton } from "@/components/hig/popup-button";
import { Sheet } from "@/components/hig/sheet";
import { ActivityIndicator, IndeterminateProgress, StatusDot } from "@/components/hig/status";
import { useToast } from "@/components/hig/toast";
import { STATUS_META } from "@/components/discover/meta";

const KIND_OPTIONS = SOURCE_KINDS.map((kind) => ({ value: kind, label: SOURCE_LABELS[kind] }));

function sourceDetail(source: ClientSource) {
  const platform = SOURCE_LABELS[source.kind];
  if (source.lastError) {
    return (
      <span className="text-danger" title={source.lastError}>
        {platform}. Last check failed {source.lastFetchedAt ? timeAgo(source.lastFetchedAt) : ""}
      </span>
    );
  }
  return `${platform}. ${source.lastFetchedAt ? `Checked ${timeAgo(source.lastFetchedAt)}` : "Not checked yet"}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Your session has expired. Sign in again to continue.";
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  if (typeof body?.error === "string") return body.error;
  const fieldErrors = (body?.error as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  const first = fieldErrors && Object.values(fieldErrors).flat()[0];
  return first ?? fallback;
}

export function Sources({ initialSources, overview }: { initialSources: ClientSource[]; overview: RefreshOverview }) {
  const router = useRouter();
  const toast = useToast();
  const [sources, setSources] = useState(initialSources);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mine = sources.filter((source) => !source.isDefault);
  const defaults = sources.filter((source) => source.isDefault);
  const summary = overview.lastSummary;

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      if (!res.ok) {
        toast({ tone: res.status === 429 ? "neutral" : "error", message: await readError(res, "Couldn't refresh. Try again later.") });
        return;
      }
      const report = (await res.json()) as { sources: { error?: string }[]; sourcesRemaining: number };
      const failed = report.sources.filter((source) => source.error).length;
      toast({
        tone: failed ? "error" : "neutral",
        message: `Checked ${report.sources.length} boards${failed ? `, ${failed} failed` : ""}${report.sourcesRemaining ? `. ${report.sourcesRemaining} left for the next runs.` : "."}`,
      });
      const res2 = await fetch("/api/sources");
      if (res2.ok) setSources(((await res2.json()) as { sources: ClientSource[] }).sources);
      router.refresh();
    } catch {
      toast({ tone: "error", message: "Couldn't reach the server to refresh." });
    } finally {
      setRefreshing(false);
    }
  }

  async function remove(source: ClientSource) {
    setSources((current) => current.filter((entry) => entry.id !== source.id));
    try {
      const res = await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("request failed");
      toast({
        message: `Removed ${source.label || SOURCE_LABELS[source.kind]}`,
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await fetch("/api/sources", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: source.kind, slug: source.slug, label: source.label }),
            });
            if (restored.ok) {
              const body = (await restored.json()) as { source: ClientSource };
              setSources((current) => [...current, body.source]);
            } else {
              toast({ tone: "error", message: "Couldn't restore that board. Add it again." });
            }
          },
        },
      });
    } catch {
      setSources((current) => [...current, source]);
      toast({ tone: "error", message: "Couldn't remove that board. Try again." });
    }
  }

  const lastChecked = overview.lastFinishedAt ? `Last full check finished ${timeAgo(overview.lastFinishedAt)}.` : "No full check has finished yet.";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-4 py-6 desk:px-8 desk:py-8">
      <PageHeader
        title="Sources"
        subtitle={`Boards are checked every 3 days. ${lastChecked}`}
        actions={
          <>
            <Button icon={refreshing ? <ActivityIndicator size={14} /> : <RotateCw />} onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing" : "Refresh now"}
            </Button>
            <Button variant="accent" icon={<Plus strokeWidth={2.5} />} onClick={() => setAdding(true)}>
              Add board
            </Button>
          </>
        }
      />

      {(refreshing || overview.running) && (
        <Notice
          title={refreshing ? "Checking job boards" : "A refresh is in progress"}
          icon={<ActivityIndicator size={15} className="text-text-muted" />}
        >
          <div className="flex flex-col gap-2 pt-1">
            {refreshing ? (
              <span>New internships are added and taken-down ones are closed. This can take up to a minute.</span>
            ) : (
              <span>
                {`${overview.running!.remaining} ${overview.running!.remaining === 1 ? "board is" : "boards are"} left in this cycle. They're checked a few at a time each hour.`}
              </span>
            )}
            {refreshing && <IndeterminateProgress label="Checking job boards" />}
          </div>
        </Notice>
      )}

      {summary && (
        <GroupedSection header="Last refresh" footer={`${summary.sourcesChecked} boards checked${summary.sourcesFailed ? `, ${summary.sourcesFailed} failed` : ""}.`}>
          <GroupedRow label="New postings" value={<span className="tabular">{summary.newPostings}</span>} />
          <GroupedRow label="Changed" value={<span className="tabular">{summary.changedPostings}</span>} />
          <GroupedRow label="Closed" value={<span className="tabular">{summary.closedPostings}</span>} />
        </GroupedSection>
      )}

      {summary && Object.keys(summary.byStatus).length > 0 && (
        <GroupedSection header="New and changed postings, by status">
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <GroupedRow
              key={status}
              leading={<StatusDot color={STATUS_META[status as keyof typeof STATUS_META].color} />}
              label={STATUS_META[status as keyof typeof STATUS_META].label}
              value={<span className="tabular">{count}</span>}
            />
          ))}
        </GroupedSection>
      )}

      {summary && summary.topNew.length > 0 && (
        <GroupedSection header="New at top companies">
          {summary.topNew.map((posting) => (
            <GroupedRow key={posting.id} label={posting.title} detail={posting.company} href="/feed" />
          ))}
        </GroupedSection>
      )}

      <GroupedSection
        header="Your boards"
        footer={
          mine.length === 0 ? (
            <>
              Add any company that hires on Greenhouse, Lever, Ashby, SmartRecruiters, Workable or CATAPA. For LinkedIn, JobStreet and Glints, add the role to your{" "}
              <Link href="/board" className="text-tint hover:underline">
                Pipeline
              </Link>{" "}
              by hand.
            </>
          ) : undefined
        }
      >
        {mine.length === 0 ? (
          <GroupedRow label="No boards of your own yet" onClick={() => setAdding(true)} />
        ) : (
          mine.map((source) => (
            <GroupedRow
              key={source.id}
              label={source.label || source.slug}
              detail={sourceDetail(source)}
              trailing={
                <Button size="sm" variant="plain" onClick={() => remove(source)} className="text-danger hover:bg-danger-soft">
                  Remove
                </Button>
              }
            />
          ))
        )}
      </GroupedSection>

      <GroupedSection header="Included boards" footer="These boards are checked for everyone. Himalayas jobs link back to Himalayas, as its terms require.">
        {defaults.map((source) => (
          <GroupedRow key={source.id} label={source.label || source.slug} detail={sourceDetail(source)} />
        ))}
      </GroupedSection>

      <AddSourceSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(source) => {
          setSources((current) => [...current.filter((entry) => entry.id !== source.id), source]);
          toast({ message: `Added ${source.label}. It's checked in the next refresh.` });
        }}
      />
    </div>
  );
}

function AddSourceSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (source: ClientSource) => void;
}) {
  const [kind, setKind] = useState<JobSourceKind>("greenhouse");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setSlug("");
    setError(null);
    onClose();
  }

  function onSlugChange(value: string) {
    setSlug(value);
    setError(null);
    const parsed = parseBoardInput(value);
    if (parsed) setKind(parsed.kind);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (SOURCE_NEEDS_SLUG[kind] && !slug.trim()) {
      setError("Enter the board name or paste the board URL");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug: slug.trim(), label: "" }),
      });
      if (!res.ok) {
        setError(await readError(res, "Couldn't add that board. Try again."));
        return;
      }
      onAdded(((await res.json()) as { source: ClientSource }).source);
      close();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add a job board"
      description="The board name is checked with the platform before it's saved."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="accent" type="submit" form="add-source" disabled={busy} icon={busy ? <ActivityIndicator size={14} /> : undefined}>
            {busy ? "Checking" : "Add board"}
          </Button>
        </>
      }
    >
      <form id="add-source" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Platform" htmlFor="source-kind">
          <PopUpButton id="source-kind" value={kind} options={KIND_OPTIONS} onChange={setKind} label="Platform" className="w-56" />
        </Field>
        <Field
          label={SOURCE_NEEDS_SLUG[kind] ? "Board name or URL" : "Filter (optional)"}
          htmlFor="source-slug"
          helper={SOURCE_SLUG_HINTS[kind]}
          error={error}
        >
          <TextField
            id="source-slug"
            autoFocus
            value={slug}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => onSlugChange(event.target.value)}
            placeholder={SOURCE_NEEDS_SLUG[kind] ? "xendit, or https://jobs.lever.co/ninjavan" : ""}
          />
        </Field>
      </form>
    </Sheet>
  );
}
