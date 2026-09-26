import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobListings, jobs, type Job, type Profile } from "@/db/schema";
import { INDONESIA_SQL_PATTERN, isIndonesia } from "@/lib/location";
import type { JobSourceKind } from "@/lib/sources";

const SNIPPET_CHARS = 320;
const HNSW_EF_SEARCH = 400;

export type FeedMatch = {
  id: string;
  source: JobSourceKind;
  company: string;
  title: string;
  snippet: string;
  location: string;
  remote: boolean;
  url: string;
  postedAt: string | null;
  score: number | null;
  matchedTerms: string[];
  indonesia: boolean;
  trackedJobId: string | null;
};

export type FeedOptions = {
  limit?: number;
  query?: string;
  remoteOnly?: boolean;
  hideTracked?: boolean;
  indonesiaOnly?: boolean;
};

function snippet(description: string): string {
  const clean = description.replace(/\s+/g, " ").trim();
  return clean.length > SNIPPET_CHARS ? `${clean.slice(0, SNIPPET_CHARS)}…` : clean;
}

function matchedTerms(profile: Profile, title: string, description: string): string[] {
  const haystack = `${title} ${description}`.toLowerCase();
  const terms = [...profile.targetRoles, ...profile.skills];
  const hits = terms.filter((term) => term.length > 1 && haystack.includes(term.toLowerCase()));
  return [...new Set(hits)].slice(0, 6);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function matchListings(
  userId: string,
  profile: Profile | null,
  options: FeedOptions = {},
): Promise<FeedMatch[]> {
  const { limit = 40, query, remoteOnly, hideTracked, indonesiaOnly } = options;
  const vector = profile?.embedding ? JSON.stringify(profile.embedding) : null;
  const text = query?.trim();

  const filters: (SQL | undefined)[] = [];
  if (vector) filters.push(isNotNull(jobListings.embedding));
  if (remoteOnly) filters.push(eq(jobListings.remote, true));
  if (hideTracked) filters.push(isNull(jobs.id));
  if (indonesiaOnly) {
    filters.push(
      sql`(${jobListings.location} || ' ' || ${jobListings.title}) ~* ${INDONESIA_SQL_PATTERN}`,
    );
  }
  if (text) {
    const pattern = `%${escapeLike(text)}%`;
    filters.push(or(ilike(jobListings.title, pattern), ilike(jobListings.company, pattern)));
  }

  const distance = sql<number>`${jobListings.embedding} <=> ${vector}::vector`;

  const rows = await db.transaction(async (tx) => {
    if (vector) {
      await tx.execute(sql`select set_config('hnsw.ef_search', ${String(HNSW_EF_SEARCH)}, true)`);
    }

    return tx
      .select({
        id: jobListings.id,
        source: jobListings.source,
        company: jobListings.company,
        title: jobListings.title,
        description: jobListings.description,
        location: jobListings.location,
        remote: jobListings.remote,
        url: jobListings.url,
        postedAt: jobListings.postedAt,
        distance: vector ? distance : sql<number | null>`null::double precision`,
        trackedJobId: jobs.id,
      })
      .from(jobListings)
      .leftJoin(jobs, and(eq(jobs.listingId, jobListings.id), eq(jobs.userId, userId)))
      .where(and(...filters))
      .orderBy(vector ? asc(distance) : sql`${jobListings.postedAt} desc nulls last`)
      .limit(limit);
  });

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    company: row.company,
    title: row.title,
    snippet: snippet(row.description),
    location: row.location,
    remote: row.remote,
    url: row.url,
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    score: row.distance === null ? null : 1 - Number(row.distance),
    matchedTerms: profile ? matchedTerms(profile, row.title, row.description) : [],
    indonesia: isIndonesia(row.location, row.title),
    trackedJobId: row.trackedJobId,
  }));
}

export async function addListingsToBoard(userId: string, listingIds: string[]): Promise<Job[]> {
  if (listingIds.length === 0) return [];

  const listings = await db
    .select()
    .from(jobListings)
    .where(inArray(jobListings.id, listingIds));
  if (listings.length === 0) return [];

  const tracked = await db
    .select({ listingId: jobs.listingId })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), inArray(jobs.listingId, listings.map((l) => l.id))));
  const alreadyTracked = new Set(tracked.map((row) => row.listingId));

  const toInsert = listings
    .filter((listing) => !alreadyTracked.has(listing.id))
    .map((listing) => ({
      userId,
      company: listing.company,
      role: listing.title,
      stage: "wishlist" as const,
      link: listing.url,
      notes: "",
      listingId: listing.id,
    }));

  if (toInsert.length === 0) return [];
  return db.insert(jobs).values(toInsert).returning();
}
