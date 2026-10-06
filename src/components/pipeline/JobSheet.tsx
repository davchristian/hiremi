"use client";

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import type { ClientJob } from "@/lib/types";
import type { Stage } from "@/lib/stage";
import { addDaysISODate, todayISODate } from "@/lib/format";
import { Button } from "@/components/hig/button";
import { DateField, Field, TextArea, TextField } from "@/components/hig/fields";
import { PopUpButton } from "@/components/hig/popup-button";
import { Sheet } from "@/components/hig/sheet";
import { STAGE_OPTIONS } from "@/components/pipeline/JobRow";

export type JobEditInput = {
  company: string;
  role: string;
  appliedDate: string;
  followUpDate: string;
  link: string;
  notes: string;
};

type FieldName = keyof JobEditInput;

const FIELDS: readonly FieldName[] = ["company", "role", "appliedDate", "followUpDate", "link", "notes"];

function editable(job: ClientJob): JobEditInput {
  return {
    company: job.company,
    role: job.role,
    appliedDate: job.appliedDate?.slice(0, 10) ?? "",
    followUpDate: job.followUpDate?.slice(0, 10) ?? "",
    link: job.link ?? "",
    notes: job.notes,
  };
}

export function JobSheet({
  job,
  onClose,
  onSave,
  onMove,
  onDelete,
}: {
  job: ClientJob;
  onClose: () => void;
  onSave: (input: Partial<JobEditInput>) => Promise<void>;
  onMove: (stage: Stage) => void;
  onDelete: () => void;
}) {
  const [baseline, setBaseline] = useState(() => editable(job));
  const [form, setForm] = useState(baseline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = editable(job);
  const syncedFromServer = FIELDS.filter((field) => current[field] !== baseline[field] && form[field] === baseline[field]);
  if (syncedFromServer.length > 0) {
    const patch = Object.fromEntries(syncedFromServer.map((field) => [field, current[field]]));
    setBaseline({ ...baseline, ...patch });
    setForm({ ...form, ...patch });
  }

  const changed = FIELDS.filter((field) => form[field] !== baseline[field]);
  const invalid = !form.company.trim() || !form.role.trim();

  function update(field: FieldName, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function save(fields: readonly FieldName[], values: JobEditInput) {
    setSaving(true);
    setError(null);
    try {
      await onSave(Object.fromEntries(fields.map((field) => [field, values[field]])));
      setBaseline((previous) => ({ ...previous, ...Object.fromEntries(fields.map((field) => [field, values[field]])) }));
      return true;
    } catch {
      setError("Couldn't save your changes. They're still here, so try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function quickFollowUp(value: string) {
    const next = { ...form, followUpDate: value };
    setForm(next);
    await save(["followUpDate"], next);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      size="md"
      title={job.company}
      description={job.role}
      footer={
        <>
          <Button variant="destructive" icon={<Trash2 />} onClick={onDelete} className="desk:mr-auto">
            Delete
          </Button>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="accent"
            disabled={changed.length === 0 || invalid || saving}
            onClick={async () => {
              if (await save(changed, form)) onClose();
            }}
          >
            {saving ? "Saving" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Stage" htmlFor="job-stage">
          <PopUpButton
            id="job-stage"
            value={job.stage}
            options={STAGE_OPTIONS}
            onChange={onMove}
            label="Stage"
            className="w-44"
          />
        </Field>

        <div className="grid gap-4 desk:grid-cols-2">
          <Field label="Company" htmlFor="job-company" error={!form.company.trim() ? "Enter a company name" : null}>
            <TextField
              id="job-company"
              value={form.company}
              aria-invalid={!form.company.trim() || undefined}
              onChange={(event) => update("company", event.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="job-role" error={!form.role.trim() ? "Enter a role" : null}>
            <TextField
              id="job-role"
              value={form.role}
              aria-invalid={!form.role.trim() || undefined}
              onChange={(event) => update("role", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4">
          <Field label="Applied on" htmlFor="job-applied">
            <DateField id="job-applied" value={form.appliedDate} onChange={(value) => update("appliedDate", value)} placeholder="Not applied" />
          </Field>
          <Field label="Follow up by" htmlFor="job-follow-up" helper="Reminders stop once the application reaches Offer or Rejected.">
            <div className="flex flex-wrap items-center gap-2">
              <DateField
                id="job-follow-up"
                value={form.followUpDate}
                onChange={(value) => update("followUpDate", value)}
                placeholder="No reminder"
                clearable={false}
              />
              <Button size="sm" variant="plain" disabled={saving} onClick={() => quickFollowUp(addDaysISODate(todayISODate(), 7))}>
                In a week
              </Button>
              {form.followUpDate && (
                <Button size="sm" variant="plain" disabled={saving} onClick={() => quickFollowUp("")}>
                  Done
                </Button>
              )}
            </div>
          </Field>
        </div>

        <Field label="Posting link" htmlFor="job-link">
          <div className="flex items-center gap-2">
            <TextField
              id="job-link"
              type="url"
              inputMode="url"
              value={form.link}
              placeholder="https://"
              onChange={(event) => update("link", event.target.value)}
            />
            {job.link && (
              <a
                href={job.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-body text-tint hover:bg-tint-soft"
              >
                Open
                <ExternalLink className="size-3.5" strokeWidth={2} />
              </a>
            )}
          </div>
        </Field>

        <Field label="Notes" htmlFor="job-notes">
          <TextArea id="job-notes" rows={4} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
        </Field>

        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
