# Hiremi

Internships you can actually take, and every application in one place.

A personal job tracker for students and early-career engineers looking for work in Indonesia and Southeast Asia:
- **Discover** collects software internships from public job boards, checks whether you can take each one from Indonesia, and ranks them against your profile.
- **Pipeline** follows each application from wishlist to offer, with a history of every stage change.
- **Sources** shows which boards are checked, and **Profile** holds the roles, skills and preferences ranking uses.

Built with Next.js 16, React 19, Tailwind v4, Supabase, Drizzle and Voyage AI, and deployed on Vercel.

## Getting started

You need Node 22.18+ and a Supabase project.

```bash
npm ci
cp .env.local.example .env.local
npm run db:migrate
npm run dev
```

Fill in `.env.local` before migrating. Then sign up at http://localhost:3000/sign-up, fill in your profile, and press refresh in Discover.

Two settings in Supabase, both under **Authentication**:
- **URL Configuration → Redirect URLs:** add `http://localhost:3000/reset-password`, and later your production `/reset-password` URL, so password reset works.
- **Confirm email:** it's on by default. Turn it off for quicker local testing.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Project Settings → API → `anon` key |
| `DATABASE_URL` | Yes | Transaction pooler connection string, port 6543 |
| `CRON_SECRET` | In production | Any long random string. Without it, the scheduled refresh gets a 401. |
| `VOYAGE_API_KEY` | No | Enables match scores. Without it, the feed sorts by date. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Run the test suite. It needs no database or network. |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration from `src/db/schema.ts` |
| `npm run db:check` | Check the live database is set up correctly |
| `npm run refresh` | Run a refresh locally (`-- --new-cycle` starts a new cycle) |
| `npm run probe:sources` | Fetch the default boards live and show how each posting is classified |

How each job board is read, and how eligibility and refresh work, is in [docs/data-sources.md](docs/data-sources.md).
