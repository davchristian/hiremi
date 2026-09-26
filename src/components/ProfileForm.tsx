"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { TagInput } from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ClientProfile } from "@/lib/types";

const EXPERIENCE_LEVELS = ["student", "intern", "junior", "mid", "senior"] as const;
const WORK_MODES = ["any", "remote", "hybrid", "onsite"] as const;

function errorMessage(body: unknown): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string") return error;
  const fieldErrors = (error as { fieldErrors?: Record<string, string[] | undefined> } | undefined)
    ?.fieldErrors;
  const first = fieldErrors && Object.values(fieldErrors).find((messages) => messages?.length);
  return first?.[0] ?? "failed to save profile";
}

const EMPTY: ClientProfile = {
  targetRoles: [],
  skills: [],
  experienceLevel: "student",
  locationPreference: "",
  workMode: "any",
  blurb: "",
  hasEmbedding: false,
};

export function ProfileForm({
  profile,
  onClose,
  onSaved,
}: {
  profile: ClientProfile | null;
  onClose: () => void;
  onSaved: (profile: ClientProfile) => void;
}) {
  const [form, setForm] = useState<ClientProfile>(profile ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.targetRoles.length === 0) {
      setError("add at least one target role — matching needs something to go on");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoles: form.targetRoles,
          skills: form.skills,
          experienceLevel: form.experienceLevel,
          locationPreference: form.locationPreference,
          workMode: form.workMode,
          blurb: form.blurb,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(body));
      onSaved(body.profile as ClientProfile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save profile");
      setSaving(false);
    }
  }

  return (
    <Modal title="matching profile" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="target roles"
          htmlFor="target-roles"
          hint="the titles you're actually going for"
        >
          <TagInput
            id="target-roles"
            values={form.targetRoles}
            onChange={(targetRoles) => setForm((f) => ({ ...f, targetRoles }))}
            placeholder="Software Engineer Intern, then Enter"
          />
        </Field>

        <Field label="skills" htmlFor="skills" hint="languages, frameworks, tools">
          <TagInput
            id="skills"
            accent="wishlist"
            values={form.skills}
            onChange={(skills) => setForm((f) => ({ ...f, skills }))}
            placeholder="TypeScript, then Enter"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="experience" htmlFor="experience-level">
            <select
              id="experience-level"
              value={form.experienceLevel}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  experienceLevel: e.target.value as ClientProfile["experienceLevel"],
                }))
              }
              className={selectClass}
            >
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </Field>

          <Field label="work mode" htmlFor="work-mode">
            <select
              id="work-mode"
              value={form.workMode}
              onChange={(e) =>
                setForm((f) => ({ ...f, workMode: e.target.value as ClientProfile["workMode"] }))
              }
              className={selectClass}
            >
              {WORK_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="location preference (optional)" htmlFor="location-preference">
          <Input
            id="location-preference"
            value={form.locationPreference}
            onChange={(e) => setForm((f) => ({ ...f, locationPreference: e.target.value }))}
            placeholder="Jakarta, or Southeast Asia"
            className="bg-panel-alt font-mono text-sm"
          />
        </Field>

        <Field
          label="about you (optional)"
          htmlFor="blurb"
          hint="a sentence or two — this gives matching more to work with than tags alone"
        >
          <Textarea
            id="blurb"
            value={form.blurb}
            onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))}
            rows={4}
            placeholder="Final-year CS student who likes backend work — Postgres, APIs, and anything with a queue in it."
            className="resize-none bg-panel-alt font-sans text-sm"
          />
        </Field>

        {error && <p className="font-mono text-xs text-rejected">{error}</p>}

        <Button type="submit" disabled={saving} className="mt-1 font-mono text-sm">
          {saving ? "saving & embedding..." : "save profile"}
        </Button>
      </form>
    </Modal>
  );
}

const selectClass =
  "h-8 w-full rounded-[min(var(--radius-md),12px)] border border-input bg-panel-alt px-2 font-mono text-sm text-text outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="font-mono text-xs font-normal text-text-muted">
        {label}
      </Label>
      {hint && <p className="font-mono text-[11px] text-text-dim">{hint}</p>}
      {children}
    </div>
  );
}
