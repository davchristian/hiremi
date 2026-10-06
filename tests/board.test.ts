import { test } from "node:test";
import assert from "node:assert/strict";
import { isFollowUpDue, isStale, nextStage, previousStage, STALE_AFTER_DAYS } from "@/lib/stage";
import {
  addDaysISODate,
  ageLabel,
  isoDateToTimestamp,
  parseISODate,
  shortId,
  startOfUtcWeek,
  timeAgo,
  toISODate,
  weeksBetween,
} from "@/lib/format";
import { jobsToCsv } from "@/lib/csv";
import {
  isPendingJob,
  pendingJobId,
  toClientJob,
  toClientProfile,
  type ClientJob,
} from "@/lib/types";

function utcDaysAgo(days: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days),
  ).toISOString();
}

function clientJob(overrides: Partial<ClientJob> = {}): ClientJob {
  return {
    id: "a3f9c1e2-0000-4000-8000-000000000001",
    company: "Xendit",
    role: "Platform Engineer",
    stage: "applied",
    appliedDate: "2026-09-27T00:00:00.000Z",
    followUpDate: null,
    link: null,
    notes: "",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-26T08:00:00.000Z",
    ...overrides,
  };
}

test("cards move forward through the pipeline and stop at offer or rejected", () => {
  assert.equal(nextStage("wishlist"), "applied");
  assert.equal(nextStage("applied"), "interview");
  assert.equal(nextStage("interview"), "offer");
  assert.equal(nextStage("offer"), null);
  assert.equal(nextStage("rejected"), null);
});

test("cards move back one stage at a time", () => {
  assert.equal(previousStage("wishlist"), null);
  assert.equal(previousStage("applied"), "wishlist");
  assert.equal(previousStage("interview"), "applied");
});

test("an application goes stale after 14 days in applied", () => {
  assert.equal(STALE_AFTER_DAYS, 14);
  assert.equal(isStale({ stage: "applied", appliedDate: utcDaysAgo(14) }), true);
  assert.equal(isStale({ stage: "applied", appliedDate: utcDaysAgo(13) }), false);
});

test("staleness counts from the applied date, not the last edit", () => {
  const job = clientJob({ appliedDate: utcDaysAgo(30), updatedAt: new Date().toISOString() });
  assert.equal(isStale(job), true);
});

test("only applications still waiting in applied can be stale", () => {
  assert.equal(isStale({ stage: "interview", appliedDate: utcDaysAgo(40) }), false);
  assert.equal(isStale({ stage: "applied", appliedDate: null }), false);
});

test("short ids are seven hex characters, like a commit hash", () => {
  assert.equal(shortId("a3f9c1e2-0000-4000-8000-000000000001"), "a3f9c1e");
});

test("ages read like git log", () => {
  assert.deepEqual(
    [-1, 0, 1, 3, 29, 30, 45, 400].map(ageLabel),
    ["today", "today", "1d ago", "3d ago", "29d ago", "1mo ago", "1mo ago", "1y ago"],
  );
});

test("source fetch times read in minutes, then hours, then days", () => {
  const now = Date.now();
  assert.equal(timeAgo(new Date(now)), "just now");
  assert.equal(timeAgo(new Date(now - 5 * 60_000)), "5m ago");
  assert.equal(timeAgo(new Date(now - 3 * 3_600_000)), "3h ago");
  assert.equal(timeAgo(new Date(now - 2 * 86_400_000)), "2d ago");
});

test("calendar dates become UTC midnight without shifting through local time", () => {
  assert.equal(isoDateToTimestamp("2026-09-27"), "2026-09-27T00:00:00.000Z");
  assert.equal(isoDateToTimestamp("2026-09-27T15:00:00.000Z"), "2026-09-27T00:00:00.000Z");
});

test("date picker values round-trip through local dates", () => {
  const date = parseISODate("2026-02-28");
  assert.ok(date);
  assert.equal(toISODate(date), "2026-02-28");
  assert.equal(parseISODate("garbage"), undefined);
});

