import { test } from "node:test";
import assert from "node:assert/strict";
import { stageEventFor } from "@/lib/jobs";
import { toClientStageEvent } from "@/lib/types";

test("creating a job records its first stage with no previous stage", () => {
  assert.deepEqual(stageEventFor(null, "wishlist"), { fromStage: null, toStage: "wishlist" });
});

test("a stage change records where the job came from", () => {
  assert.deepEqual(stageEventFor("applied", "interview"), { fromStage: "applied", toStage: "interview" });
  assert.deepEqual(stageEventFor("interview", "applied"), { fromStage: "interview", toStage: "applied" });
});

test("edits that keep the stage or leave it out record nothing", () => {
  assert.equal(stageEventFor("applied", "applied"), null);
  assert.equal(stageEventFor("applied", undefined), null);
});

test("stage events reach the client with ISO dates and a null start", () => {
  const event = toClientStageEvent({
    id: "b1e2c3d4-0000-4000-8000-000000000001",
    jobId: "a3f9c1e2-0000-4000-8000-000000000001",
    userId: "c0ffee00-0000-4000-8000-000000000001",
    fromStage: null,
    toStage: "wishlist",
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
  });
  assert.deepEqual(event, {
    id: "b1e2c3d4-0000-4000-8000-000000000001",
    fromStage: null,
    toStage: "wishlist",
    createdAt: "2026-09-01T08:00:00.000Z",
  });
});
