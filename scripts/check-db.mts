import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, connect_timeout: 15, onnotice: () => {} });
const EXPECTED_TABLES = ["jobs", "profiles", "job_sources", "job_listings", "ingest_cooldowns", "listing_reviews", "refresh_cycles"];
let failures = 0;

function report(ok: boolean, label: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
}

try {
  const [{ version }] = await sql`select version()`;
  report(true, "connected", String(version).split(",")[0]);

  const host = new URL(url).hostname;
  report(url.includes(":6543/"), "DATABASE_URL uses the transaction pooler (port 6543)", host);

  const migrations = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`.catch(() => [{ count: 0 }]);
  report(migrations[0].count === 10, "migrations applied", `${migrations[0].count} of 10`);

  const tables = await sql`select tablename, rowsecurity from pg_tables where schemaname = 'public'`;
  for (const name of EXPECTED_TABLES) {
    const table = tables.find((row) => row.tablename === name);
    report(Boolean(table), `table ${name}`, table ? (table.rowsecurity ? "row level security on" : "row level security OFF") : "missing");
    if (table && !table.rowsecurity) failures++;
  }

  const extensions = await sql`select extname from pg_extension where extname = 'vector'`;
  report(extensions.length === 1, "pgvector extension");

  const enums = await sql`select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'job_source_kind' order by e.enumsortorder`;
  report(enums.length === 9 && !enums.some((row) => row.enumlabel === "kalibrr"), "job source kinds", enums.map((row) => row.enumlabel).join(", "));

  const defaults = await sql`select count(*)::int as count from job_sources where user_id is null`.catch(() => [{ count: -1 }]);
  report(defaults[0].count === 13, "default job boards seeded", String(defaults[0].count));

  const fk = await sql`select count(*)::int as count from pg_constraint where conname like '%auth_users_id_fk'`;
  report(fk[0].count >= 4, "user foreign keys to auth.users", String(fk[0].count));

  const trigger = await sql`select count(*)::int as count from pg_proc where proname = 'set_updated_at'`;
  report(trigger[0].count === 1, "set_updated_at trigger function");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  report(false, "connection", message);
  if (/tenant\/user .* not found|ENOTFOUND/.test(message)) {
    console.log("     The project in DATABASE_URL doesn't exist. Copy the connection string from your new Supabase project.");
  } else if (/password authentication failed/.test(message)) {
    console.log("     Wrong database password. Reset it under Project Settings, Database, and update DATABASE_URL.");
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nDatabase looks right.");
process.exit(failures ? 1 : 0);
