CREATE TABLE "ingest_cooldowns" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_run_at" timestamp DEFAULT now() NOT NULL
);
