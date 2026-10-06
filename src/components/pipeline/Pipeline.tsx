"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Download, ListChecks, Plus } from "lucide-react";
import { isPendingJob, pendingJobId, type ClientJob } from "@/lib/types";
import { isFollowUpDue, STAGE_CONFIG, STAGE_ORDER, type Stage } from "@/lib/stage";
import { addDaysISODate, isoDateToTimestamp, todayISODate } from "@/lib/format";
import { jobsToCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/hig/button";
import { SearchField } from "@/components/hig/fields";
import { EmptyState, Notice, PageHeader } from "@/components/hig/layout";
import { Sheet } from "@/components/hig/sheet";
import { useToast } from "@/components/hig/toast";
import { JobRow } from "@/components/pipeline/JobRow";
import { JobSheet, type JobEditInput } from "@/components/pipeline/JobSheet";
import { AddJobSheet, type NewJobInput } from "@/components/pipeline/AddJobSheet";

const UNDO_WINDOW_MS = 6000;

async function sendJob(url: string, method: "POST" | "PATCH", body: unknown): Promise<ClientJob> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("request failed");
  const { job } = (await res.json()) as { job: ClientJob };
  return job;
}

function insertByCreatedAt(jobs: ClientJob[], job: ClientJob): ClientJob[] {
  if (jobs.some((j) => j.id === job.id)) return jobs;
  const index = jobs.findIndex((j) => j.createdAt < job.createdAt);
  return index === -1 ? [...jobs, job] : [...jobs.slice(0, index), job, ...jobs.slice(index)];
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function Pipeline({ initialJobs }: { initialJobs: ClientJob[] }) {
  const toast = useToast();
  const [jobs, setJobs] = useState<ClientJob[]>(initialJobs);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [pendingApply, setPendingApply] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<Stage>>(() => new Set(["rejected"]));
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const today = todayISODate();
  const openJob = jobs.find((job) => job.id === openJobId) ?? null;
  const applyJob = jobs.find((job) => job.id === pendingApply) ?? null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (adding || openJobId || pendingApply || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
      if (event.key === "n") {
        event.preventDefault();
        setAdding(true);
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adding, openJobId, pendingApply]);

  useEffect(() => {
    const timers = pendingDeletes.current;
    function flush() {
      for (const [id, timer] of timers) {
        clearTimeout(timer);
        void fetch(`/api/jobs/${id}`, { method: "DELETE", keepalive: true });
      }
      timers.clear();
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => job.company.toLowerCase().includes(q) || job.role.toLowerCase().includes(q));
  }, [jobs, query]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, ClientJob[]>(STAGE_ORDER.map((stage) => [stage, []]));
    for (const job of visibleJobs) map.get(job.stage)?.push(job);
    return map;
  }, [visibleJobs]);

  const stats = useMemo(
    () => ({
      active: jobs.filter((job) => job.stage === "applied" || job.stage === "interview").length,
      offers: jobs.filter((job) => job.stage === "offer").length,
      due: jobs.filter((job) => isFollowUpDue(job, today)),
    }),
    [jobs, today],
  );

  const replaceJob = useCallback((job: ClientJob) => {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
  }, []);

  async function handleAdd(input: NewJobInput) {
    const appliedDate = input.stage === "applied" ? input.appliedDate || today : "";
    const now = new Date().toISOString();
    const optimistic: ClientJob = {
      id: pendingJobId(),
      company: input.company.trim(),
      role: input.role.trim(),
      stage: input.stage,
      appliedDate: appliedDate ? isoDateToTimestamp(appliedDate) : null,
      followUpDate: null,
      link: input.link.trim() || null,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    setJobs((prev) => [optimistic, ...prev]);

    try {
      const job = await sendJob("/api/jobs", "POST", {
        company: optimistic.company,
        role: optimistic.role,
        stage: input.stage,
        appliedDate: appliedDate || undefined,
        link: optimistic.link ?? undefined,
        notes: input.notes || undefined,
      });
      setJobs((prev) => prev.map((j) => (j.id === optimistic.id ? job : j)));
    } catch (error) {
      setJobs((prev) => prev.filter((j) => j.id !== optimistic.id));
      throw error;
    }
  }

  async function moveJob(id: string, stage: Stage) {
    const before = jobs.find((job) => job.id === id);
    if (!before || before.stage === stage || isPendingJob(before)) return;

    const fillDate = stage === "applied" && !before.appliedDate ? today : undefined;
    replaceJob({
      ...before,
      stage,
      appliedDate: fillDate ? isoDateToTimestamp(fillDate) : before.appliedDate,
    });

    try {
      replaceJob(await sendJob(`/api/jobs/${id}`, "PATCH", { stage, ...(fillDate && { appliedDate: fillDate }) }));
    } catch {
      replaceJob(before);
      toast({ tone: "error", message: `Couldn't move ${before.company}. Check your connection and try again.` });
    }
  }

  function requestMove(id: string, stage: Stage) {
    const job = jobs.find((entry) => entry.id === id);
    if (!job || job.stage === stage) return;
    if (stage === "applied") {
      setPendingApply(id);
      return;
    }
    void moveJob(id, stage);
  }

  async function handleSave(id: string, input: Partial<JobEditInput>) {
    const before = jobs.find((job) => job.id === id);
    if (!before) return;

    replaceJob({
      ...before,
      ...(input.company !== undefined && { company: input.company.trim() }),
      ...(input.role !== undefined && { role: input.role.trim() }),
      ...(input.appliedDate !== undefined && {
        appliedDate: input.appliedDate ? isoDateToTimestamp(input.appliedDate) : null,
      }),
      ...(input.followUpDate !== undefined && {
        followUpDate: input.followUpDate ? isoDateToTimestamp(input.followUpDate) : null,
      }),
      ...(input.link !== undefined && { link: input.link.trim() || null }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });

    try {
      replaceJob(
        await sendJob(`/api/jobs/${id}`, "PATCH", {
          ...(input.company !== undefined && { company: input.company }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.appliedDate !== undefined && { appliedDate: input.appliedDate || null }),
          ...(input.followUpDate !== undefined && { followUpDate: input.followUpDate || null }),
          ...(input.link !== undefined && { link: input.link.trim() }),
          ...(input.notes !== undefined && { notes: input.notes }),
        }),
      );
    } catch (error) {
      replaceJob(before);
      throw error;
    }
  }

  function handleDelete(id: string) {
    const before = jobs.find((job) => job.id === id);
    if (!before) return;
    setJobs((prev) => prev.filter((job) => job.id !== id));
    setOpenJobId(null);

    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      try {
        const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error("request failed");
      } catch {
        setJobs((prev) => insertByCreatedAt(prev, before));
        toast({ tone: "error", message: `Couldn't delete ${before.company}. It's back in your pipeline.` });
      }
    }, UNDO_WINDOW_MS);
    pendingDeletes.current.set(id, timer);

    toast({
      message: `Deleted ${before.company}`,
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(pendingDeletes.current.get(id));
          pendingDeletes.current.delete(id);
          setJobs((prev) => insertByCreatedAt(prev, before));
        },
      },
    });
  }

  function handleExport() {
    const saved = jobs.filter((job) => !isPendingJob(job));
    const blob = new Blob([jobsToCsv(saved)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `applications-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function toggleSection(stage: Stage) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  const filtering = query.trim().length > 0;
  const subtitle =
    jobs.length === 0
      ? "Track every application from wishlist to offer."
      : `${plural(jobs.length, "application")}, ${stats.active} active, ${plural(stats.offers, "offer")}`;

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 py-6 desk:px-8 desk:py-8">
      <PageHeader
        title="Pipeline"
        subtitle={subtitle}
        actions={
          <>
            <SearchField
              ref={searchRef}
              value={query}
              onChange={setQuery}
              label="Search applications"
              placeholder="Search"
              className="w-full min-[480px]:w-56"
            />
            <IconButton label="Export as CSV" icon={<Download />} onClick={handleExport} disabled={jobs.length === 0} />
            <Button variant="accent" icon={<Plus strokeWidth={2.5} />} onClick={() => setAdding(true)}>
              Add application
            </Button>
          </>
        }
      />

      {stats.due.length > 0 && !filtering && (
        <Notice
          title={stats.due.length === 1 ? "1 follow-up is due" : `${stats.due.length} follow-ups are due`}
          action={
            stats.due.length === 1 ? (
              <Button size="sm" onClick={() => setOpenJobId(stats.due[0].id)}>
                Open
              </Button>
            ) : undefined
          }
        >
          {stats.due.length === 1 ? (
            <>A short check-in with {stats.due[0].company} keeps your application on their radar.</>
          ) : (
            <span className="flex flex-wrap gap-x-1">
              {stats.due.map((job, index) => (
                <span key={job.id}>
                  <button type="button" onClick={() => setOpenJobId(job.id)} className="text-tint hover:underline">
                    {job.company}
                  </button>
                  {index < stats.due.length - 1 ? "," : ""}
                </span>
              ))}
            </span>
          )}
        </Notice>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No applications yet"
          action={
            <Button variant="accent" icon={<Plus strokeWidth={2.5} />} onClick={() => setAdding(true)}>
              Add application
            </Button>
          }
        >
          Add a role you&apos;re applying to, or save one from Discover.
        </EmptyState>
      ) : filtering && visibleJobs.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No matches">
          Nothing matches &ldquo;{query.trim()}&rdquo;. Try a company or role name.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {STAGE_ORDER.map((stage) => {
            const stageJobs = byStage.get(stage) ?? [];
            if (filtering && stageJobs.length === 0) return null;
            const isCollapsed = collapsed.has(stage) && !filtering;
            return (
              <section key={stage} aria-labelledby={`stage-${stage}`} className="flex flex-col gap-1.5">
                <h2 id={`stage-${stage}`}>
                  <button
                    type="button"
                    onClick={() => toggleSection(stage)}
                    aria-expanded={!isCollapsed}
                    className="flex items-center gap-1.5 px-1 text-headline text-text"
                  >
                    <ChevronRight
                      className={cn("size-4 text-text-dim transition-transform duration-200", !isCollapsed && "rotate-90")}
                      strokeWidth={2.25}
                    />
                    {STAGE_CONFIG[stage].label}
                    <span className="text-callout font-normal text-text-dim tabular">{stageJobs.length}</span>
                  </button>
                </h2>
                {!isCollapsed &&
                  (stageJobs.length === 0 ? (
                    <p className="rounded-group bg-panel px-4 py-3 text-callout text-text-dim">{STAGE_CONFIG[stage].emptyHint}</p>
                  ) : (
                    <ul className="overflow-hidden rounded-group bg-panel">
                      {stageJobs.map((job) => (
                        <JobRow
                          key={job.id}
                          job={job}
                          today={today}
                          onOpen={() => setOpenJobId(job.id)}
                          onMove={(next) => requestMove(job.id, next)}
                        />
                      ))}
                    </ul>
                  ))}
              </section>
            );
          })}
        </div>
      )}

      <AddJobSheet open={adding} onClose={() => setAdding(false)} onSubmit={handleAdd} />

      {openJob && (
        <JobSheet
          key={openJob.id}
          job={openJob}
          onClose={() => setOpenJobId(null)}
          onSave={(input) => handleSave(openJob.id, input)}
          onMove={(stage) => requestMove(openJob.id, stage)}
          onDelete={() => handleDelete(openJob.id)}
        />
      )}

      <Sheet
        open={applyJob !== null}
        onClose={() => setPendingApply(null)}
        size="sm"
        title={applyJob ? `Mark ${applyJob.company} as applied?` : "Mark as applied?"}
        description={
          applyJob && !applyJob.appliedDate
            ? `The applied date is set to today, and a follow-up reminder to ${new Date(`${addDaysISODate(today, 7)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`
            : "A follow-up reminder is set a week after the applied date."
        }
        footer={
          <>
            <Button onClick={() => setPendingApply(null)}>Cancel</Button>
            <Button
              variant="accent"
              autoFocus
              onClick={() => {
                if (applyJob) void moveJob(applyJob.id, "applied");
                setPendingApply(null);
              }}
            >
              Mark as applied
            </Button>
          </>
        }
      />
    </div>
  );
}
