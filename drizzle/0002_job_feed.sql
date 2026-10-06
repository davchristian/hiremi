CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('student', 'intern', 'junior', 'mid', 'senior');--> statement-breakpoint
CREATE TYPE "public"."job_source_kind" AS ENUM('greenhouse', 'lever', 'ashby', 'remoteok', 'weworkremotely');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('remote', 'hybrid', 'onsite', 'any');--> statement-breakpoint
CREATE TABLE "job_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "job_source_kind" NOT NULL,
	"external_id" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"url" text NOT NULL,
	"posted_at" timestamp,
	"embedding" vector(1024),
	"embedding_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "job_source_kind" NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_roles" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"experience_level" "experience_level" DEFAULT 'student' NOT NULL,
	"location_preference" text DEFAULT '',
	"work_mode" "work_mode" DEFAULT 'any' NOT NULL,
	"blurb" text DEFAULT '',
	"embedding" vector(1024),
	"embedding_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "listing_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "job_listings_source_external_idx" ON "job_listings" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "job_listings_embedding_idx" ON "job_listings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_user_kind_slug_idx" ON "job_sources" USING btree ("user_id","kind","slug");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_listing_id_job_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."job_listings"("id") ON DELETE set null ON UPDATE no action;