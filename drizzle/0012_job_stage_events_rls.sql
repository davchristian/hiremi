ALTER TABLE "job_stage_events"
  ADD CONSTRAINT "job_stage_events_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "job_stage_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stage events"
  ON "job_stage_events" FOR SELECT
  USING (auth.uid() = user_id);

-- Existing jobs start their history at the stage they're in now.
INSERT INTO "job_stage_events" ("job_id", "user_id", "from_stage", "to_stage", "created_at")
SELECT "id", "user_id", NULL, "stage", "created_at" FROM "jobs";
