"use client";

import { useMemo, useState } from "react";
import type { ClientJob } from "@/lib/types";
import { STAGE_ORDER, type Stage } from "@/lib/stage";
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

  const jobsByStage = useMemo(() => {
    const map = new Map<Stage, ClientJob[]>(STAGE_ORDER.map((s) => [s, []]));
    for (const job of jobs) {
      map.get(job.stage)?.push(job);
    }
    return map;
  }, [jobs]);

  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  function flash(message: string) {
    setBanner(message);
    setTimeout(() => setBanner((current) => (current === message ? null : current)), 4000);
  }

  async function handleAdd(input: NewJobInput) {
    const optimistic: ClientJob = {
      id: tempId(),
      company: input.company.trim(),
      role: input.role.trim(),
      stage: "wishlist",
      appliedDate: input.appliedDate ? new Date(input.appliedDate).toISOString() : null,
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

      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <p className="font-mono text-xs text-text-dim">{jobs.length} tracked</p>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded bg-applied px-3 py-1.5 font-mono text-xs font-medium text-base transition-colors hover:bg-applied/90"
        >
          + new application
        </button>
      </div>

      {banner && (
        <div className="mx-4 mb-2 shrink-0 rounded border border-rejected/40 bg-rejected/10 px-3 py-2 font-mono text-xs text-rejected sm:mx-6">
          {banner}
        </div>
      )}

      <div className="flex min-h-0 flex-1 snap-x gap-4 overflow-x-auto px-4 pb-6 sm:px-6">
        {STAGE_ORDER.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            jobs={jobsByStage.get(stage) ?? []}
            onOpenJob={setOpenJobId}
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
