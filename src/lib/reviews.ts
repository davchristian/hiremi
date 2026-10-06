import { z } from "zod";
import { db } from "@/db";
import { eligibilityEnum, jobListings, listingReviews, type ListingReview } from "@/db/schema";
import { eq } from "drizzle-orm";

const rowId = z.guid();

export const reviewSchema = z
  .object({
    status: z.enum(eligibilityEnum.enumValues).nullable().optional(),
    approved: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.approved !== undefined, {
    message: "Send a status or an approval",
  });

export type ReviewInput = z.infer<typeof reviewSchema>;

export async function saveReview(userId: string, listingId: string, input: ReviewInput): Promise<ListingReview | null> {
  if (!rowId.safeParse(listingId).success) return null;
  const [listing] = await db.select({ id: jobListings.id }).from(jobListings).where(eq(jobListings.id, listingId));
  if (!listing) return null;

  const changes = {
    ...(input.status !== undefined && { status: input.status }),
    ...(input.approved !== undefined && { approved: input.approved }),
  };

  const [review] = await db
    .insert(listingReviews)
    .values({ userId, listingId, status: input.status ?? null, approved: input.approved ?? false })
    .onConflictDoUpdate({
      target: [listingReviews.userId, listingReviews.listingId],
      set: { ...changes, updatedAt: new Date() },
    })
    .returning();

  return review;
}
