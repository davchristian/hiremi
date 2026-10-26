# Hiremi

Internships you can take from Indonesia, and every application in one place.

A personal job tracker for students and early-career engineers looking for work in Indonesia and Southeast Asia:
- **Discover** collects software internships from public job boards, checks whether you can take each one from Indonesia, and ranks them against your profile.
- **Pipeline** follows each application from wishlist to offer, with a history of every stage change.
- **Sources** shows which job boards Hiremi checks. **Profile** holds the roles, skills and preferences that Discover ranks against.

Built with Next.js 16, React 19, Tailwind v4, Supabase, Drizzle and Voyage AI, and deployed on Vercel.

## Getting started

You need Node 22.18+ and a Supabase project.

```bash
npm ci
cp .env.local.example .env.local
```

Fill in `.env.local` using the table under [Environment variables](#environment-variables). Then create the tables and start the app:

```bash
npm run db:migrate
npm run dev
```

Sign up at http://localhost:3000/sign-up, fill in your profile, and press refresh in Discover.

In the Supabase dashboard, change two settings under **Authentication**:
- Under **URL Configuration**, add `http://localhost:3000/reset-password` to **Redirect URLs**, and add your production `/reset-password` URL when you deploy. Without it, the password reset link doesn't open the reset page.
- Turn off **Confirm email** if you want to sign in locally without clicking a confirmation link. It's on by default.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Project Settings → API → `anon` key |
| `DATABASE_URL` | Yes | Transaction pooler connection string, port 6543 |
| `CRON_SECRET` | In production | Any long random string. Without it, the scheduled refresh gets a 401. |
| `VOYAGE_API_KEY` | No | Turns on match scores. Without it, the feed sorts by date. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Run the test suite. It needs no database or network. |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Create a migration from `src/db/schema.ts` |
| `npm run db:check` | Check the database connection, migrations, tables, row level security and seeded job boards |
| `npm run refresh` | Run the scheduled refresh once, locally, which fetches the next batch of job boards. Add `-- --new-cycle` to start a new cycle right away. |
| `npm run probe:sources` | Fetch the default boards live and show how each posting is classified |

[docs/data-sources.md](docs/data-sources.md) explains how Hiremi reads each job board, decides whether you can take a posting, and runs refreshes.
