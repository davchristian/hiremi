ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX "jobs_user_id_idx" ON "jobs" ("user_id");

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON "jobs"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON "jobs" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON "jobs" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON "jobs" FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON "jobs" FOR DELETE
  USING (auth.uid() = user_id);
