"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { ClientProfile } from "@/lib/types";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme";
import { Button } from "@/components/hig/button";
import { SegmentedControl, Switch } from "@/components/hig/controls";
import { TextArea, TextField, TokenField } from "@/components/hig/fields";
import { GroupedSection, Notice, PageHeader } from "@/components/hig/layout";
import { PopUpButton } from "@/components/hig/popup-button";
import { ActivityIndicator } from "@/components/hig/status";
import { useToast } from "@/components/hig/toast";

const EMPTY: ClientProfile = {
  targetRoles: [],
  skills: [],
  experienceLevel: "student",
  locationPreference: "",
  workMode: "any",
  blurb: "",
  singaporePassConfirmed: false,
  hasEmbedding: false,
};

const LEVELS: { value: ClientProfile["experienceLevel"]; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "intern", label: "Past intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

const WORK_MODES: { value: ClientProfile["workMode"]; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}

function errorMessage(body: unknown): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string") return error;
  const fieldErrors = (error as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors;
  const first = fieldErrors && Object.values(fieldErrors).find((messages) => messages?.length);
  return first?.[0] ?? "Couldn't save your profile. Try again.";
}

function Row({ label, htmlFor, helper, children, stacked = false }: { label: string; htmlFor?: string; helper?: ReactNode; children: ReactNode; stacked?: boolean }) {
  return (
    <div className="border-b border-separator px-4 py-3 last:border-b-0">
      <div className={stacked ? "flex flex-col gap-2" : "flex flex-wrap items-center justify-between gap-3"}>
        <label htmlFor={htmlFor} className="text-body text-text">
          {label}
        </label>
        {children}
      </div>
      {helper && <p className="mt-1.5 text-footnote text-text-dim">{helper}</p>}
    </div>
  );
}

export function ProfileSettings({
  initialProfile,
  matchingAvailable,
  initialTheme,
}: {
  initialProfile: ClientProfile | null;
  matchingAvailable: boolean;
  initialTheme: ThemePreference;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(initialProfile ?? EMPTY);
  const [form, setForm] = useState(initialProfile ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(initialTheme);

  const dirty = JSON.stringify({ ...form, hasEmbedding: false }) !== JSON.stringify({ ...saved, hasEmbedding: false });
  const missingRoles = form.targetRoles.length === 0;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (missingRoles) {
      setError("Add at least one target role. Matching needs something to compare against.");
      return;
    }
    setSaving(true);
    setError(null);
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
          singaporePassConfirmed: form.singaporePassConfirmed,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(body));
      const profile = (body as { profile: ClientProfile }).profile;
      setSaved(profile);
      setForm(profile);
      toast({ message: profile.hasEmbedding ? "Profile saved. Discover is re-ranked." : "Profile saved" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-4 py-6 desk:px-8 desk:py-8" noValidate>
      <PageHeader
        title="Profile"
        subtitle="Used to rank internships by how well they match you."
        actions={
          <Button variant="accent" type="submit" disabled={!dirty || saving} icon={saving ? <ActivityIndicator size={14} /> : undefined}>
            {saving ? "Saving" : "Save"}
          </Button>
        }
      />

      {!matchingAvailable && (
        <Notice tone="warning" title="Matching is off">
          VOYAGE_API_KEY isn&apos;t set on the server, so postings aren&apos;t scored. Your profile still saves.
        </Notice>
      )}
      {error && (
        <Notice tone="error" title="Profile not saved">
          {error}
        </Notice>
      )}

      <GroupedSection header="What you're looking for">
        <Row label="Target roles" htmlFor="target-roles" stacked helper="Press Return or a comma after each one.">
          <TokenField
            id="target-roles"
            label="Target roles"
            values={form.targetRoles}
            onChange={(targetRoles) => setForm((f) => ({ ...f, targetRoles }))}
            placeholder="Backend Engineer Intern, Data Engineer Intern"
          />
        </Row>
        <Row label="Skills" htmlFor="skills" stacked>
          <TokenField
            id="skills"
            label="Skills"
            values={form.skills}
            onChange={(skills) => setForm((f) => ({ ...f, skills }))}
            placeholder="Go, PostgreSQL, React"
          />
        </Row>
        <Row label="Experience" htmlFor="experience">
          <PopUpButton
            id="experience"
            value={form.experienceLevel}
            options={LEVELS}
            onChange={(experienceLevel) => setForm((f) => ({ ...f, experienceLevel }))}
            label="Experience"
            className="w-40"
          />
        </Row>
        <Row label="Work mode">
          <SegmentedControl label="Work mode" value={form.workMode} options={WORK_MODES} onChange={(workMode) => setForm((f) => ({ ...f, workMode }))} />
        </Row>
        <Row label="Preferred location" htmlFor="location" stacked>
          <TextField
            id="location"
            value={form.locationPreference}
            onChange={(event) => setForm((f) => ({ ...f, locationPreference: event.target.value }))}
            placeholder="Bandung, Jakarta or remote"
          />
        </Row>
        <Row label="About you" htmlFor="about" stacked helper="A sentence or two gives matching more to go on than tags alone.">
          <TextArea
            id="about"
            rows={3}
            value={form.blurb}
            onChange={(event) => setForm((f) => ({ ...f, blurb: event.target.value }))}
            placeholder="Final-year CS student who likes backend work: Postgres, APIs, and anything with a queue in it."
          />
        </Row>
      </GroupedSection>

      <GroupedSection
        header="Work authorization"
        footer="Only turn this on if your pass is confirmed. Singapore roles that won't sponsor a pass then count as eligible."
      >
        <Row label="I have a Singapore work pass" htmlFor="sg-pass">
          <Switch
            id="sg-pass"
            label="I have a Singapore work pass"
            checked={form.singaporePassConfirmed}
            onChange={(singaporePassConfirmed) => setForm((f) => ({ ...f, singaporePassConfirmed }))}
          />
        </Row>
      </GroupedSection>

      <GroupedSection header="Appearance" footer="System follows your device. This applies right away and is saved in this browser.">
        <Row label="Theme">
          <SegmentedControl
            label="Theme"
            value={theme}
            options={THEMES}
            onChange={(next) => {
              setTheme(next);
              applyTheme(next);
            }}
          />
        </Row>
      </GroupedSection>
    </form>
  );
}
