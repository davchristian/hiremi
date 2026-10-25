import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobStageEvents, jobs, stageEnum, type Job, type JobStageEvent } from "@/db/schema";
import type { Stage } from "@/lib/stage";

const calendarDate = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));

const rowId = z.guid();

const DAY_MS = 24 * 60 * 60 * 1000;

export const FOLLOW_UP_AFTER_DAYS = 7;

export const createJobSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  stage: z.enum(stageEnum.enumValues).optional(),
  appliedDate: calendarDate.optional().nullable(),
  followUpDate: calendarDate.optional().nullable(),
  link: z.string().trim().url().max(2000).optional().or(z.literal("")).nullable(),
  notes: z.string().max(10_000).optional(),
  listingId: z.string().uuid().optional().nullable(),
});

export const updateJobSchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  role: z.string().trim().min(1).max(200).optional(),
  stage: z.enum(stageEnum.enumValues).optional(),
  appliedDate: calendarDate.optional().nullable(),
  followUpDate: calendarDate.optional().nullable(),
  link: z.string().trim().url().max(2000).optional().or(z.literal("")).nullable(),
  notes: z.string().max(10_000).optional(),
});

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function followUpAfterApplying(appliedDate: Date): Date {
  return new Date(appliedDate.getTime() + FOLLOW_UP_AFTER_DAYS * DAY_MS);
}

export function stageEventFor(
  previous: Stage | null,
  next: Stage | undefined,
): { fromStage: Stage | null; toStage: Stage } | null {
  if (next === undefined || next === previous) return null;
  return { fromStage: previous, toStage: next };
}

export function listJobs(userId: string): Promise<Job[]> {
  return db.query.jobs.findMany({
    where: eq(jobs.userId, userId),
    orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
  });
}

export async function createJob(
  userId: string,
  input: z.infer<typeof createJobSchema>,
): Promise<Job> {
  const stage = input.stage ?? "wishlist";
  const appliedDate = input.appliedDate ?? (stage === "applied" ? utcToday() : null);
  const followUpDate =
    input.followUpDate !== undefined
      ? input.followUpDate
      : stage === "applied" && appliedDate
        ? followUpAfterApplying(appliedDate)
        : null;

  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(jobs)
      .values({
        userId,
        company: input.company,
        role: input.role,
        stage,
        appliedDate,
        followUpDate,
        link: input.link || null,
        notes: input.notes ?? "",
        listingId: input.listingId ?? null,
      })
      .returning();

    await tx.insert(jobStageEvents).values({ jobId: job.id, userId, fromStage: null, toStage: stage });
    return job;
  });
}

export async function updateJob(
  userId: string,
  id: string,
  input: z.infer<typeof updateJobSchema>,
): Promise<Job | null> {
  if (!rowId.safeParse(id).success) return null;

  const existing = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, id), eq(jobs.userId, userId)),
  });
  if (!existing) return null;

  const appliedDate =
    input.appliedDate !== undefined
      ? input.appliedDate
      : input.stage === "applied" && !existing.appliedDate
        ? utcToday()
        : undefined;

  const followUpDate =
    input.followUpDate !== undefined
      ? input.followUpDate
      : input.stage === "applied" && existing.stage !== "applied" && !existing.followUpDate
        ? followUpAfterApplying(appliedDate ?? existing.appliedDate ?? utcToday())
        : undefined;

  const event = stageEventFor(existing.stage, input.stage);

  return db.transaction(async (tx) => {
    const [job] = await tx
      .update(jobs)
      .set({
        ...(input.company !== undefined && { company: input.company }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.stage !== undefined && { stage: input.stage }),
        ...(appliedDate !== undefined && { appliedDate }),
        ...(followUpDate !== undefined && { followUpDate }),
        ...(input.link !== undefined && { link: input.link || null }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();

    if (job && event) await tx.insert(jobStageEvents).values({ jobId: id, userId, ...event });
    return job ?? null;
  });
}

export async function deleteJob(userId: string, id: string): Promise<boolean> {
  if (!rowId.safeParse(id).success) return false;

  const [deleted] = await db
    .delete(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .returning({ id: jobs.id });

  return Boolean(deleted);
}

export async function listStageEvents(userId: string, jobId: string): Promise<JobStageEvent[]> {
  if (!rowId.safeParse(jobId).success) return [];

  return db.query.jobStageEvents.findMany({
    where: and(eq(jobStageEvents.jobId, jobId), eq(jobStageEvents.userId, userId)),
    orderBy: (events, { asc }) => [asc(events.createdAt)],
  });
}
