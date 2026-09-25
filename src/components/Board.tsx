"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientJob } from "@/lib/types";
import { STAGE_CONFIG, STAGE_ORDER, type Stage } from "@/lib/stage";
import { jobsToCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Column } from "@/components/Column";
import { StatsBar } from "@/components/StatsBar";
import { JobForm, type NewJobInput } from "@/components/JobForm";
import { JobDetail, type JobEditInput } from "@/components/JobDetail";

function tempId() {
  return `temp-${Math.random().toString(36).slice(2)}`;
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

  // Track which column is snapped into view so the mobile stage pills can
  // highlight it. Columns are direct children of the scroller.
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

  // Board-level shortcuts: n → new application, / → focus filter.
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
    const blob = new Blob([jobsToCsv(jobs)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  function flash(message: string) {
    setBanner(message);
    setTimeout(() => setBanner((current) => (current === message ? null : current)), 4000);
  }

  async function handleAdd(input: NewJobInput) {
    // Mirror the server's auto-fill: applying without a date defaults to today.
    const appliedDate =
      input.appliedDate
        ? new Date(input.appliedDate).toISOString()
        : input.stage === "applied"
          ? new Date().toISOString()
          : null;

    const optimistic: ClientJob = {
      id: tempId(),
      company: input.company.trim(),
      role: input.role.trim(),
      stage: input.stage,
      appliedDate,
      link: input.link || null,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setJobs((prev) => [optimistic, ...prev]);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: input.company.trim(),
          role: input.role.trim(),
          stage: input.stage,
          appliedDate: input.appliedDate || undefined,
          link: input.link || undefined,
          notes: input.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      const { job } = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === optimistic.id ? job : j)));
    } catch {
      setJobs((prev) => prev.filter((j) => j.id !== optimistic.id));
      flash("failed to add application");
      throw new Error("add failed");
    }
  }

  async function handleMove(id: string, stage: Stage) {
    const previous = jobs;
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              stage,
              appliedDate: stage === "applied" && !j.appliedDate ? new Date().toISOString() : j.appliedDate,
            }
          : j,
      ),
    );

    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("request failed");
      const { job } = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)));
    } catch {
      setJobs(previous);
      flash("failed to move application");
    }
  }

  async function handleSave(id: string, input: Partial<JobEditInput>) {
    const previous = jobs;
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              ...(input.company !== undefined && { company: input.company }),
              ...(input.role !== undefined && { role: input.role }),
              ...(input.appliedDate !== undefined && {
                appliedDate: input.appliedDate ? new Date(input.appliedDate).toISOString() : null,
              }),
              ...(input.link !== undefined && { link: input.link || null }),
              ...(input.notes !== undefined && { notes: input.notes }),
            }
          : j,
      ),
    );

    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(input.company !== undefined && { company: input.company }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.appliedDate !== undefined && { appliedDate: input.appliedDate || null }),
          ...(input.link !== undefined && { link: input.link || "" }),
          ...(input.notes !== undefined && { notes: input.notes }),
        }),
      });
      if (!res.ok) throw new Error("request failed");
      const { job } = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)));
    } catch {
      setJobs(previous);
      flash("failed to save changes");
    }
  }

  async function handleDelete(id: string) {
    const previous = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setOpenJobId(null);

    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("request failed");
    } catch {
      setJobs(previous);
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
        <div className="mx-4 mb-2 shrink-0 rounded border border-rejected/40 bg-rejected/10 px-3 py-2 font-mono text-xs text-rejected sm:mx-6">
          {banner}
        </div>
      )}

      {/* Mobile: swipe-position indicator + jump navigation for the columns */}
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
        className="flex min-h-0 flex-1 snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pb-6 sm:scroll-px-6 sm:px-6"
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
