import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobListings, jobSources, refreshCycles, type RefreshCycle, type RefreshSummary } from "@/db/schema";
import { DISCOVERY_SOURCES_PER_RUN, REFRESH_INTERVAL_HOURS } from "@/config/discovery";
import { ELIGIBLE_STATUSES, type Eligibility } from "@/lib/eligibility";
import {
  classifyPending,
  closePastDeadlines,
  embedPendingListings,
  ingestSource,
  mapWithConcurrency,
  type SourceReport,
} from "@/lib/ingest";
import { companyTier } from "@/lib/priority";
import { AGGREGATOR_KINDS, type JobSourceKind } from "@/lib/source-meta";
import type { SourceRef } from "@/lib/sources";

const SOURCE_CONCURRENCY = 4;
const TIME_BUDGET_MS = 40_000;
const HOUR_MS = 60 * 60 * 1000;

export type RefreshReport = {
  cycleId: string;
  cycleStartedAt: string;
  cycleFinished: boolean;
  sources: SourceReport[];
  listingsUpserted: number;
  sourcesRemaining: number;
  closedByDeadline: number;
  classified: number;
  embedded: number;
  embeddingSkipped?: string;
  embeddingError?: string;
  summary?: RefreshSummary;
};

export function cycleIsDue(cycle: Pick<RefreshCycle, "startedAt" | "finishedAt"> | null, now: Date): boolean {
  if (!cycle) return true;
  return cycle.finishedAt !== null && now.getTime() - cycle.startedAt.getTime() >= REFRESH_INTERVAL_HOURS * HOUR_MS;
}

async function latestCycles(limit: number): Promise<RefreshCycle[]> {
  return db.select().from(refreshCycles).orderBy(desc(refreshCycles.startedAt)).limit(limit);
}

export async function latestCycle(): Promise<RefreshCycle | null> {
  const [cycle] = await latestCycles(1);
  return cycle ?? null;
}

async function startCycle(trigger: "schedule" | "manual"): Promise<RefreshCycle> {
  const [cycle] = await db.insert(refreshCycles).values({ trigger }).returning();
  return cycle;
}

function lastFetched() {
  return sql<Date>`min(coalesce(${jobSources.lastFetchedAt}, 'epoch'::timestamp))`;
}

async function pendingSources(cycleStart: Date, limit: number): Promise<SourceRef[]> {
  const rows = await db
    .select({ kind: jobSources.kind, slug: jobSources.slug, label: sql<string>`max(${jobSources.label})` })
    .from(jobSources)
    .where(eq(jobSources.enabled, true))
    .groupBy(jobSources.kind, jobSources.slug)
    .having(lt(lastFetched(), cycleStart))
    .orderBy(lastFetched())
    .limit(limit);
  return rows.map((row) => ({ kind: row.kind, slug: row.slug, label: row.label ?? "" }));
}

export async function countPendingSources(cycleStart: Date): Promise<number> {
  const rows = await db
    .select({ kind: jobSources.kind })
    .from(jobSources)
    .where(eq(jobSources.enabled, true))
    .groupBy(jobSources.kind, jobSources.slug)
    .having(lt(lastFetched(), cycleStart));
  return rows.length;
}

async function closeStaleAggregatorListings(previousCycleStart: Date | null): Promise<void> {
  if (!previousCycleStart || AGGREGATOR_KINDS.length === 0) return;
  await db
    .update(jobListings)
    .set({ closedAt: sql`now()`, closedReason: "Not shown by the aggregator for two refresh cycles" })
    .where(
      and(
        inArray(jobListings.source, AGGREGATOR_KINDS as JobSourceKind[]),
        isNull(jobListings.closedAt),
        lt(jobListings.lastSeenAt, previousCycleStart),
      ),
    );
}

