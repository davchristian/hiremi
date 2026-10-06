import { test } from "node:test";
import assert from "node:assert/strict";
import { jobSourceKindEnum } from "@/db/schema";
import {
  createJobSchema,
  FOLLOW_UP_AFTER_DAYS,
  followUpAfterApplying,
  updateJobSchema,
} from "@/lib/jobs";
import { profileEmbeddingText, profileSchema } from "@/lib/profile";
import { createSourceSchema, normalizeSlug } from "@/lib/job-sources";
import { acceptsSlug, SOURCE_KINDS } from "@/lib/source-meta";

test("applied dates are calendar dates stored as UTC midnight", () => {
  const parsed = createJobSchema.parse({ company: "Grab", role: "SWE", appliedDate: "2026-09-27" });
  assert.equal(parsed.appliedDate?.toISOString(), "2026-09-27T00:00:00.000Z");
});

test("impossible dates and full timestamps are rejected", () => {
  const base = { company: "Grab", role: "SWE" };
  assert.equal(createJobSchema.safeParse({ ...base, appliedDate: "2026-02-30" }).success, false);
  assert.equal(
    createJobSchema.safeParse({ ...base, appliedDate: "2026-09-27T10:00:00Z" }).success,
    false,
  );
});

test("company and role are required and trimmed", () => {
  assert.equal(createJobSchema.safeParse({ company: "   ", role: "SWE" }).success, false);
  assert.equal(createJobSchema.safeParse({ company: "Grab" }).success, false);
  const parsed = createJobSchema.parse({ company: " Grab ", role: " SWE " });
  assert.equal(parsed.company, "Grab");
  assert.equal(parsed.role, "SWE");
});

test("stages outside the pipeline are rejected", () => {
  assert.equal(createJobSchema.safeParse({ company: "a", role: "b", stage: "hired" }).success, false);
});

test("links must be URLs, and an empty link or date clears the field", () => {
  assert.equal(createJobSchema.safeParse({ company: "a", role: "b", link: "not a url" }).success, false);
  assert.equal(updateJobSchema.parse({ link: "" }).link, "");
  assert.equal(updateJobSchema.parse({ appliedDate: null }).appliedDate, null);
});

test("a profile needs at least one target role", () => {
  assert.equal(profileSchema.safeParse({ skills: ["Go"] }).success, false);
  assert.equal(profileSchema.safeParse({ targetRoles: [] }).success, false);
  assert.equal(profileSchema.safeParse({ targetRoles: ["  "] }).success, false);
});

test("profile defaults fill in every optional field", () => {
  assert.deepEqual(profileSchema.parse({ targetRoles: ["Backend Engineer"] }), {
    targetRoles: ["Backend Engineer"],
    skills: [],
    experienceLevel: "student",
    locationPreference: "",
    workMode: "any",
    blurb: "",
    singaporePassConfirmed: false,
  });
});

test("the profile embedding text labels each field and skips empty ones", () => {
  const profile = profileSchema.parse({
    targetRoles: ["Backend Engineer", "SRE"],
    skills: ["Go"],
    workMode: "remote",
  });
  assert.equal(
    profileEmbeddingText(profile),
    "Target roles: Backend Engineer, SRE\nSkills: Go\nExperience level: student\nWork mode: remote",
  );
});

test("company boards need a board name", () => {
  for (const kind of ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "catapa"] as const) {
    assert.equal(createSourceSchema.safeParse({ kind, slug: "" }).success, false, kind);
    assert.equal(createSourceSchema.safeParse({ kind, slug: "xendit" }).success, true, kind);
  }
});

test("a pasted board URL picks the platform and board name", () => {
  const parsed = createSourceSchema.parse({ kind: "greenhouse", slug: "https://jobs.lever.co/ninjavan" });
  assert.equal(parsed.kind, "lever");
  assert.equal(parsed.slug, "ninjavan");
});

test("aggregators take an optional filter and fall back to a default", () => {
  assert.equal(createSourceSchema.safeParse({ kind: "themuse" }).success, true);
  assert.equal(acceptsSlug("himalayas"), true);
  assert.equal(normalizeSlug("himalayas", " "), "Indonesia");
  assert.equal(normalizeSlug("themuse", ""), "Software Engineering");
  assert.equal(normalizeSlug("greenhouse", " Xendit "), "xendit");
});

test("imported pages are not a source you can subscribe to", () => {
  assert.equal(createSourceSchema.safeParse({ kind: "web", slug: "x" }).success, false);
});

test("the source picker offers every board kind the database accepts", () => {
  assert.deepEqual(
    [...SOURCE_KINDS].sort(),
    jobSourceKindEnum.enumValues.filter((kind) => kind !== "web").sort(),
  );
});

test("follow-up dates are calendar dates and null clears the reminder", () => {
  const parsed = updateJobSchema.parse({ followUpDate: "2026-10-10" });
  assert.equal(parsed.followUpDate?.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(updateJobSchema.parse({ followUpDate: null }).followUpDate, null);
  assert.equal(updateJobSchema.safeParse({ followUpDate: "next week" }).success, false);
});

test("applying sets the follow-up a week after the applied date", () => {
  assert.equal(FOLLOW_UP_AFTER_DAYS, 7);
  const followUp = followUpAfterApplying(new Date("2026-12-28T00:00:00.000Z"));
  assert.equal(followUp.toISOString(), "2027-01-04T00:00:00.000Z");
});
