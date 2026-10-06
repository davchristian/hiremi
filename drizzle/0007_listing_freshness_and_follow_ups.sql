ALTER TABLE "job_listings" ADD COLUMN "last_seen_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "follow_up_date" timestamp;