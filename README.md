# Job Tracker

A personal kanban that follows each job application from wishlist to offer, plus a feed that ranks new openings against your profile. Built for students and early-career engineers job-hunting in Indonesia and Southeast Asia.

- **Board** (`/board`): five stages (wishlist, applied, interview, offer, rejected), stale flags after 14 days in applied, weekly stats and CSV export.
- **Feed** (`/feed`): listings from public boards (Kalibrr, Greenhouse, Lever, Ashby, RemoteOK, We Work Remotely), ranked by cosine similarity to your profile with Voyage AI embeddings and pgvector. Indonesian roles are highlighted.

Stack: Next.js 16 (App Router), React 19, Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth), Drizzle ORM, Zod, Voyage AI, Vercel Cron.

## Local setup

1. Install Node 20.9 or newer, then `npm install`.
2. Create a Supabase project, copy `.env.local.example` to `.env.local`, and fill it in (see below).
3. For local testing, turn off Authentication → Email → Confirm email in Supabase.
4. Run `npm run db:migrate`. Keep `DATABASE_URL` on the transaction pooler (port 6543); `drizzle.config.ts` switches drizzle-kit to the session pooler (port 5432) on the same host, because migrations over the transaction pooler hang.
5. Run `npm run dev` and create an account at `/sign-up`.
6. For the feed, set `VOYAGE_API_KEY`, open `/feed`, fill in the profile, and add sources: Kalibrr (blank country), Greenhouse `xendit`, Lever `ninjavan`. Press refresh.

## Environment variables

| Variable | Where it comes from | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL (bare host, no `/rest/v1/`) | Auth in browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` public key | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key; server only, never expose it | Admin tasks |
| `DATABASE_URL` | Database → Connection string → transaction pooler, port 6543. Password as typed, no brackets; percent-encode `@ : / # ?` | Drizzle at runtime |
| `VOYAGE_API_KEY` | voyageai.com dashboard. Without it listings are stored unembedded and the feed sorts by date | Embeddings |
| `CRON_SECRET` | Any long random string; set the same value in Vercel, which sends it as `Authorization: Bearer $CRON_SECRET` | Scheduled ingest |

## Database

`src/db/schema.ts` is the source of truth. Schema changes go through `npm run db:generate`; hand-written SQL (foreign keys to `auth.users`, RLS, triggers) goes in a migration created with `npx drizzle-kit generate --custom --name <name>`, so the snapshots in `drizzle/meta` stay in step with the schema. `npx drizzle-kit check` validates the snapshot chain.

App code connects through Drizzle as the table owner, which bypasses RLS, so every query scopes by `user_id` explicitly. RLS is defense in depth for anything that reaches Supabase with the anon key.

## Ingest

`/api/ingest` polls every enabled source, upserts listings on `(source, external_id)`, and embeds up to 300 new or changed listings per run. Vercel Cron calls it every 6 hours with `CRON_SECRET`; signed-in users can trigger it from the feed at most once every 5 minutes. One failing source never fails the run; its error shows in the sources list.

## Deploying

Deploy to Vercel, set the six environment variables, and keep `vercel.json`'s function region (`bom1`, Mumbai) next to the Supabase project's region. Free Supabase projects pause after about a week idle; resume them from the dashboard.
