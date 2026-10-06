"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/hig/button";
import { SegmentedControl } from "@/components/hig/controls";
import { DateField, Field, TextArea, TextField } from "@/components/hig/fields";
import { Sheet } from "@/components/hig/sheet";

export type NewJobInput = {
  company: string;
  role: string;
  stage: "wishlist" | "applied";
  appliedDate: string;
  link: string;
  notes: string;
};

const EMPTY: NewJobInput = { company: "", role: "", stage: "wishlist", appliedDate: "", link: "", notes: "" };

export function AddJobSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewJobInput) => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const missingCompany = touched && !form.company.trim();
  const missingRole = touched && !form.role.trim();

  function close() {
    setForm(EMPTY);
    setTouched(false);
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!form.company.trim() || !form.role.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
      close();
    } catch {
      setError("Couldn't add the application. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add application"
      description="Track a role you found anywhere, including LinkedIn, JobStreet or a company's own site."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="accent" type="submit" form="add-job" disabled={submitting}>
            {submitting ? "Adding" : "Add"}
          </Button>
        </>
      }
    >
      <form id="add-job" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 desk:grid-cols-2">
          <Field label="Company" htmlFor="new-company" error={missingCompany ? "Enter a company name" : null}>
            <TextField
              id="new-company"
              autoFocus
              value={form.company}
              aria-invalid={missingCompany || undefined}
              placeholder="Xendit"
              onChange={(event) => setForm((f) => ({ ...f, company: event.target.value }))}
            />
          </Field>
          <Field label="Role" htmlFor="new-role" error={missingRole ? "Enter a role" : null}>
            <TextField
              id="new-role"
              value={form.role}
              aria-invalid={missingRole || undefined}
              placeholder="Software Engineer Intern"
              onChange={(event) => setForm((f) => ({ ...f, role: event.target.value }))}
            />
          </Field>
        </div>

        <Field label="Status">
          <SegmentedControl
            label="Status"
            value={form.stage}
            onChange={(stage) => setForm((f) => ({ ...f, stage }))}
            options={[
              { value: "wishlist", label: "Saved for later" },
              { value: "applied", label: "Already applied" },
            ]}
            className="w-full max-w-sm"
          />
        </Field>

        {form.stage === "applied" && (
          <Field label="Applied on" htmlFor="new-applied" helper="Leave empty to use today. A follow-up reminder is set a week later.">
            <DateField id="new-applied" value={form.appliedDate} onChange={(appliedDate) => setForm((f) => ({ ...f, appliedDate }))} placeholder="Today" />
          </Field>
        )}

        <Field label="Posting link" htmlFor="new-link">
          <TextField
            id="new-link"
            type="url"
            inputMode="url"
            value={form.link}
            placeholder="https://"
            onChange={(event) => setForm((f) => ({ ...f, link: event.target.value }))}
          />
        </Field>

        <Field label="Notes" htmlFor="new-notes">
          <TextArea id="new-notes" rows={3} value={form.notes} onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))} />
        </Field>

        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
