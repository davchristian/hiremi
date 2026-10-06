ALTER TABLE "ingest_cooldowns"
  ADD CONSTRAINT "ingest_cooldowns_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "ingest_cooldowns" ENABLE ROW LEVEL SECURITY;
