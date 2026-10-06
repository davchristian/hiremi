import { and, eq, inArray, isNotNull, isNull, lt, lte, ne, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { ingestCooldowns, jobListings, jobSources } from "@/db/schema";
import {
  EMBEDDING_BATCH_SIZE,
  embedMany,
  embeddingFingerprint,
  isEmbeddingConfigured,
} from "@/lib/embeddings";
import { classifyByRules, excludedByListing } from "@/lib/eligibility";
import { postingHints } from "@/lib/posting-hints";
import { isSoftwareInternship } from "@/lib/roles";
import { adapterFor, type NormalizedListing, type SourceRef } from "@/lib/sources";
import type { JobSourceKind } from "@/lib/source-meta";

const MAX_EMBEDDINGS_PER_RUN = 300;
const HYDRATIONS_PER_SOURCE = 25;
const CLASSIFICATIONS_PER_RUN = 300;

export const MANUAL_INGEST_COOLDOWN_SECONDS = 5 * 60;

export type SourceReport = {
  kind: JobSourceKind;
  slug: string;
  fetched: number;
  relevant: number;
  closed: number;
  error?: string;
};

export type ManualIngestReservation = { ok: true } | { ok: false; retryAfter: number };

export function listingEmbeddingText(listing: {
  title: string;
  company: string;
  location: string;
  description: string;
}): string {
  return [
    `Role: ${listing.title}`,
    `Company: ${listing.company}`,
    `Location: ${listing.location}`,
    listing.description,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function prepareListingRows(listings: NormalizedListing[], now: Date = new Date()) {
  const unique = [...new Map(listings.map((listing) => [`${listing.source}:${listing.externalId}`, listing])).values()];

  return unique
    .map((listing) => {
      const hints = postingHints(listing, listing.postedAt ?? now);
      const rules = classifyByRules({ ...listing, duration: hints.duration });
      const decision = rules.withoutPass;
      return {
        source: listing.source,
        externalId: listing.externalId,
        board: listing.board,
        company: listing.company,
        title: listing.title,
        department: listing.department,
        employmentType: listing.employmentType,
        description: listing.description,
        location: listing.location,
        workplace: rules.facts.workplace,
        remote: rules.facts.workplace === "remote" || listing.remote,
        url: listing.url,
        postedAt: listing.postedAt,
        deadline: hints.deadline,
        duration: hints.duration,
        season: hints.season,
        seasonStart: hints.seasonStart,
        eligibility: decision.status,
        eligibilityWithPass: rules.withPass.status,
        eligibilityReason: decision.reason,
        eligibilityQuote: decision.quote,
        eligibilityMethod: "rules",
        workAuthorizationNote: decision.workAuthorizationNote ?? rules.withPass.workAuthorizationNote,
        overlapNote: decision.overlapNote,
        eligibilityCheckedAt: now,
        embeddingSource: embeddingFingerprint(listingEmbeddingText(listing)),
      };
    })
    .sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
}

const CONTENT_CHANGED = sql`${jobListings.embeddingSource} IS DISTINCT FROM excluded.embedding_source`;

function freshWhenChanged(column: PgColumn, name: string): SQL {
  return sql`CASE WHEN ${CONTENT_CHANGED} OR ${jobListings.eligibility} IS NULL THEN excluded.${sql.identifier(name)} ELSE ${column} END`;
}

const CLOSED_BY_DEADLINE = sql`excluded.deadline IS NOT NULL AND excluded.deadline < date_trunc('day', now())`;

export function buildListingUpsert(executor: Pick<typeof db, "insert">, rows: ReturnType<typeof prepareListingRows>) {
  return executor
    .insert(jobListings)
    .values(rows)
    .onConflictDoUpdate({
      target: [jobListings.source, jobListings.externalId],
      set: {
        board: sql`excluded.board`,
        company: sql`excluded.company`,
        title: sql`excluded.title`,
        department: sql`excluded.department`,
        employmentType: sql`excluded.employment_type`,
        description: sql`excluded.description`,
        location: sql`excluded.location`,
        workplace: sql`excluded.workplace`,
        remote: sql`excluded.remote`,
        url: sql`excluded.url`,
        postedAt: sql`excluded.posted_at`,
        deadline: sql`excluded.deadline`,
        duration: sql`excluded.duration`,
        season: sql`excluded.season`,
        seasonStart: sql`excluded.season_start`,
        eligibility: freshWhenChanged(jobListings.eligibility, "eligibility"),
        eligibilityWithPass: freshWhenChanged(jobListings.eligibilityWithPass, "eligibility_with_pass"),
        eligibilityReason: freshWhenChanged(jobListings.eligibilityReason, "eligibility_reason"),
        eligibilityQuote: freshWhenChanged(jobListings.eligibilityQuote, "eligibility_quote"),
        eligibilityMethod: freshWhenChanged(jobListings.eligibilityMethod, "eligibility_method"),
        workAuthorizationNote: freshWhenChanged(jobListings.workAuthorizationNote, "work_authorization_note"),
        overlapNote: freshWhenChanged(jobListings.overlapNote, "overlap_note"),
        eligibilityCheckedAt: freshWhenChanged(jobListings.eligibilityCheckedAt, "eligibility_checked_at"),
        embedding: sql`CASE WHEN ${CONTENT_CHANGED} THEN NULL ELSE ${jobListings.embedding} END`,
        changedAt: sql`CASE WHEN ${CONTENT_CHANGED} THEN now() ELSE ${jobListings.changedAt} END`,
        embeddingSource: sql`excluded.embedding_source`,
        lastSeenAt: sql`now()`,
        closedAt: sql`CASE WHEN ${CLOSED_BY_DEADLINE} THEN coalesce(${jobListings.closedAt}, now()) ELSE NULL END`,
        closedReason: sql`CASE WHEN ${CLOSED_BY_DEADLINE} THEN 'The application deadline has passed' ELSE NULL END`,
        updatedAt: new Date(),
      },
    });
}

async function upsertListings(listings: NormalizedListing[]): Promise<number> {
  const rows = prepareListingRows(listings);
  if (rows.length === 0) return 0;
  await buildListingUpsert(db, rows);
  return rows.length;
}

async function touchListings(kind: JobSourceKind, externalIds: string[]) {
  if (externalIds.length === 0) return;
  await db
    .update(jobListings)
    .set({
      lastSeenAt: sql`now()`,
      closedAt: sql`CASE WHEN ${jobListings.deadline} < date_trunc('day', now()) THEN coalesce(${jobListings.closedAt}, now()) ELSE NULL END`,
      closedReason: sql`CASE WHEN ${jobListings.deadline} < date_trunc('day', now()) THEN 'The application deadline has passed' ELSE NULL END`,
    })
    .where(and(eq(jobListings.source, kind), inArray(jobListings.externalId, externalIds)));
}

async function describedListingIds(kind: JobSourceKind, externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .select({ externalId: jobListings.externalId })
    .from(jobListings)
    .where(
      and(
        eq(jobListings.source, kind),
        inArray(jobListings.externalId, externalIds),
        sql`(${jobListings.description} <> '' OR ${jobListings.eligibility} = 'excluded')`,
      ),
    );
  return new Set(rows.map((row) => row.externalId));
}

export function buildCloseMissing(
  executor: Pick<typeof db, "update">,
  kind: JobSourceKind,
  board: string,
  seenExternalIds: string[],
) {
  return executor
    .update(jobListings)
    .set({ closedAt: sql`now()`, closedReason: "No longer listed on the board" })
    .where(
      and(
        eq(jobListings.source, kind),
        eq(jobListings.board, board),
        isNull(jobListings.closedAt),
        seenExternalIds.length ? notInArray(jobListings.externalId, seenExternalIds) : undefined,
      ),
    )
    .returning({ id: jobListings.id });
}

async function recordFetch(kind: JobSourceKind, slug: string, error: string | null) {
  await db
    .update(jobSources)
    .set({ lastFetchedAt: new Date(), lastError: error })
    .where(and(eq(jobSources.kind, kind), eq(jobSources.slug, slug)));
}

export async function selectForStorage(
  source: SourceRef,
  relevant: NormalizedListing[],
  known: Set<string>,
): Promise<{ store: NormalizedListing[]; touch: string[] }> {
  const adapter = adapterFor(source.kind);
  if (!adapter.hydrate) return { store: relevant, touch: [] };

  const store: NormalizedListing[] = [];
  const touch: string[] = [];
  let hydrated = 0;

  for (const item of relevant) {
    if (known.has(item.externalId)) {
      touch.push(item.externalId);
    } else if (!item.needsHydration || excludedByListing(item)) {
      store.push(item);
    } else if (hydrated < HYDRATIONS_PER_SOURCE) {
      hydrated++;
      try {
        store.push(await adapter.hydrate(source, item));
      } catch {
        continue;
      }
    }
  }
  return { store, touch };
}

export async function ingestSource(source: SourceRef): Promise<{ report: SourceReport; upserted: number }> {
  const { kind, slug } = source;
  try {
    const adapter = adapterFor(kind);
    const all = await adapter.list(source);
    const relevant = all.filter(isSoftwareInternship);
    const ids = relevant.map((item) => item.externalId);
    const known = adapter.hydrate ? await describedListingIds(kind, ids) : new Set<string>();
    const { store, touch } = await selectForStorage(source, relevant, known);

    const upserted = await upsertListings(store);
    await touchListings(kind, touch);
    const closed = adapter.complete ? (await buildCloseMissing(db, kind, slug, ids)).length : 0;
    await recordFetch(kind, slug, null);

    return { report: { kind, slug, fetched: all.length, relevant: relevant.length, closed }, upserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await recordFetch(kind, slug, message.slice(0, 500));
    return { report: { kind, slug, fetched: 0, relevant: 0, closed: 0, error: message }, upserted: 0 };
  }
}

export async function closePastDeadlines(): Promise<number> {
  const closed = await db
    .update(jobListings)
    .set({ closedAt: sql`now()`, closedReason: "The application deadline has passed" })
    .where(and(isNull(jobListings.closedAt), lt(jobListings.deadline, sql`date_trunc('day', now())`)))
    .returning({ id: jobListings.id });
  return closed.length;
}

export async function classifyPending(): Promise<number> {
  const pending = await db
    .select({
      id: jobListings.id,
      title: jobListings.title,
      location: jobListings.location,
      description: jobListings.description,
      workplace: jobListings.workplace,
      duration: jobListings.duration,
    })
    .from(jobListings)
    .where(and(isNull(jobListings.eligibility), isNull(jobListings.closedAt)))
    .limit(CLASSIFICATIONS_PER_RUN);

  await mapWithConcurrency(pending, 8, async (listing) => {
    const rules = classifyByRules(listing);
    await db
      .update(jobListings)
      .set({
        workplace: rules.facts.workplace,
        eligibility: rules.withoutPass.status,
        eligibilityWithPass: rules.withPass.status,
        eligibilityReason: rules.withoutPass.reason,
        eligibilityQuote: rules.withoutPass.quote,
        eligibilityMethod: "rules",
        workAuthorizationNote: rules.withoutPass.workAuthorizationNote ?? rules.withPass.workAuthorizationNote,
        overlapNote: rules.withoutPass.overlapNote,
        eligibilityCheckedAt: new Date(),
      })
      .where(eq(jobListings.id, listing.id));
  });

  return pending.length;
}

async function writeEmbeddings(rows: { id: string; fingerprint: string | null; vector: number[] }[]) {
  if (rows.length === 0) return;

  const values = sql.join(
    rows.map(
      (row) =>
        sql`(${row.id}::uuid, ${row.fingerprint}::text, ${JSON.stringify(row.vector)}::vector)`,
    ),
    sql`, `,
  );

  await db.execute(sql`
    update ${jobListings}
    set embedding = pending.embedding
    from (values ${values}) as pending (id, fingerprint, embedding)
    where ${jobListings.id} = pending.id
      and ${jobListings.embeddingSource} is not distinct from pending.fingerprint
  `);
}

export async function embedPendingListings(): Promise<{ embedded: number; error?: string; skipped?: string }> {
  if (!isEmbeddingConfigured()) {
    return { embedded: 0, skipped: "VOYAGE_API_KEY is not set; listings stored without embeddings" };
  }

  const pending = await db
    .select({
      id: jobListings.id,
      title: jobListings.title,
      company: jobListings.company,
      location: jobListings.location,
      description: jobListings.description,
      fingerprint: jobListings.embeddingSource,
    })
    .from(jobListings)
    .where(
      and(
        isNull(jobListings.embedding),
        isNull(jobListings.closedAt),
        isNotNull(jobListings.eligibility),
        ne(jobListings.eligibility, "excluded"),
      ),
    )
    .orderBy(sql`${jobListings.postedAt} desc nulls last`)
    .limit(MAX_EMBEDDINGS_PER_RUN);

  let embedded = 0;
  for (let start = 0; start < pending.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = pending.slice(start, start + EMBEDDING_BATCH_SIZE);
    try {
      const vectors = await embedMany(batch.map(listingEmbeddingText), "document");
      await writeEmbeddings(
        batch.map((listing, index) => ({
          id: listing.id,
          fingerprint: listing.fingerprint,
          vector: vectors[index],
        })),
      );
      embedded += batch.length;
    } catch (error) {
      return { embedded, error: error instanceof Error ? error.message : "embedding failed" };
    }
  }

  return { embedded };
}

export async function reserveManualIngest(userId: string): Promise<ManualIngestReservation> {
  const now = new Date();
  const cooldownMs = MANUAL_INGEST_COOLDOWN_SECONDS * 1000;

  const claimed = await db
    .insert(ingestCooldowns)
    .values({ userId, lastRunAt: now })
    .onConflictDoUpdate({
      target: ingestCooldowns.userId,
      set: { lastRunAt: now },
      setWhere: lte(ingestCooldowns.lastRunAt, new Date(now.getTime() - cooldownMs)),
    })
    .returning({ userId: ingestCooldowns.userId });

  if (claimed.length > 0) return { ok: true };

  const [current] = await db
    .select({ lastRunAt: ingestCooldowns.lastRunAt })
    .from(ingestCooldowns)
    .where(eq(ingestCooldowns.userId, userId));

  const readyAt = (current?.lastRunAt.getTime() ?? now.getTime()) + cooldownMs;
  return { ok: false, retryAfter: Math.max(1, Math.ceil((readyAt - now.getTime()) / 1000)) };
}