export async function summarizeCycle(cycle: RefreshCycle): Promise<RefreshSummary> {
  const since = cycle.startedAt;

  const [sources] = await db
    .select({
      checked: sql<number>`count(distinct (${jobSources.kind}, ${jobSources.slug}))::int`,
      failed: sql<number>`count(distinct (${jobSources.kind}, ${jobSources.slug})) filter (where ${jobSources.lastError} is not null)::int`,
    })
    .from(jobSources)
    .where(gte(jobSources.lastFetchedAt, since));

  const [counts] = await db
    .select({
      created: sql<number>`count(*) filter (where ${jobListings.createdAt} >= ${since})::int`,
      changed: sql<number>`count(*) filter (where ${jobListings.changedAt} >= ${since} and ${jobListings.createdAt} < ${since})::int`,
      closed: sql<number>`count(*) filter (where ${jobListings.closedAt} >= ${since})::int`,
    })
    .from(jobListings);

  const statusRows = await db
    .select({ status: jobListings.eligibility, count: sql<number>`count(*)::int` })
    .from(jobListings)
    .where(or(gte(jobListings.createdAt, since), gte(jobListings.changedAt, since)))
    .groupBy(jobListings.eligibility);

  const fresh = await db
    .select({
      id: jobListings.id,
      company: jobListings.company,
      title: jobListings.title,
      status: jobListings.eligibility,
      postedAt: jobListings.postedAt,
    })
    .from(jobListings)
    .where(
      and(
        gte(jobListings.createdAt, since),
        isNull(jobListings.closedAt),
        inArray(jobListings.eligibility, ELIGIBLE_STATUSES as Eligibility[]),
      ),
    );

  const topNew = fresh
    .map((row) => ({ ...row, tier: companyTier(row.company) }))
    .filter((row) => row.tier <= 3)
    .sort((a, b) => a.tier - b.tier || (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
    .slice(0, 10)
    .map(({ id, company, title, status, tier }) => ({ id, company, title, status: status ?? "", tier }));

  return {
    sourcesChecked: sources?.checked ?? 0,
    sourcesFailed: sources?.failed ?? 0,
    newPostings: counts?.created ?? 0,
    changedPostings: counts?.changed ?? 0,
    closedPostings: counts?.closed ?? 0,
    byStatus: Object.fromEntries(
      statusRows.filter((row) => row.status).map((row) => [row.status!, row.count]),
    ),
    topNew,
  };
}

async function finishCycle(cycle: RefreshCycle): Promise<RefreshSummary> {
  const [, previous] = await latestCycles(2);
  if (previous && previous.id !== cycle.id) await closeStaleAggregatorListings(previous.startedAt);

  const summary = await summarizeCycle(cycle);
  await db
    .update(refreshCycles)
    .set({ finishedAt: new Date(), summary })
    .where(eq(refreshCycles.id, cycle.id));
  console.info(JSON.stringify({ event: "refresh.summary", cycleId: cycle.id, trigger: cycle.trigger, ...summary }));
  return summary;
}

export async function runRefreshTick({ manual }: { manual: boolean }): Promise<RefreshReport> {
  const started = Date.now();
  const now = new Date();
  let cycle = await latestCycle();

  if (manual) {
    if (cycle && !cycle.finishedAt) await finishCycle(cycle);
    cycle = await startCycle("manual");
  } else if (cycleIsDue(cycle, now)) {
    cycle = await startCycle("schedule");
  }
  const active = cycle!;

  const report: RefreshReport = {
    cycleId: active.id,
    cycleStartedAt: active.startedAt.toISOString(),
    cycleFinished: active.finishedAt !== null,
    sources: [],
    listingsUpserted: 0,
    sourcesRemaining: 0,
    closedByDeadline: 0,
    classified: 0,
    embedded: 0,
  };

  if (!active.finishedAt) {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const batch = await pendingSources(active.startedAt, DISCOVERY_SOURCES_PER_RUN);
      if (batch.length === 0) break;
      const results = await mapWithConcurrency(batch, SOURCE_CONCURRENCY, ingestSource);
      report.sources.push(...results.map((result) => result.report));
      report.listingsUpserted += results.reduce((sum, result) => sum + result.upserted, 0);
      if (!manual && report.sources.length >= DISCOVERY_SOURCES_PER_RUN) break;
    }

    report.sourcesRemaining = await countPendingSources(active.startedAt);
    if (report.sourcesRemaining === 0) {
      report.summary = await finishCycle(active);
      report.cycleFinished = true;
    }
  }

  report.closedByDeadline = await closePastDeadlines();
  report.classified = await classifyPending();

  const embedding = await embedPendingListings();
  report.embedded = embedding.embedded;
  if (embedding.skipped) report.embeddingSkipped = embedding.skipped;
  if (embedding.error) report.embeddingError = embedding.error;

  return report;
}

export type RefreshOverview = {
  running: { startedAt: string; remaining: number } | null;
  lastFinishedAt: string | null;
  lastSummary: RefreshSummary | null;
};

export async function refreshOverview(): Promise<RefreshOverview> {
  const latest = await latestCycle();
  const [finished] = await db
    .select()
    .from(refreshCycles)
    .where(isNotNull(refreshCycles.finishedAt))
    .orderBy(desc(refreshCycles.finishedAt))
    .limit(1);

  return {
    running:
      latest && !latest.finishedAt
        ? { startedAt: latest.startedAt.toISOString(), remaining: await countPendingSources(latest.startedAt) }
        : null,
    lastFinishedAt: finished?.finishedAt?.toISOString() ?? null,
    lastSummary: finished?.summary ?? null,
  };
}
