import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { experienceLevelEnum, profiles, workModeEnum, type Profile } from "@/db/schema";
import { embedOne, embeddingFingerprint, isEmbeddingConfigured } from "@/lib/embeddings";

export const profileSchema = z.object({
  targetRoles: z
    .array(z.string().trim().min(1).max(120))
    .min(1, "Add at least one target role")
    .max(20),
  skills: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  experienceLevel: z.enum(experienceLevelEnum.enumValues).default("student"),
  locationPreference: z.string().trim().max(200).default(""),
  workMode: z.enum(workModeEnum.enumValues).default("any"),
  blurb: z.string().trim().max(2000).default(""),
  singaporePassConfirmed: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export function profileEmbeddingText(profile: ProfileInput): string {
  return [
    profile.targetRoles.length ? `Target roles: ${profile.targetRoles.join(", ")}` : "",
    profile.skills.length ? `Skills: ${profile.skills.join(", ")}` : "",
    `Experience level: ${profile.experienceLevel}`,
    profile.locationPreference ? `Location preference: ${profile.locationPreference}` : "",
    `Work mode: ${profile.workMode}`,
    profile.blurb,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return profile ?? null;
}

export async function upsertProfile(userId: string, input: ProfileInput): Promise<Profile> {
  const text = profileEmbeddingText(input);
  const fingerprint = embeddingFingerprint(text);

  const existing = await getProfile(userId);
  const current =
    existing?.embedding && existing.embeddingSource === fingerprint ? existing.embedding : null;
  const embedding =
    current ?? (isEmbeddingConfigured() ? await embedOne(text, "query") : null);
  const embeddingSource = embedding ? fingerprint : null;

  const [profile] = await db
    .insert(profiles)
    .values({ userId, ...input, embedding, embeddingSource })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...input, embedding, embeddingSource, updatedAt: new Date() },
    })
    .returning();

  return profile;
}