test("weekly stats bucket by UTC weeks that start on Sunday", () => {
  const saturdayNight = startOfUtcWeek(new Date("2026-09-26T23:00:00Z"));
  assert.equal(new Date(saturdayNight).toISOString(), "2026-09-20T00:00:00.000Z");
  const sundayMidnight = startOfUtcWeek(new Date("2026-09-20T00:00:00Z"));
  assert.equal(sundayMidnight, saturdayNight);
  const earlySeptember = startOfUtcWeek(new Date("2026-09-01T00:00:00Z"));
  assert.equal(weeksBetween(earlySeptember, saturdayNight), 3);
});

test("the CSV export has a header row and quotes awkward fields", () => {
  const csv = jobsToCsv([
    clientJob({
      company: 'Acme, "Inc"',
      notes: "line one\nline two",
      followUpDate: "2026-10-04T00:00:00.000Z",
    }),
  ]);
  const header = csv.slice(0, csv.indexOf("\n"));
  assert.equal(
    header,
    "id,company,role,stage,applied_date,follow_up_date,link,notes,created_at,updated_at",
  );
  assert.ok(csv.includes('"Acme, ""Inc"""'));
  assert.ok(csv.includes('"line one\nline two"'));
  assert.ok(csv.includes(",applied,2026-09-27,2026-10-04,,"));
});

test("client profiles never carry the embedding", () => {
  const profile = toClientProfile({
    id: "p",
    userId: "u",
    targetRoles: ["Backend Engineer"],
    skills: [],
    experienceLevel: "student",
    locationPreference: null,
    workMode: "any",
    blurb: null,
    singaporePassConfirmed: false,
    embedding: [0.1, 0.2],
    embeddingSource: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal("embedding" in profile, false);
  assert.equal("embeddingSource" in profile, false);
  assert.equal(profile.hasEmbedding, true);
  assert.equal(profile.locationPreference, "");
});

test("client jobs carry ISO strings and never leak the owner id", () => {
  const job = toClientJob({
    id: "a3f9c1e2-0000-4000-8000-000000000001",
    userId: "11111111-1111-4111-8111-111111111111",
    company: "Grab",
    role: "SWE",
    stage: "applied",
    appliedDate: new Date("2026-09-27T00:00:00.000Z"),
    followUpDate: new Date("2026-10-04T00:00:00.000Z"),
    link: null,
    notes: null,
    listingId: null,
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
    updatedAt: new Date("2026-09-02T08:00:00.000Z"),
  });
  assert.equal(job.appliedDate, "2026-09-27T00:00:00.000Z");
  assert.equal(job.followUpDate, "2026-10-04T00:00:00.000Z");
  assert.equal(job.notes, "");
  assert.equal("userId" in job, false);
});

test("optimistic cards are recognisable until the server confirms them", () => {
  assert.equal(isPendingJob({ id: pendingJobId() }), true);
  assert.equal(isPendingJob({ id: "a3f9c1e2-0000-4000-8000-000000000001" }), false);
});

test("a follow-up is due on its date and every day after", () => {
  const job = clientJob({ followUpDate: "2026-10-03T00:00:00.000Z" });
  assert.equal(isFollowUpDue(job, "2026-10-02"), false);
  assert.equal(isFollowUpDue(job, "2026-10-03"), true);
  assert.equal(isFollowUpDue(job, "2026-10-20"), true);
});

test("no follow-up is due without a date or once the application is settled", () => {
  assert.equal(isFollowUpDue(clientJob(), "2026-10-03"), false);
  const overdue = { followUpDate: "2026-09-01T00:00:00.000Z" };
  assert.equal(isFollowUpDue(clientJob({ ...overdue, stage: "interview" }), "2026-10-03"), true);
  assert.equal(isFollowUpDue(clientJob({ ...overdue, stage: "offer" }), "2026-10-03"), false);
  assert.equal(isFollowUpDue(clientJob({ ...overdue, stage: "rejected" }), "2026-10-03"), false);
});

test("snoozing adds calendar days across month and year ends", () => {
  assert.equal(addDaysISODate("2026-10-28", 7), "2026-11-04");
  assert.equal(addDaysISODate("2026-12-29", 7), "2027-01-05");
});
