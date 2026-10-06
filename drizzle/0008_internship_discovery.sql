CREATE TYPE "public"."eligibility" AS ENUM('eligible_remote', 'eligible_indonesia', 'eligible_singapore', 'check_manually', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."workplace" AS ENUM('remote', 'hybrid', 'onsite', 'unknown');--> statement-breakpoint
CREATE TABLE "listing_reviews" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"status" "eligibility",
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listing_reviews_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "refresh_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text DEFAULT 'schedule' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "job_listings" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_sources" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DELETE FROM "job_listings" WHERE "source" IN ('kalibrr', 'remoteok', 'weworkremotely');--> statement-breakpoint
DELETE FROM "job_sources" WHERE "kind" IN ('kalibrr', 'remoteok', 'weworkremotely');--> statement-breakpoint
DROP TYPE "public"."job_source_kind";--> statement-breakpoint
CREATE TYPE "public"."job_source_kind" AS ENUM('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'catapa', 'themuse', 'himalayas', 'web');--> statement-breakpoint
ALTER TABLE "job_listings" ALTER COLUMN "source" SET DATA TYPE "public"."job_source_kind" USING "source"::"public"."job_source_kind";--> statement-breakpoint
ALTER TABLE "job_sources" ALTER COLUMN "kind" SET DATA TYPE "public"."job_source_kind" USING "kind"::"public"."job_source_kind";--> statement-breakpoint
ALTER TABLE "job_sources" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "board" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "job_listings" SET "board" = split_part("external_id", ':', 1) WHERE "external_id" LIKE '%:%';--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "department" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "employment_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "workplace" "workplace" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "deadline" timestamp;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "duration" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "season" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "season_start" timestamp;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "eligibility" "eligibility";--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "eligibility_with_pass" "eligibility";--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "eligibility_reason" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "eligibility_quote" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "eligibility_method" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "work_authorization_note" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "overlap_note" text;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "eligibility_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "singapore_pass_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_listing_id_job_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."job_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_listings_open_eligibility_idx" ON "job_listings" USING btree ("eligibility") WHERE "job_listings"."closed_at" is null;--> statement-breakpoint
CREATE INDEX "job_listings_source_board_idx" ON "job_listings" USING btree ("source","board");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_default_kind_slug_idx" ON "job_sources" USING btree ("kind","slug") WHERE "job_sources"."user_id" is null;