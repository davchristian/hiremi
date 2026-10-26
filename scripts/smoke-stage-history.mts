// Round-trips a throwaway job through the real database and checks its stage history.
// Usage: npm run smoke:history -- you@example.com
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true, override: true });

const email = process.argv[2];
if (!email) {
  console.error("Pass the email of an existing account.");
  process.exit(1);
}

const { db } = await import("@/db");
const { createJob, deleteJob, listStageEvents, updateJob } = await import("@/lib/jobs");
const { sql } = await import("drizzle-orm");

let jobId: string | null = null;
let userId: string | null = null;
let failed = false;

try {
  const users = await db.execute<{ id: string }>(sql`select id from auth.users where email = ${email}`);
  userId = users[0]?.id ?? null;
  if (!userId) throw new Error(`No account for ${email}`);

  const job = await createJob(userId, { company: "Smoke Test Co", role: "History check" });
  jobId = job.id;
  await updateJob(userId, job.id, { stage: "applied" });
  await updateJob(userId, job.id, { notes: "no stage change" });
  await updateJob(userId, job.id, { stage: "interview" });

  const steps = (await listStageEvents(userId, job.id)).map((event) => `${event.fromStage ?? "∅"}→${event.toStage}`);
  const expected = ["∅→wishlist", "wishlist→applied", "applied→interview"];
  failed = JSON.stringify(steps) !== JSON.stringify(expected);
  console.log(`${failed ? "FAIL" : "ok  "} history: ${steps.join(", ")}`);
} catch (error) {
  failed = true;
  console.error("FAIL", error instanceof Error ? error.message : error);
} finally {
  if (jobId && userId) {
    await deleteJob(userId, jobId);
    const left = await listStageEvents(userId, jobId);
    if (left.length > 0) failed = true;
    console.log(`${left.length === 0 ? "ok  " : "FAIL"} cleanup: job and ${left.length === 0 ? "its history removed" : `${left.length} events left`}`);
  }
  await db.$client.end({ timeout: 5 });
}

process.exit(failed ? 1 : 0);
