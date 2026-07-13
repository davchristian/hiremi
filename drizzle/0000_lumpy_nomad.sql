CREATE TYPE "public"."stage" AS ENUM('wishlist', 'applied', 'interview', 'offer', 'rejected');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"stage" "stage" DEFAULT 'wishlist' NOT NULL,
	"applied_date" timestamp,
	"link" text,
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
