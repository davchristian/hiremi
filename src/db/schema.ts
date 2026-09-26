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
  link: text("link"),
  notes: text("notes").default(""),
  listingId: uuid("listing_id").references(() => jobListings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

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
  "remoteok",
  "weworkremotely",
  "kalibrr",
]);

export const jobSources = pgTable(
  "job_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    kind: jobSourceKindEnum("kind").notNull(),
    slug: text("slug").notNull().default(""),
    label: text("label").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("job_sources_user_kind_slug_idx").on(table.userId, table.kind, table.slug)],
);

export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;

export const jobListings = pgTable(
  "job_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: jobSourceKindEnum("source").notNull(),
    externalId: text("external_id").notNull(),
    company: text("company").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    remote: boolean("remote").notNull().default(false),
    url: text("url").notNull(),
    postedAt: timestamp("posted_at"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingSource: text("embedding_source"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_listings_source_external_idx").on(table.source, table.externalId),
    index("job_listings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type JobListing = typeof jobListings.$inferSelect;
export type NewJobListing = typeof jobListings.$inferInsert;

export const ingestCooldowns = pgTable("ingest_cooldowns", {
  userId: uuid("user_id").primaryKey(),
  lastRunAt: timestamp("last_run_at").notNull().defaultNow(),
});

export type IngestCooldown = typeof ingestCooldowns.$inferSelect;
