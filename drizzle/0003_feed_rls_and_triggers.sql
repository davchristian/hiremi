ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "job_sources"
  ADD CONSTRAINT "job_sources_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX "job_sources_user_id_idx" ON "job_sources" ("user_id");

CREATE INDEX "job_listings_posted_at_idx" ON "job_listings" ("posted_at" DESC NULLS LAST);
CREATE INDEX "jobs_listing_id_idx" ON "jobs" ("listing_id");

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON "profiles"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER job_listings_set_updated_at
  BEFORE UPDATE ON "job_listings"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON "profiles" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON "profiles" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON "profiles" FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON "profiles" FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE "job_sources" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job sources"
  ON "job_sources" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job sources"
  ON "job_sources" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job sources"
  ON "job_sources" FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job sources"
  ON "job_sources" FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE "job_listings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view listings"
  ON "job_listings" FOR SELECT
  TO authenticated
  USING (true);
