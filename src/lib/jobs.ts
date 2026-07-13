import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, stageEnum, type Job } from "@/db/schema";

export const createJobSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  stage: z.enum(stageEnum.enumValues).optional(),
  appliedDate: z.coerce.date().optional().nullable(),
  link: z.string().trim().url().max(2000).optional().or(z.literal("")).nullable(),
  notes: z.string().max(10_000).optional(),
});

export const updateJobSchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  role: z.string().trim().min(1).max(200).optional(),
  stage: z.enum(stageEnum.enumValues).optional(),
  appliedDate: z.coerce.date().optional().nullable(),
  link: z.string().trim().url().max(2000).optional().or(z.literal("")).nullable(),
  notes: z.string().max(10_000).optional(),
});

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
  const appliedDate = input.appliedDate ?? (stage === "applied" ? new Date() : null);

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
    })
    .returning();

  return job;
}

export async function updateJob(
  userId: string,
  id: string,
  input: z.infer<typeof updateJobSchema>,
): Promise<Job | null> {
  const existing = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, id), eq(jobs.userId, userId)),
  });
  if (!existing) return null;

  // Auto-fill today's date the first time a job moves into "applied".
  const appliedDate =
    input.appliedDate !== undefined
      ? input.appliedDate
      : input.stage === "applied" && !existing.appliedDate
        ? new Date()
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

  return job;
}

export async function deleteJob(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .returning({ id: jobs.id });

  return Boolean(deleted);
}
