import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobSourceKindEnum, jobSources, type JobSource } from "@/db/schema";
import { adapterFor } from "@/lib/sources";
import {
  acceptsSlug,
  parseBoardInput,
  SOURCE_LABELS,
  SOURCE_NEEDS_SLUG,
  SOURCE_SLUG_DEFAULTS,
  type JobSourceKind,
} from "@/lib/source-meta";

const rowId = z.guid();

export const createSourceSchema = z
  .object({
    kind: z.enum(jobSourceKindEnum.enumValues).refine((kind) => kind !== "web", "Pick a job board"),
    slug: z.string().trim().max(300).default(""),
    label: z.string().trim().max(120).default(""),
  })
  .transform((value) => {
    const parsed = parseBoardInput(value.slug);
    return parsed ? { ...value, ...parsed } : value;
  })
  .refine((value) => !SOURCE_NEEDS_SLUG[value.kind] || value.slug.length > 0, {
    message: "Enter the board name or paste the board URL",
    path: ["slug"],
  });

export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export class SourceNotFoundError extends Error {}

export function listSources(userId: string): Promise<JobSource[]> {
  return db
    .select()
    .from(jobSources)
    .where(or(eq(jobSources.userId, userId), isNull(jobSources.userId)))
    .orderBy(desc(sql`${jobSources.userId} is not null`), asc(jobSources.kind), asc(jobSources.slug));
}

export function normalizeSlug(kind: JobSourceKind, slug: string): string {
  if (!acceptsSlug(kind)) return "";
  const trimmed = slug.trim();
  if (SOURCE_NEEDS_SLUG[kind]) return trimmed.toLowerCase();
  return trimmed || SOURCE_SLUG_DEFAULTS[kind] || "";
}

export async function resolveSourceName(kind: JobSourceKind, slug: string): Promise<string> {
  try {
    return await adapterFor(kind).resolveName(slug);
  } catch {
    throw new SourceNotFoundError(`Couldn't find a ${SOURCE_LABELS[kind]} board named "${slug}". Check the name or paste the board URL.`);
  }
}

export async function createSource(userId: string, input: CreateSourceInput): Promise<JobSource> {
  const slug = normalizeSlug(input.kind, input.slug);
  const label = input.label || (await resolveSourceName(input.kind, slug));

  const [source] = await db
    .insert(jobSources)
    .values({ userId, kind: input.kind, slug, label })
    .onConflictDoUpdate({
      target: [jobSources.userId, jobSources.kind, jobSources.slug],
      set: { enabled: true, label },
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
