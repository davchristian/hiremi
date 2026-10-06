import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobListings, jobs, listingReviews, type Job, type Profile } from "@/db/schema";
import { STATUS_LABELS, singaporeNote, type Eligibility } from "@/lib/eligibility";
import { INDONESIA_SQL_PATTERN, isIndonesia } from "@/lib/location";
import { comparePriority, companyTier } from "@/lib/priority";
import { markdownToText } from "@/lib/sources";
import type { JobSourceKind } from "@/lib/source-meta";

const SNIPPET_CHARS = 320;
const HNSW_EF_SEARCH = 400;
const DEFAULT_FEED_LIMIT = 40;
const MAX_FEED_LIMIT = 100;
const PRIORITY_POOL = 400;

export const FEED_SORTS = ["priority", "match", "newest"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export type FeedMatch = {
  id: string;
  source: JobSourceKind;
  company: string;
  title: string;
  snippet: string;
  location: string;
  workplace: string;
  remote: boolean;
  url: string;
  postedAt: string | null;
  deadline: string | null;
  duration: string | null;
  season: string | null;
  score: number | null;
  matchedTerms: string[];
  indonesia: boolean;
  status: Eligibility;
  statusLabel: string;
  reason: string | null;
  quote: string | null;
  workAuthorizationNote: string | null;
  overlapNote: string | null;
  overridden: boolean;
  approved: boolean;
  tier: number;
  trackedJobId: string | null;
};

export type FeedOptions = {
  limit?: number;
  query?: string;
  remoteOnly?: boolean;
  hideTracked?: boolean;
  indonesiaOnly?: boolean;
  statuses?: Eligibility[];
  includeExcluded?: boolean;
  sort?: FeedSort;
};

export function parseFeedLimit(value: string | null): number {
  const limit = Number(value);
  if (!value || !Number.isFinite(limit)) return DEFAULT_FEED_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_FEED_LIMIT);
}

export function parseFeedSort(value: string | null): FeedSort {
  return FEED_SORTS.includes(value as FeedSort) ? (value as FeedSort) : "priority";
}

function snippet(description: string): string {
  const clean = markdownToText(description);
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

export function effectiveStatusSql(singaporePass: boolean): SQL<Eligibility | null> {
  const computed = singaporePass ? jobListings.eligibilityWithPass : jobListings.eligibility;
  return sql<Eligibility | null>`coalesce(${listingReviews.status}, ${computed})`;
}

export function buildFeedQuery(
  executor: Pick<typeof db, "select">,
  userId: string,
  profile: Profile | null,
  options: FeedOptions = {},
) {
  const { limit = DEFAULT_FEED_LIMIT, query, remoteOnly, hideTracked, indonesiaOnly, sort = "priority" } = options;
  const vector = profile?.embedding ? JSON.stringify(profile.embedding) : null;
  const text = query?.trim();
  const status = effectiveStatusSql(Boolean(profile?.singaporePassConfirmed));

  const filters: (SQL | undefined)[] = [isNull(jobListings.closedAt), isNotNull(status)];
  if (!options.includeExcluded) filters.push(sql`${status} <> 'excluded'`);
  if (options.statuses?.length) filters.push(inArray(status, options.statuses));
  if (vector && sort === "match") filters.push(isNotNull(jobListings.embedding));
  if (remoteOnly) filters.push(eq(jobListings.workplace, "remote"));
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
  const order =
    sort === "match" && vector
      ? asc(distance)
      : sql`${jobListings.postedAt} desc nulls last`;

  return executor
    .select({
      id: jobListings.id,
      source: jobListings.source,
      company: jobListings.company,
      title: jobListings.title,
      description: jobListings.description,
      location: jobListings.location,
      workplace: jobListings.workplace,
      remote: jobListings.remote,
      url: jobListings.url,
      postedAt: jobListings.postedAt,
      deadline: jobListings.deadline,
      duration: jobListings.duration,
      season: jobListings.season,
      seasonStart: jobListings.seasonStart,
      computedStatus: jobListings.eligibility,
      status,
      reason: jobListings.eligibilityReason,
      quote: jobListings.eligibilityQuote,
      workAuthorizationNote: jobListings.workAuthorizationNote,
      overlapNote: jobListings.overlapNote,
      overridden: sql<boolean>`${listingReviews.status} is not null`,
      approved: sql<boolean>`coalesce(${listingReviews.approved}, false)`,
      distance: vector ? distance : sql<number | null>`null::double precision`,
      trackedJobId: jobs.id,
    })
    .from(jobListings)
    .leftJoin(jobs, and(eq(jobs.listingId, jobListings.id), eq(jobs.userId, userId)))
    .leftJoin(listingReviews, and(eq(listingReviews.listingId, jobListings.id), eq(listingReviews.userId, userId)))
    .where(and(...filters))
    .orderBy(order)
    .limit(sort === "priority" ? PRIORITY_POOL : limit);
}

export async function matchListings(
  userId: string,
  profile: Profile | null,
  options: FeedOptions = {},
): Promise<FeedMatch[]> {
  const sort = options.sort ?? "priority";
  const singaporePass = Boolean(profile?.singaporePassConfirmed);
  const rows = await db.transaction(async (tx) => {
    if (profile?.embedding && sort === "match") {
      await tx.execute(sql`select set_config('hnsw.ef_search', ${String(HNSW_EF_SEARCH)}, true)`);
    }
    return buildFeedQuery(tx, userId, profile, { ...options, sort });
  });

  const ranked = rows.map((row) => ({
    ...row,
    status: row.status ?? "check_manually",
    score: row.distance === null ? null : 1 - Number(row.distance),
  }));
  if (sort === "priority") ranked.sort((a, b) => comparePriority(a, b));

  return ranked.slice(0, options.limit ?? DEFAULT_FEED_LIMIT).map((row) => {
    const passChangedIt = singaporePass && !row.overridden && row.computedStatus !== row.status;
    return {
      id: row.id,
      source: row.source,
      company: row.company,
      title: row.title,
      snippet: snippet(row.description),
      location: row.location,
      workplace: row.workplace,
      remote: row.remote,
      url: row.url,
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      deadline: row.deadline ? row.deadline.toISOString() : null,
      duration: row.duration,
      season: row.season,
      score: row.score,
      matchedTerms: profile ? matchedTerms(profile, row.title, row.description) : [],
      indonesia: isIndonesia(row.location, row.title),
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      reason: row.overridden ? "You changed this status" : passChangedIt ? "In Singapore; you confirmed a work pass" : row.reason,
      quote: row.overridden ? null : row.quote,
      workAuthorizationNote:
        row.status === "eligible_singapore"
          ? singaporePass
            ? singaporeNote({ singaporePass: true, duration: row.duration }, false)
            : row.workAuthorizationNote
          : null,
      overlapNote: row.overlapNote,
      overridden: row.overridden,
      approved: row.approved,
      tier: companyTier(row.company),
      trackedJobId: row.trackedJobId,
    };
  });
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
