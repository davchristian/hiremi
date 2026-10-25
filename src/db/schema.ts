import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  boolean,
  vector,
  index,
  uniqueIndex,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

export const stageEnum = pgEnum("stage", [
  "wishlist",
  "applied",
  "interview",
  "offer",
  "rejected",
]);

export const EMBEDDING_DIMENSIONS = 1024;

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  stage: stageEnum("stage").notNull().default("wishlist"),
  appliedDate: timestamp("applied_date", { mode: "date" }),
  followUpDate: timestamp("follow_up_date", { mode: "date" }),
  link: text("link"),
  notes: text("notes").default(""),
  listingId: uuid("listing_id").references(() => jobListings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export const jobStageEvents = pgTable(
  "job_stage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    fromStage: stageEnum("from_stage"),
    toStage: stageEnum("to_stage").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("job_stage_events_job_idx").on(table.jobId, table.createdAt)],
);

export type JobStageEvent = typeof jobStageEvents.$inferSelect;

export const experienceLevelEnum = pgEnum("experience_level", [
  "student",
  "intern",
  "junior",
  "mid",
  "senior",
]);

export const workModeEnum = pgEnum("work_mode", ["remote", "hybrid", "onsite", "any"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  targetRoles: text("target_roles").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]),
  experienceLevel: experienceLevelEnum("experience_level").notNull().default("student"),
  locationPreference: text("location_preference").default(""),
  workMode: workModeEnum("work_mode").notNull().default("any"),
  blurb: text("blurb").default(""),
  singaporePassConfirmed: boolean("singapore_pass_confirmed").notNull().default(false),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  embeddingSource: text("embedding_source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export const jobSourceKindEnum = pgEnum("job_source_kind", [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "catapa",
  "themuse",
  "himalayas",
  "ycombinator",
  "linkedin",
  "web",
]);

export const eligibilityEnum = pgEnum("eligibility", [
  "eligible_remote",
  "eligible_indonesia",
  "eligible_singapore",
  "check_manually",
  "excluded",
]);

export const workplaceEnum = pgEnum("workplace", ["remote", "hybrid", "onsite", "unknown"]);

export const jobSources = pgTable(
  "job_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    kind: jobSourceKindEnum("kind").notNull(),
    slug: text("slug").notNull().default(""),
    label: text("label").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_sources_user_kind_slug_idx").on(table.userId, table.kind, table.slug),
    uniqueIndex("job_sources_default_kind_slug_idx")
      .on(table.kind, table.slug)
      .where(sql`${table.userId} is null`),
  ],
);

export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;

export const jobListings = pgTable(
  "job_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: jobSourceKindEnum("source").notNull(),
    externalId: text("external_id").notNull(),
    board: text("board").notNull().default(""),
    company: text("company").notNull(),
    title: text("title").notNull(),
    department: text("department").notNull().default(""),
    employmentType: text("employment_type").notNull().default(""),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    workplace: workplaceEnum("workplace").notNull().default("unknown"),
    remote: boolean("remote").notNull().default(false),
    url: text("url").notNull(),
    postedAt: timestamp("posted_at"),
    deadline: timestamp("deadline"),
    duration: text("duration"),
    season: text("season"),
    seasonStart: timestamp("season_start"),
    eligibility: eligibilityEnum("eligibility"),
    eligibilityWithPass: eligibilityEnum("eligibility_with_pass"),
    eligibilityReason: text("eligibility_reason"),
    eligibilityQuote: text("eligibility_quote"),
    eligibilityMethod: text("eligibility_method"),
    workAuthorizationNote: text("work_authorization_note"),
    overlapNote: text("overlap_note"),
    eligibilityCheckedAt: timestamp("eligibility_checked_at"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingSource: text("embedding_source"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    changedAt: timestamp("changed_at"),
    closedAt: timestamp("closed_at"),
    closedReason: text("closed_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_listings_source_external_idx").on(table.source, table.externalId),
    index("job_listings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("job_listings_open_eligibility_idx")
      .on(table.eligibility)
      .where(sql`${table.closedAt} is null`),
    index("job_listings_source_board_idx").on(table.source, table.board),
  ],
);

export type JobListing = typeof jobListings.$inferSelect;
export type NewJobListing = typeof jobListings.$inferInsert;

export const ingestCooldowns = pgTable("ingest_cooldowns", {
  userId: uuid("user_id").primaryKey(),
  lastRunAt: timestamp("last_run_at").notNull().defaultNow(),
});

export type IngestCooldown = typeof ingestCooldowns.$inferSelect;

export const listingReviews = pgTable(
  "listing_reviews",
  {
    userId: uuid("user_id").notNull(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => jobListings.id, { onDelete: "cascade" }),
    status: eligibilityEnum("status"),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.listingId] })],
);

export type ListingReview = typeof listingReviews.$inferSelect;

export type RefreshSummary = {
  sourcesChecked: number;
  sourcesFailed: number;
  newPostings: number;
  changedPostings: number;
  closedPostings: number;
  byStatus: Partial<Record<(typeof eligibilityEnum.enumValues)[number], number>>;
  topNew: { id: string; company: string; title: string; status: string; tier: number }[];
};

export const refreshCycles = pgTable("refresh_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  trigger: text("trigger").notNull().default("schedule"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  summary: jsonb("summary").$type<RefreshSummary>(),
});

export type RefreshCycle = typeof refreshCycles.$inferSelect;
