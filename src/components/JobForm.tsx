"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";

export type NewJobInput = {
  company: string;
  role: string;
  appliedDate: string;
  link: string;
  notes: string;
};

const emptyForm: NewJobInput = { company: "", role: "", appliedDate: "", link: "", notes: "" };

export function JobForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: NewJobInput) => Promise<void> | void;
}) {
  const [form, setForm] = useState<NewJobInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      setError("company and role are required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      setError("failed to add application, try again");
      setSubmitting(false);
    }
  }

  return (
    <Modal title="add application" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="company">
          <input
            autoFocus
            required
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            className={inputClass}
            placeholder="Acme Corp"
          />
        </Field>

        <Field label="role">
          <input
            required
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className={inputClass}
            placeholder="Senior Software Engineer"
          />
        </Field>

        <Field label="applied date (optional)">
          <input
            type="date"
            value={form.appliedDate}
            onChange={(e) => setForm((f) => ({ ...f, appliedDate: e.target.value }))}
            className={inputClass}
          />
        </Field>

        <Field label="link (optional)">
          <input
            type="url"
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>

        <Field label="notes (optional)">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className={`${inputClass} resize-none font-sans`}
          />
        </Field>

        {error && <p className="font-mono text-xs text-rejected">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded bg-applied px-3 py-2 font-mono text-sm font-medium text-base transition-colors hover:bg-applied/90 disabled:opacity-60"
        >
          {submitting ? "adding..." : "add to wishlist"}
        </button>
      </form>
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
