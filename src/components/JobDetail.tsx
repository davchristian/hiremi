"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ClientJob } from "@/lib/types";
import { STAGE_CONFIG, STAGE_ORDER, isStale, nextStage, previousStage, type Stage } from "@/lib/stage";
import { daysAgo, shortId } from "@/lib/format";

export type JobEditInput = {
  company: string;
  role: string;
  appliedDate: string;
  link: string;
  notes: string;
};

type Field = keyof JobEditInput;

const FIELDS: readonly Field[] = ["company", "role", "appliedDate", "link", "notes"];

function editableValues(job: ClientJob): JobEditInput {
  return {
    company: job.company,
    role: job.role,
    appliedDate: job.appliedDate?.slice(0, 10) ?? "",
    link: job.link ?? "",
    notes: job.notes,
  };
}

function pick(values: JobEditInput, fields: readonly Field[]): Partial<JobEditInput> {
  const picked: Partial<JobEditInput> = {};
  for (const field of fields) picked[field] = values[field];
  return picked;
}

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
  const current = editableValues(job);
  const [baseline, setBaseline] = useState(current);
  const [form, setForm] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updatedElsewhere = FIELDS.filter(
    (field) => current[field] !== baseline[field] && form[field] === baseline[field],
  );
  if (updatedElsewhere.length > 0) {
    const patch = pick(current, updatedElsewhere);
    setBaseline({ ...baseline, ...patch });
    setForm({ ...form, ...patch });
  }

  const changed = FIELDS.filter((field) => form[field] !== baseline[field]);
  const back = previousStage(job.stage);
  const forward = nextStage(job.stage);

  function update(field: Field, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSave() {
    if (!form.company.trim() || !form.role.trim()) {
      setError("company and role are required");
      return;
    }

    const submitted = form;
    setSaving(true);
    setError(null);
    try {
      await onSave(pick(submitted, changed));
      setBaseline(submitted);
    } catch {
      setError("failed to save changes — your edits are still here, try again");
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
    <Modal title={shortId(job.id)} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={`font-mono text-xs uppercase tracking-wide ${config.textClass}`}
          >
            {config.label}
          </Badge>
          <span className="flex items-center gap-2 font-mono text-xs">
            {isStale(job) && (
              <Badge className="bg-interview/15 font-mono text-[10px] uppercase tracking-wide text-interview">
                stale
              </Badge>
            )}
            <span className="text-text-dim">{daysAgo(job.appliedDate ?? job.createdAt)}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!back}
            onClick={() => back && onMove(back)}
            className="flex-1 font-mono text-xs text-text-muted"
          >
            ← back
          </Button>
          <select
            value={job.stage}
            onChange={(e) => onMove(e.target.value as Stage)}
            aria-label="stage"
            className="h-7 flex-1 rounded-[min(var(--radius-md),12px)] border border-input bg-panel-alt px-2 font-mono text-xs text-text outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_CONFIG[s].label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={!forward}
            onClick={() => forward && onMove(forward)}
            className="flex-1 font-mono text-xs text-text-muted"
          >
            forward →
          </Button>
        </div>

        <Field label="company" htmlFor="edit-company">
          <Input
            id="edit-company"
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="role" htmlFor="edit-role">
          <Input
            id="edit-role"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="applied date" htmlFor="edit-applied-date">
          <DatePicker
            id="edit-applied-date"
            value={form.appliedDate}
            onChange={(value) => update("appliedDate", value)}
            placeholder="no date set"
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-link" className="font-mono text-xs font-normal text-text-muted">
              link
            </Label>
            {job.link && (
              <a
                href={job.link}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-applied hover:underline"
              >
                open ↗
              </a>
            )}
          </div>
          <Input
            id="edit-link"
            type="url"
            value={form.link}
            onChange={(e) => update("link", e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        <Field label="notes" htmlFor="edit-notes">
          <Textarea
            id="edit-notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            className="resize-none bg-panel-alt font-sans text-sm"
          />
        </Field>

        {error && (
          <p role="alert" className="font-mono text-xs text-rejected">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-4">
          <Button
            variant={confirmDelete ? "destructive" : "outline"}
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className={`font-mono text-xs ${
              confirmDelete ? "" : "text-text-muted hover:border-rejected hover:text-rejected"
            }`}
          >
            {deleting ? "deleting..." : confirmDelete ? "confirm delete?" : "delete"}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={changed.length === 0 || saving}
            className="font-mono text-xs"
          >
            {saving ? "saving..." : "save changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const inputClass = "bg-panel-alt font-mono text-sm";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="font-mono text-xs font-normal text-text-muted">
        {label}
      </Label>
      {children}
    </div>
  );
}
