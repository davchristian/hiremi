"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isPendingJob, pendingJobId, type ClientJob } from "@/lib/types";
import { STAGE_CONFIG, STAGE_ORDER, type Stage } from "@/lib/stage";
import { isoDateToTimestamp, todayISODate } from "@/lib/format";
import { jobsToCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Column } from "@/components/Column";
import { StatsBar } from "@/components/StatsBar";
import { JobForm, type NewJobInput } from "@/components/JobForm";
import { JobDetail, type JobEditInput } from "@/components/JobDetail";

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

export function Board({ initialJobs }: { initialJobs: ClientJob[] }) {
  const [jobs, setJobs] = useState<ClientJob[]>(initialJobs);
  const [isAdding, setIsAdding] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<Stage>("wishlist");

  function handleColumnScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const origin = scroller.getBoundingClientRect().left;
    const columns = Array.from(scroller.children) as HTMLElement[];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    columns.forEach((column, index) => {
      const distance = Math.abs(column.getBoundingClientRect().left - origin);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    const stage = STAGE_ORDER[bestIndex];
    if (stage) setActiveStage(stage);
  }

  function scrollToStage(stage: Stage) {
    const index = STAGE_ORDER.indexOf(stage);
    const column = scrollerRef.current?.children[index] as HTMLElement | undefined;
    column?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isAdding || openJobId || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        setIsAdding(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdding, openJobId]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) => j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q),
    );
  }, [jobs, query]);

  const jobsByStage = useMemo(() => {
    const map = new Map<Stage, ClientJob[]>(STAGE_ORDER.map((s) => [s, []]));
    for (const job of filteredJobs) {
      map.get(job.stage)?.push(job);
    }
    return map;
  }, [filteredJobs]);

  function handleExport() {
    const saved = jobs.filter((job) => !isPendingJob(job));
    const blob = new Blob([jobsToCsv(saved)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${todayISODate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  function flash(message: string) {
    setBanner(message);
    setTimeout(() => setBanner((current) => (current === message ? null : current)), 4000);
  }

  function replaceJob(job: ClientJob) {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
  }

  async function handleAdd(input: NewJobInput) {
    const appliedDate = input.appliedDate || (input.stage === "applied" ? todayISODate() : "");
    const now = new Date().toISOString();
    const optimistic: ClientJob = {
      id: pendingJobId(),
      company: input.company.trim(),
      role: input.role.trim(),
      stage: input.stage,
      appliedDate: appliedDate ? isoDateToTimestamp(appliedDate) : null,
      link: input.link || null,
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
        link: input.link || undefined,
        notes: input.notes || undefined,
      });
      setJobs((prev) => prev.map((j) => (j.id === optimistic.id ? job : j)));
    } catch {
      setJobs((prev) => prev.filter((j) => j.id !== optimistic.id));
      flash("failed to add application");
      throw new Error("add failed");
    }
  }

  async function handleMove(id: string, stage: Stage) {
    const before = jobs.find((j) => j.id === id);
    if (!before || before.stage === stage || isPendingJob(before)) return;

    const fillDate = stage === "applied" && !before.appliedDate ? todayISODate() : undefined;
    replaceJob({
      ...before,
      stage,
      appliedDate: fillDate ? isoDateToTimestamp(fillDate) : before.appliedDate,
    });

    try {
      replaceJob(
        await sendJob(`/api/jobs/${id}`, "PATCH", {
          stage,
          ...(fillDate && { appliedDate: fillDate }),
        }),
      );
    } catch {
      replaceJob(before);
      flash("failed to move application");
    }
  }

  async function handleSave(id: string, input: Partial<JobEditInput>) {
    const before = jobs.find((j) => j.id === id);
    if (!before) return;

    replaceJob({
      ...before,
      ...(input.company !== undefined && { company: input.company.trim() }),
      ...(input.role !== undefined && { role: input.role.trim() }),
      ...(input.appliedDate !== undefined && {
        appliedDate: input.appliedDate ? isoDateToTimestamp(input.appliedDate) : null,
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
          ...(input.link !== undefined && { link: input.link.trim() }),
          ...(input.notes !== undefined && { notes: input.notes }),
        }),
      );
    } catch (error) {
      replaceJob(before);
      flash("failed to save changes");
      throw error;
    }
  }

  async function handleDelete(id: string) {
    const before = jobs.find((j) => j.id === id);
    if (!before) return;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setOpenJobId(null);

    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("request failed");
    } catch {
      setJobs((prev) => insertByCreatedAt(prev, before));
      flash("failed to delete application");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StatsBar jobs={jobs} />

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <div className="relative flex min-w-0 basis-full items-center sm:max-w-xs sm:basis-64">
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="grep company or role"
            aria-label="filter by company or role"
            className="bg-panel pr-8 font-mono text-xs"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="clear filter"
              className="absolute right-2 font-mono text-xs text-text-dim transition-colors hover:text-text"
            >
              ×
            </button>
          ) : (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2 hidden rounded border border-hairline px-1 font-mono text-[10px] text-text-dim sm:inline"
            >
              /
            </kbd>
          )}
        </div>

        <p className="font-mono text-xs text-text-dim">
          {query ? `${filteredJobs.length}/${jobs.length} shown` : `${jobs.length} tracked`}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={jobs.length === 0}
            title="download all applications as csv"
            className="font-mono text-xs text-text-muted"
          >
            csv ↓
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            title="new application (n)"
            className="font-mono text-xs"
          >
            <span className="sm:hidden">+ add</span>
            <span className="hidden sm:inline">+ new application</span>
          </Button>
        </div>
      </div>

      {banner && (
        <div
          role="alert"
          className="mx-4 mb-2 shrink-0 rounded border border-rejected/40 bg-rejected/10 px-3 py-2 font-mono text-xs text-rejected sm:mx-6"
        >
          {banner}
        </div>
      )}

      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2 sm:hidden">
        {STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => scrollToStage(stage)}
            aria-current={activeStage === stage ? "true" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              activeStage === stage
                ? "border-text-muted bg-panel-alt text-text"
                : "border-hairline text-text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STAGE_CONFIG[stage].dotClass}`} />
            {STAGE_CONFIG[stage].label}
            <span className="text-text-dim">{jobsByStage.get(stage)?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleColumnScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-6 sm:scroll-px-6 sm:px-6"
      >
        {STAGE_ORDER.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            jobs={jobsByStage.get(stage) ?? []}
            filtered={query.trim().length > 0}
            onOpenJob={setOpenJobId}
            onMoveJob={handleMove}
          />
        ))}
      </div>

      {isAdding && <JobForm onClose={() => setIsAdding(false)} onSubmit={handleAdd} />}

      {openJob && (
        <JobDetail
          job={openJob}
          onClose={() => setOpenJobId(null)}
          onSave={(input) => handleSave(openJob.id, input)}
          onMove={(stage) => handleMove(openJob.id, stage)}
          onDelete={() => handleDelete(openJob.id)}
        />
      )}
    </div>
  );
}
