"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type NewJobStage = "wishlist" | "applied";

export type NewJobInput = {
  company: string;
  role: string;
  stage: NewJobStage;
  appliedDate: string;
  link: string;
  notes: string;
};

const emptyForm: NewJobInput = {
  company: "",
  role: "",
  stage: "wishlist",
  appliedDate: "",
  link: "",
  notes: "",
};

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
        <Field label="company" htmlFor="new-company">
          <Input
            id="new-company"
            autoFocus
            required
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            className={inputClass}
            placeholder="Grab"
          />
        </Field>

        <Field label="role" htmlFor="new-role">
          <Input
            id="new-role"
            required
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className={inputClass}
            placeholder="Software Engineer I"
          />
        </Field>

        <Field label="applied date (optional)" htmlFor="new-applied-date">
          <DatePicker
            id="new-applied-date"
            value={form.appliedDate}
            onChange={(appliedDate) => setForm((f) => ({ ...f, appliedDate }))}
            placeholder="not applied yet"
          />
        </Field>

        <Field label="link (optional)" htmlFor="new-link">
          <Input
            id="new-link"
            type="url"
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>

        <Field label="notes (optional)" htmlFor="new-notes">
          <Textarea
            id="new-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="resize-none bg-panel-alt font-sans text-sm"
          />
        </Field>

        <Field label="add as">
          <div className="grid grid-cols-2 gap-2">
            <StageOption
              active={form.stage === "wishlist"}
              accent="wishlist"
              label="wishlist"
              hint="saved for later"
              onSelect={() => setForm((f) => ({ ...f, stage: "wishlist" }))}
            />
            <StageOption
              active={form.stage === "applied"}
              accent="applied"
              label="applied"
              hint="already applied"
              onSelect={() => setForm((f) => ({ ...f, stage: "applied" }))}
            />
          </div>
        </Field>

        {form.stage === "applied" && !form.appliedDate && (
          <p className="font-mono text-xs text-text-dim">
            no date set — today&apos;s date will be used
          </p>
        )}

        {error && <p className="font-mono text-xs text-rejected">{error}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className={`mt-1 font-mono text-sm ${
            form.stage === "applied"
              ? "bg-applied text-background hover:bg-applied/80"
              : "bg-wishlist text-background hover:bg-wishlist/80"
          }`}
        >
          {submitting ? "adding..." : form.stage === "applied" ? "add to applied" : "add to wishlist"}
        </Button>
      </form>
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

function StageOption({
  active,
  accent,
  label,
  hint,
  onSelect,
}: {
  active: boolean;
  accent: "wishlist" | "applied";
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  const accentBorder = accent === "wishlist" ? "border-wishlist" : "border-applied";
  const accentText = accent === "wishlist" ? "text-wishlist" : "text-applied";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
        active
          ? `${accentBorder} bg-panel-alt`
          : "border-hairline bg-panel-alt/40 hover:border-text-dim"
      }`}
    >
      <span className={`font-mono text-sm ${active ? accentText : "text-text-muted"}`}>{label}</span>
      <span className="font-mono text-[11px] text-text-dim">{hint}</span>
    </button>
  );
}
