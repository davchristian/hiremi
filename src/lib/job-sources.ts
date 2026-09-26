import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobSourceKindEnum, jobSources, type JobSource } from "@/db/schema";
import { acceptsSlug, SOURCE_NEEDS_SLUG } from "@/lib/source-meta";

const rowId = z.guid();

export const createSourceSchema = z
  .object({
    kind: z.enum(jobSourceKindEnum.enumValues),
    slug: z.string().trim().max(120).default(""),
    label: z.string().trim().max(120).default(""),
  })
  .refine((value) => !SOURCE_NEEDS_SLUG[value.kind] || value.slug.length > 0, {
    message: "This source needs the company's board slug",
    path: ["slug"],
  });

export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export function listSources(userId: string): Promise<JobSource[]> {
  return db
    .select()
    .from(jobSources)
    .where(eq(jobSources.userId, userId))
    .orderBy(asc(jobSources.kind), asc(jobSources.slug));
}

export async function createSource(userId: string, input: CreateSourceInput): Promise<JobSource> {
  const slug = SOURCE_NEEDS_SLUG[input.kind]
    ? input.slug.toLowerCase()
    : acceptsSlug(input.kind)
      ? input.slug.trim()
      : "";

  const [source] = await db
    .insert(jobSources)
    .values({ userId, kind: input.kind, slug, label: input.label })
    .onConflictDoUpdate({
      target: [jobSources.userId, jobSources.kind, jobSources.slug],
      set: { enabled: true, label: input.label },
    })
    .returning();

  return source;
}

export async function deleteSource(userId: string, id: string): Promise<boolean> {
  if (!rowId.safeParse(id).success) return false;

  const [deleted] = await db
    .delete(jobSources)
    .where(and(eq(jobSources.id, id), eq(jobSources.userId, userId)))
    .returning({ id: jobSources.id });

  return Boolean(deleted);
}
