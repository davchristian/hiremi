ALTER TABLE "listing_reviews"
  ADD CONSTRAINT "listing_reviews_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX "listing_reviews_listing_id_idx" ON "listing_reviews" ("listing_id");

CREATE TRIGGER listing_reviews_set_updated_at
  BEFORE UPDATE ON "listing_reviews"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE "listing_reviews" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own listing reviews"
  ON "listing_reviews" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own listing reviews"
  ON "listing_reviews" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listing reviews"
  ON "listing_reviews" FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own listing reviews"
  ON "listing_reviews" FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE "refresh_cycles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view refresh cycles"
  ON "refresh_cycles" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Signed-in users can view default job sources"
  ON "job_sources" FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

INSERT INTO "job_sources" ("user_id", "kind", "slug", "label") VALUES
  (NULL, 'ashby', 'airwallex', 'Airwallex'),
  (NULL, 'ashby', 'openai', 'OpenAI'),
  (NULL, 'ashby', 'snowflake', 'Snowflake'),
  (NULL, 'lever', 'ninjavan', 'Ninja Van'),
  (NULL, 'lever', 'nium', 'Nium'),
  (NULL, 'lever', 'binance', 'Binance'),
  (NULL, 'greenhouse', 'okta', 'Okta'),
  (NULL, 'greenhouse', 'twilio', 'Twilio'),
  (NULL, 'greenhouse', 'xendit', 'Xendit'),
  (NULL, 'smartrecruiters', 'grab', 'Grab'),
  (NULL, 'catapa', 'gdplabs', 'GDP Labs'),
  (NULL, 'themuse', 'Software Engineering', 'The Muse: Software Engineering'),
  (NULL, 'himalayas', 'Indonesia', 'Himalayas: open to Indonesia')
ON CONFLICT DO NOTHING;
