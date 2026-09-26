import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { ingestCooldowns, jobListings, jobSources } from "@/db/schema";
import {
  EMBEDDING_BATCH_SIZE,
  embedMany,
  embeddingFingerprint,
  isEmbeddingConfigured,
} from "@/lib/embeddings";
import { fetchSource, type NormalizedListing } from "@/lib/sources";
import { acceptsSlug, type JobSourceKind } from "@/lib/source-meta";

const MAX_EMBEDDINGS_PER_RUN = 300;
const SOURCE_CONCURRENCY = 4;

export const MANUAL_INGEST_COOLDOWN_SECONDS = 5 * 60;

export type SourceReport = {
  kind: JobSourceKind;
  slug: string;
  fetched: number;
  error?: string;
};

export type IngestReport = {
  sources: SourceReport[];
  listingsUpserted: number;
  listingsEmbedded: number;
  embeddingSkipped?: string;
  embeddingError?: string;
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

async function mapWithConcurrency<T, R>(
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

async function upsertListings(listings: NormalizedListing[]): Promise<number> {
  if (listings.length === 0) return 0;

  const rows = listings.map((listing) => ({
    ...listing,
    embeddingSource: embeddingFingerprint(listingEmbeddingText(listing)),
  }));

  const deduped = [
    ...new Map(rows.map((row) => [`${row.source}:${row.externalId}`, row])).values(),
  ].sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));

  await db
    .insert(jobListings)
    .values(deduped)
    .onConflictDoUpdate({
      target: [jobListings.source, jobListings.externalId],
      set: {
        company: sql`excluded.company`,
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        location: sql`excluded.location`,
        remote: sql`excluded.remote`,
        url: sql`excluded.url`,
        postedAt: sql`excluded.posted_at`,
        embedding: sql`CASE
          WHEN ${jobListings.embeddingSource} IS DISTINCT FROM excluded.embedding_source
          THEN NULL ELSE ${jobListings.embedding} END`,
        embeddingSource: sql`excluded.embedding_source`,
        updatedAt: new Date(),
      },
    });

  return deduped.length;
}

async function recordFetch(kind: JobSourceKind, slug: string, error: string | null) {
  await db
    .update(jobSources)
    .set({ lastFetchedAt: new Date(), lastError: error })
    .where(and(eq(jobSources.kind, kind), eq(jobSources.slug, slug)));
}

async function ingestSource(
  kind: JobSourceKind,
  slug: string,
): Promise<{ report: SourceReport; upserted: number }> {
  try {
    const listings = await fetchSource(kind, slug);
    const upserted = await upsertListings(listings);
    await recordFetch(kind, slug, null);
    return { report: { kind, slug, fetched: listings.length }, upserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await recordFetch(kind, slug, message.slice(0, 500));
    return { report: { kind, slug, fetched: 0, error: message }, upserted: 0 };
  }
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

async function embedPendingListings(): Promise<{ embedded: number; error?: string }> {
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
    .where(isNull(jobListings.embedding))
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

export async function runIngest(): Promise<IngestReport> {
  const enabled = await db
    .select({ kind: jobSources.kind, slug: jobSources.slug })
    .from(jobSources)
    .where(eq(jobSources.enabled, true));

  const unique = new Map<string, { kind: JobSourceKind; slug: string }>();
  for (const source of enabled) {
    const slug = acceptsSlug(source.kind) ? source.slug : "";
    unique.set(`${source.kind}:${slug}`, { kind: source.kind, slug });
  }

  const results = await mapWithConcurrency([...unique.values()], SOURCE_CONCURRENCY, (source) =>
    ingestSource(source.kind, source.slug),
  );

  const report: IngestReport = {
    sources: results.map((result) => result.report),
    listingsUpserted: results.reduce((sum, result) => sum + result.upserted, 0),
    listingsEmbedded: 0,
  };

  if (!isEmbeddingConfigured()) {
    report.embeddingSkipped = "VOYAGE_API_KEY is not set; listings stored without embeddings";
    return report;
  }

  const { embedded, error } = await embedPendingListings();
  report.listingsEmbedded = embedded;
  if (error) report.embeddingError = error;
  return report;
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
