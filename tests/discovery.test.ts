import { test } from "node:test";
import assert from "node:assert/strict";
import { isSoftwareInternship } from "@/lib/roles";
import { extractDeadline, extractDuration, extractSeason, seasonIsOver } from "@/lib/posting-hints";
import { companyTier, comparePriority, seasonRank, type Rankable } from "@/lib/priority";

test("software internships pass the relevance filter in several languages", () => {
  for (const title of [
    "Software Engineer Intern",
    "Backend Engineering Internship (Summer 2027)",
    "Data Engineer Co-op",
    "Werkstudent Machine Learning",
    "Magang Software Developer",
    "Kerja Praktik - Web Developer",
    "ソフトウェアエンジニア インターン",
    "Security Engineer Apprenticeship",
  ]) {
    assert.equal(isSoftwareInternship({ title }), true, title);
  }
});

test("an internship counts by employment type when the title doesn't say so", () => {
  assert.equal(isSoftwareInternship({ title: "Software Engineer", employmentType: "Intern" }), true);
  assert.equal(isSoftwareInternship({ title: "Software Engineer", employmentType: "Full-time" }), false);
});

test("a technical department qualifies a generic intern title", () => {
  assert.equal(isSoftwareInternship({ title: "Summer Intern", department: "Engineering" }), true);
  assert.equal(isSoftwareInternship({ title: "Summer Intern", department: "Finance" }), false);
});

test("clearly non-software internships are skipped unless they also say software", () => {
  for (const title of [
    "Marketing Intern",
    "SDR Intern - Munich",
    "Mechanical Engineering Intern",
    "Hardware Engineer Intern",
    "Business Development & Strategy Intern (MBA) - Nearby.ai",
    "Curriculum Development Intern",
    "Internship (Health, Safety, Environment)",
  ]) {
    assert.equal(isSoftwareInternship({ title }), false, title);
  }
  assert.equal(isSoftwareInternship({ title: "Marketing Data Science Intern" }), true);
  assert.equal(isSoftwareInternship({ title: "Hardware-in-the-loop Software Intern" }), true);
});

test("words that merely contain 'intern' don't count", () => {
  assert.equal(isSoftwareInternship({ title: "Internal Tools Engineer" }), false);
  assert.equal(isSoftwareInternship({ title: "International Payments Engineer" }), false);
});

test("deadlines are read from common phrasings", () => {
  const reference = new Date("2026-10-06T00:00:00Z");
  assert.equal(extractDeadline("Applications close: 18 Sep 2026 2359 SGT", reference)?.toISOString(), "2026-09-18T00:00:00.000Z");
  assert.equal(extractDeadline("Applications close March 15, 2027.", reference)?.toISOString(), "2027-03-15T00:00:00.000Z");
  assert.equal(extractDeadline("Please apply by 2027-01-10.", reference)?.toISOString(), "2027-01-10T00:00:00.000Z");
  assert.equal(extractDeadline("Deadline: November 30th", reference)?.toISOString(), "2026-11-30T00:00:00.000Z");
  assert.equal(extractDeadline("Deadline: January 5", reference)?.toISOString(), "2027-01-05T00:00:00.000Z");
  assert.equal(extractDeadline("Join us in March 2027 for a great summer.", reference), null);
});

test("durations and seasons are extracted for display", () => {
  assert.equal(extractDuration("This is a 12-week program"), "12 weeks");
  assert.equal(extractDuration("Duration: 3 to 6 months"), "3-6 months");
  assert.equal(extractDuration("Magang selama 6 bulan"), "6 months");
  assert.equal(extractDuration("No duration here"), null);
  assert.deepEqual(extractSeason("Software Engineer Intern (Summer 2027)"), {
    label: "Summer 2027",
    start: new Date("2027-06-01T00:00:00Z"),
  });
  assert.equal(extractSeason("Autumn '26 placement")?.label, "Fall 2026");
  assert.equal(seasonIsOver(new Date("2026-06-01T00:00:00Z"), new Date("2026-10-06T00:00:00Z")), true);
  assert.equal(seasonIsOver(new Date("2027-06-01T00:00:00Z"), new Date("2026-10-06T00:00:00Z")), false);
});

test("companies are tiered from the config, ignoring legal suffixes", () => {
  assert.equal(companyTier("Google LLC"), 1);
  assert.equal(companyTier("TikTok"), 1);
  assert.equal(companyTier("Grab Holdings Inc."), 2);
  assert.equal(companyTier("PT Xendit Indonesia"), 2);
  assert.equal(companyTier("GitLab"), 3);
  assert.equal(companyTier("Intelligent Systems Co"), 4);
  assert.equal(companyTier(""), 4);
});

test("priority ranks by status, then tier, then target season, then match", () => {
  const now = new Date("2026-10-06T00:00:00Z");
  const base: Rankable = {
    status: "eligible_singapore",
    company: "Unknown Startup",
    season: null,
    seasonStart: null,
    score: 0.5,
    postedAt: null,
  };
  const rows: (Rankable & { name: string })[] = [
    { ...base, name: "tier 4" },
    { ...base, name: "tier 1", company: "Google" },
    { ...base, name: "remote", status: "eligible_remote" },
    { ...base, name: "target season", season: "Summer 2027", seasonStart: new Date("2027-06-01T00:00:00Z") },
    { ...base, name: "past season", season: "Summer 2026", seasonStart: new Date("2026-06-01T00:00:00Z"), score: 0.9 },
    { ...base, name: "better match", score: 0.7 },
    { ...base, name: "check", status: "check_manually", company: "Google" },
  ];
  rows.sort((a, b) => comparePriority(a, b, now));
  assert.deepEqual(
    rows.map((row) => row.name),
    ["remote", "tier 1", "target season", "better match", "tier 4", "past season", "check"],
  );
  assert.equal(seasonRank("Summer 2027", new Date("2027-06-01T00:00:00Z"), now), 0);
  assert.equal(seasonRank(null, null, now), 1);
});
