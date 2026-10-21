ALTER TABLE "job_listings" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_sources" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."job_source_kind";--> statement-breakpoint
CREATE TYPE "public"."job_source_kind" AS ENUM('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'catapa', 'themuse', 'himalayas', 'ycombinator', 'linkedin', 'web');--> statement-breakpoint
ALTER TABLE "job_listings" ALTER COLUMN "source" SET DATA TYPE "public"."job_source_kind" USING "source"::"public"."job_source_kind";--> statement-breakpoint
ALTER TABLE "job_sources" ALTER COLUMN "kind" SET DATA TYPE "public"."job_source_kind" USING "kind"::"public"."job_source_kind";--> statement-breakpoint
INSERT INTO "job_sources" ("user_id", "kind", "slug", "label") VALUES
  (NULL, 'ycombinator', 'internships', 'YC: internships'),
  (NULL, 'linkedin', 'Indonesia', 'LinkedIn: Indonesia'),
  (NULL, 'linkedin', 'Singapore', 'LinkedIn: Singapore')
ON CONFLICT DO NOTHING;
