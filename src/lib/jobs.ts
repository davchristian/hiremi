import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, stageEnum, type Job } from "@/db/schema";

const calendarDate = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));

const rowId = z.guid();

export const createJobSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  stage: z.enum(stageEnum.enumValues).optional(),
  appliedDate: calendarDate.optional().nullable(),
  link: z.string().trim().url().max(2000).optional().or(z.literal("")).nullable(),
  notes: z.string().max(10_000).optional(),
  listingId: z.string().uuid().optional().nullable(),
});

export const updateJobSchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  role: z.string().trim().min(1).max(200).optional(),
  stage: z.enum(stageEnum.enumValues).optional(),
  appliedDate: calendarDate.optional().nullable(),
  link: z.string().trim().url().max(2000).optional().or(z.literal("")).nullable(),
  notes: z.string().max(10_000).optional(),
});

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      company: input.company,
      role: input.role,
      stage,
      appliedDate,
      link: input.link || null,
      notes: input.notes ?? "",
      listingId: input.listingId ?? null,
    })
    .returning();

  return job;
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

  const [job] = await db
    .update(jobs)
    .set({
      ...(input.company !== undefined && { company: input.company }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.stage !== undefined && { stage: input.stage }),
      ...(appliedDate !== undefined && { appliedDate }),
      ...(input.link !== undefined && { link: input.link || null }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .returning();

  return job ?? null;
}

export async function deleteJob(userId: string, id: string): Promise<boolean> {
  if (!rowId.safeParse(id).success) return false;

  const [deleted] = await db
    .delete(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .returning({ id: jobs.id });

  return Boolean(deleted);
}
