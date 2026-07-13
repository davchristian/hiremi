"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import type { ClientJob } from "@/lib/types";
import { STAGE_CONFIG, STAGE_ORDER, nextStage, previousStage, type Stage } from "@/lib/stage";
import { daysAgo, shortId } from "@/lib/format";

export type JobEditInput = {
  company: string;
  role: string;
  appliedDate: string;
  link: string;
  notes: string;
};

export function JobDetail({
  job,
  onClose,
  onSave,
  onMove,
  onDelete,
}: {
  job: ClientJob;
  onClose: () => void;
  onSave: (input: Partial<JobEditInput>) => Promise<void> | void;
  onMove: (stage: Stage) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const config = STAGE_CONFIG[job.stage];
  const [company, setCompany] = useState(job.company);
  const [role, setRole] = useState(job.role);
  const [appliedDate, setAppliedDate] = useState(job.appliedDate?.slice(0, 10) ?? "");
  const [link, setLink] = useState(job.link ?? "");
  const [notes, setNotes] = useState(job.notes);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    company !== job.company ||
    role !== job.role ||
    appliedDate !== (job.appliedDate?.slice(0, 10) ?? "") ||
    link !== (job.link ?? "") ||
    notes !== job.notes;

  const back = previousStage(job.stage);
  const forward = nextStage(job.stage);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ company, role, appliedDate, link, notes });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await onDelete();
  }

  return (
    <Modal title={`${shortId(job.id)}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${config.textClass} bg-panel-alt`}
          >
            {config.label}
          </span>
          <span className="font-mono text-xs text-text-dim">{daysAgo(job.appliedDate ?? job.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!back}
            onClick={() => back && onMove(back)}
            className="flex-1 rounded border border-hairline px-2 py-1.5 font-mono text-xs text-text-muted transition-colors hover:border-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← back
          </button>
          <select
            value={job.stage}
            onChange={(e) => onMove(e.target.value as Stage)}
            className="flex-1 rounded border border-hairline bg-panel-alt px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-applied"
          >
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_CONFIG[s].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!forward}
            onClick={() => forward && onMove(forward)}
            className="flex-1 rounded border border-hairline px-2 py-1.5 font-mono text-xs text-text-muted transition-colors hover:border-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
          >
            forward →
          </button>
        </div>

        <Field label="company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
        </Field>

        <Field label="role">
          <input value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} />
        </Field>

        <Field label="applied date">
          <input
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="link">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </Field>

        <Field label="notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={`${inputClass} resize-none font-sans`}
          />
        </Field>

        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-60 ${
              confirmDelete
                ? "border-rejected bg-rejected/10 text-rejected"
                : "border-hairline text-text-muted hover:border-rejected hover:text-rejected"
            }`}
          >
            {deleting ? "deleting..." : confirmDelete ? "confirm delete?" : "delete"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded bg-applied px-3 py-1.5 font-mono text-xs font-medium text-base transition-colors hover:bg-applied/90 disabled:opacity-40"
          >
            {saving ? "saving..." : "save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const inputClass =
  "rounded border border-hairline bg-panel-alt px-3 py-2 font-mono text-sm text-text outline-none focus:border-applied focus:ring-1 focus:ring-applied";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}
