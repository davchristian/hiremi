# Job Tracker

A personal kanban that follows each job application from wishlist to offer, plus a feed that ranks new openings against your profile. Built for students and early-career engineers job-hunting in Indonesia and Southeast Asia.

The interface follows Apple's Human Interface Guidelines for productivity apps (Mail, Reminders, Settings): a translucent sidebar on desktop and a tab bar at 760px and below, one tangerine accent, status shown as small colored dots, and sheets, pop-up buttons and toasts instead of extra buttons.

- **Discover** (`/feed`): software internships from public job boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, CATAPA, The Muse, Himalayas) in a Mail-style list and detail view. Each posting is classified for whether you can take it from Indonesia (remote, in Indonesia, in Singapore, check manually, or not eligible) with the reason and the sentence it came from, and ranked by company tier, season and match. The match ring shows how a posting ranks against the others in the list. See [docs/data-sources.md](docs/data-sources.md).
- **Pipeline** (`/board`): your applications grouped by stage, like Reminders. Change a stage with its pop-up button; moving to Applied asks for confirmation and sets a follow-up reminder a week later. Deleting can be undone from the toast for six seconds. CSV export is in the toolbar.
- **Sources** (`/sources`): the boards being checked, the last refresh summary, and adding a company's board by name or URL.
- **Profile** (`/profile`): target roles, skills and the Singapore work-pass switch that the ranking and eligibility use.

Stack: Next.js 16 (App Router), React 19, Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth), Drizzle ORM, Zod, Voyage AI, Vercel Cron.

## Local setup

1. Install Node 22.18 or newer, then `npm install`. Next.js itself runs on 20.9+, but `npm test` runs TypeScript directly, which needs 22.18.
2. Create a Supabase project, copy `.env.local.example` to `.env.local`, and fill it in (see below).
3. For local testing, turn off Authentication → Email → Confirm email in Supabase.
4. Run `npm run db:migrate`. Keep `DATABASE_URL` on the transaction pooler (port 6543); `drizzle.config.ts` switches drizzle-kit to the session pooler (port 5432) on the same host, because migrations over the transaction pooler hang.
5. Run `npm run dev` and create an account at `/sign-up`.
6. For the feed, set `VOYAGE_API_KEY` (optional; without it there's no match score), open `/feed`, fill in the profile, and press refresh. Thirteen default boards are seeded by the migrations; add more by board name or URL.

## Environment variables

| Variable | Where it comes from | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL (bare host, no `/rest/v1/`) | Auth in browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` public key | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key; server only, never expose it | Admin tasks |
| `DATABASE_URL` | Database → Connection string → transaction pooler, port 6543. Password as typed, no brackets; percent-encode `@ : / # ?` | Drizzle at runtime |
| `VOYAGE_API_KEY` | voyageai.com dashboard. Without it listings are stored unembedded and the feed sorts by date | Embeddings |
| `CRON_SECRET` | Any long random string; set the same value in Vercel, which sends it as `Authorization: Bearer $CRON_SECRET` | Scheduled ingest |
| `REFRESH_INTERVAL_HOURS` | Optional, default 72 | Length of a refresh cycle |
| `DISCOVERY_SOURCES_PER_RUN` | Optional, default 4 | Sources checked per hourly run |

## Previewing the UI without a database

In development, `/preview/discover`, `/preview/pipeline`, `/preview/pipeline-empty`, `/preview/sources` and `/preview/profile` render each screen with sample data from `src/app/preview/fixtures.ts`, so the UI can be checked while Supabase is unreachable. Actions that call the API fail there, which is a quick way to see the error states. The route returns 404 in production builds.

## Tests

`npm test` runs the suite in `tests/` with Node's built-in test runner. It exits with a clear message on Node older than 22.18. It needs no database or network: fetch is mocked, `DATABASE_URL` points nowhere, and feed ranking is checked against the SQL Drizzle generates. It covers the spec's edge cases, including the open-redirect guard, the Indonesia matcher, provider quirks in each adapter, calendar-date handling, ingest dedupe and embedding reuse, Voyage retries, and the HNSW-friendly `ORDER BY`.

## Database

`src/db/schema.ts` is the source of truth. Schema changes go through `npm run db:generate`; hand-written SQL (foreign keys to `auth.users`, RLS, triggers) goes in a migration created with `npx drizzle-kit generate --custom --name <name>`, so the snapshots in `drizzle/meta` stay in step with the schema. `npx drizzle-kit check` validates the snapshot chain.

App code connects through Drizzle as the table owner, which bypasses RLS, so every query scopes by `user_id` explicitly. RLS is defense in depth for anything that reaches Supabase with the anon key.

## Ingest

An hourly cron calls `/api/ingest`, which works through a 3-day refresh cycle a few sources at a time: it keeps only software internships, classifies each for eligibility, closes postings that left their board or passed their deadline, and embeds up to 300 new or changed eligible listings per run. Signed-in users can start a new cycle from the feed at most once every 5 minutes. One failing source never fails the run; its error shows in the sources list. Details, including the Vercel Hobby cron limit, are in [docs/data-sources.md](docs/data-sources.md).

## Deploying

Deploy to Vercel, set the environment variables, and keep `vercel.json`'s function region (`sin1`, Singapore) next to the Supabase project's region. Free Supabase projects pause after about a week idle; resume them from the dashboard.
