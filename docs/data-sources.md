# Data sources

Discovery uses public endpoints intended for listing a company's open jobs: official APIs where a platform has one, and in one case (CATAPA) the public JSON a career page loads. Every request identifies itself with a descriptive User-Agent (`USER_AGENT` in `src/lib/sources/types.ts`), and requests are spread across the hourly runs of a 3-day refresh cycle (see [Refresh schedule](#refresh-schedule)).

## Integrated

| Source | Endpoint | Auth | What it covers |
| --- | --- | --- | --- |
| Greenhouse Job Board API | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` and `/boards/{token}` for the name | None | Career pages of thousands of companies (Xendit, Okta, Twilio, Agoda, Stripe...). `content=true` returns descriptions and `application_deadline` in one request. |
| Lever Postings API | `GET https://api.lever.co/v0/postings/{company}?mode=json` | None | Companies hiring on Lever (Ninja Van, Nium, Binance, Palantir...). |
| Ashby Posting API | `GET https://api.ashbyhq.com/posting-api/job-board/{board}` | None | Companies hiring on Ashby (Airwallex, OpenAI, Snowflake, Notion...). |
| SmartRecruiters Posting API | `GET https://api.smartrecruiters.com/v1/companies/{id}/postings?q=intern` and `/postings/{id}` | None | Grab, Carousell, Canva, Delivery Hero and Indonesian startups. `q=intern` is a full-text search, so it also returns roles that merely mention "intern" (Grab: 160 results, a handful of internships); the relevance filter does the real selection. Results are paged 100 at a time, and only new, relevant postings that the listing doesn't already exclude are fetched in full, 25 per board per run. |
| Workable job widget | `GET https://apply.workable.com/api/v1/widget/accounts/{account}?details=true` | None | Companies hiring on Workable (Mercari, SmartNews). One request returns every job with its description. |
| CATAPA career pages | `GET https://api-apps.catapa.com/careerpage/{company}/jobs?page=0&size=50` | None | GDP Labs and other Indonesian employers on career.catapa.com. This is the JSON the public career page loads, not a documented API, so it may change without notice. |
| The Muse API | `GET https://www.themuse.com/api/public/jobs?category=...&level=Internship&page=N` | None (500 requests/hour unauthenticated) | Internships aggregated across many companies, filtered by category. Mostly US. Read up to 15 pages (300 postings) per refresh. |
| Himalayas API | `GET https://himalayas.app/jobs/api/search?employment_type=Intern&country={country}&page=N` | None (rate limited) | Remote internships open to a country, including worldwide roles. Paged with `page` (the `offset` parameter is deprecated and now ignored; `cursor` is used when the response returns one). Terms require linking back to Himalayas and naming it as the source: jobs link to their Himalayas page and are labeled Himalayas. |
| Manual entry | None | None | Anything else, including LinkedIn, JobStreet, Glints and Kalibrr postings, and big tech career sites (below). Add it to the board with Add application. |

Import by URL (Greenhouse, Lever and Ashby links resolved through their APIs, other pages read for schema.org `JobPosting` JSON-LD) is planned; the `web` source kind is reserved for it. The server-side fetch must refuse private and loopback addresses before it ships.

The default sources are seeded by `drizzle/0009_discovery_rls_and_defaults.sql` as rows with no owner: Airwallex, OpenAI and Snowflake (Ashby); Ninja Van, Nium and Binance (Lever); Okta, Twilio and Xendit (Greenhouse); Grab (SmartRecruiters); GDP Labs (CATAPA); The Muse (Software Engineering); and Himalayas (open to Indonesia). Each was checked against its live board in October 2026. Flip was dropped: neither the `flip` Greenhouse board nor the `flip` Ashby board belongs to Flip Indonesia, and no public board for it was found. Users add more in Sources, by board name or by pasting the board URL (`parseBoardInput` in `src/lib/source-meta.ts`); the name is checked against the platform before it's saved.

## Eligibility

Every posting is classified before anything else can use it (`src/lib/eligibility.ts`), for a candidate in Bandung, Indonesia (UTC+7) who can work remotely from Indonesia, on-site in Indonesia, or on-site or hybrid in Singapore:

| Status | Meaning |
| --- | --- |
| `eligible_remote` | Fully remote and open to candidates in Indonesia (worldwide, APAC, Asia, or Indonesia named). A stated time-zone overlap is translated into WIB hours (`src/lib/overlap.ts`). |
| `eligible_indonesia` | On-site or hybrid in Indonesia. |
| `eligible_singapore` | On-site or hybrid in Singapore, with a work authorization note: the likely pass (a Training Employment Pass, applied for by the employer, up to 3 months, per Singapore's Ministry of Manpower), whether the internship fits its limit, and what's unknown (whether they sponsor interns from overseas universities). |
| `check_manually` | Ambiguous: remote with no country, remote listed in another Asian country, or no location. The sentence that caused the doubt is shown. Approve it to use it like an eligible posting. |
| `excluded` | On-site or hybrid elsewhere, remote restricted to countries without Indonesia, citizenship or clearance required, or a Singapore role that says it won't sponsor. The reason and the quote are stored. |

How it's decided:

1. Rules first, for free. Location, platform workplace hints (Lever `workplaceType`, Ashby `workplaceType`/`isRemote`, SmartRecruiters `location.remote`/`hybrid`, Workable `telecommuting`, Himalayas `locationRestrictions`) and the description are read with fixed patterns: country and city lists (`src/lib/regions.ts`), "must be located in...", "citizens only", "unable to sponsor", overlap phrases. Equal-opportunity boilerplate is dropped sentence by sentence before any rule runs, so "without regard to citizenship status" never counts as a citizenship rule. Indonesian citizenship requirements don't exclude. SmartRecruiters postings the listing alone excludes (on-site in Beijing, "Remote - US") are stored as `excluded` without fetching their details.
2. A model only when the rules can't settle it. Not built yet: today every `check_manually` result stays for manual review. The plan is the same as the spec: Claude Haiku reads the full description and extracts the facts in `EligibilityFacts`, each with a quote; quotes that don't appear in the posting are dropped, and a fact without one can't change the outcome. It needs `ANTHROPIC_API_KEY`.
3. One pure function decides (`decide()`), so the same facts always give the same status. Unit-tested in `tests/eligibility.test.ts`.

Each posting stores two statuses: `eligibility` and `eligibility_with_pass` (the result if the candidate has a confirmed Singapore work pass). Ticking "I already have a Singapore work pass" on the profile switches which one the feed reads, so no re-check is needed. A user can override any status, or approve a `check_manually` posting, with `PUT /api/listings/{id}/review`; overrides live in `listing_reviews` and are per user.

## Priority

The shortlist (`src/lib/priority.ts`) ranks postings within each status by company tier (`src/config/companies.ts`: 1 big tech, 2 large Southeast Asian tech, 3 remote-first, 4 other), then season (`TARGET_SEASON` in `src/config/discovery.ts`, Summer 2027, first; postings with no season next; other future seasons by start date; seasons already over sink to the bottom), then match score. Status groups are ordered remote, Indonesia, Singapore, check manually. Priority is the default sort; Match and Newest are the alternatives (`?sort=` on `/api/feed`).

## Refresh schedule

Sources are refreshed every 3 days (`src/lib/refresh.ts`). A cron expression like `0 0 */3 * *` restarts every month (the 31st and the 1st run back to back), so instead an hourly cron (`vercel.json`) calls `/api/ingest`, which stores when each cycle starts in `refresh_cycles` and begins a new one once `REFRESH_INTERVAL_HOURS` (72) have passed since the last one started and it has finished. A cycle checks `DISCOVERY_SOURCES_PER_RUN` (4) sources per run until every enabled source has been checked once, which keeps each run inside the function time limit; runs between cycles only close past-deadline postings, classify anything unclassified and embed, then return.

Vercel's Hobby plan only runs cron jobs once a day. On Hobby, either upgrade, or point an external scheduler (Supabase `pg_cron` with `pg_net`, or a GitHub Actions schedule) at `/api/ingest` with `Authorization: Bearer $CRON_SECRET` every hour. A daily run still works: each run keeps ingesting until about 40 seconds have passed, so a small source list finishes a cycle in one run.

Only new or changed postings cost anything: known postings are matched by source and id and compared by a content fingerprint (`embedding_source`, a hash of title, company, location and description). A changed posting is re-classified, its embedding is cleared, and `changed_at` is set. Postings close (`closed_at`, `closed_reason`) when a complete board stops listing them, when an aggregator (The Muse, Himalayas) hasn't shown them for two cycles, or when their deadline passes. A closed posting that reappears is reopened, unless its deadline has passed.

Each finished cycle writes a summary (sources checked and failed; new, changed and closed postings; how many new or changed postings landed in each status; and the top 10 new eligible postings at tier 1 to 3 companies) to `refresh_cycles.summary` and to the logs as a `refresh.summary` JSON line. Refresh Now (a signed-in `POST /api/ingest`, at most once every 5 minutes per user) finishes any running cycle and starts a new one immediately.

## Relevance filter

Only postings that look like software internships are stored (`src/lib/roles.ts`):

- The title or employment type must indicate an internship: intern, internship, co-op, working student, Werkstudent, placement, apprenticeship, magang, kerja praktik, インターン, 實習, 实习. Words like "internal" and "international" don't count.
- The title or department must be technical: software, engineering, data, ML/AI, research, platform, security, QA, mobile, web, and Japanese and Chinese equivalents. Aggregator categories are not used as a department, because The Muse tags every result with the searched category.
- Titles that are clearly non-software (sales, SDR, marketing, partnerships, strategy, curriculum, health and safety, mechanical or electrical engineering, hardware...) are skipped unless they also say software, developer, ML and similar. ".ai" and ".ml" in a company name don't count as AI or ML.

`npm run probe:sources` runs every default board live through the filter and the rules, and prints what would be stored. It's the quickest way to check a pattern change against real postings.

## Normalization

- HTML descriptions become Markdown (`htmlToMarkdown`): headings, lists, bold and links survive, images and scripts don't. Greenhouse's entity-encoded HTML is decoded first. Feed snippets flatten the Markdown back to text.
- Workplace comes from platform hints, or is inferred from the location, title and description.
- Deadlines come from Greenhouse `application_deadline`, CATAPA's closing date, or phrases like "Applications close: 18 Sep 2026" and "apply by 2027-01-10" (`src/lib/posting-hints.ts`). A date without a year is read as the next occurrence. Most postings don't list one.
- Duration ("12 weeks", "3-6 months", "6 bulan") and season ("Summer 2027") hints are extracted for display, and the duration feeds the Singapore pass note.

## Not integrated, and why

| Platform | Reason | Alternative |
| --- | --- | --- |
| LinkedIn | No public jobs API; the User Agreement prohibits scraping and automated access. | Add the posting by hand. Many LinkedIn postings link to a Greenhouse, Lever or Ashby page; add that board as a source. |
| JobStreet (SEEK) | No public jobs API; the terms prohibit scraping. | Manual entry. |
| Glints | No public jobs API; the terms prohibit automated collection. | Manual entry. |
| Kalibrr | Its search endpoint isn't a public API, and its terms name automated extraction and scraping as misuse. GoTo and Gojek post internships there. Earlier versions of this app read it; migration 0008 removes that source and its listings. | Manual entry. |
| RemoteOK, We Work Remotely | Removed in migration 0008. Few internships, and the internships they do list are better covered by Himalayas. | Himalayas. |
| Indeed | Publisher API closed to new partners; terms prohibit scraping. | Manual entry, or add the company's own board. |
| Glassdoor | No public jobs API; terms prohibit scraping. | Manual entry. |
| Handshake | Requires a university login; no public API. | Manual entry. |
| Wellfound | No public API. | Manual entry, or add the company's ATS board as a source. |
| Workday career sites | No public API; each tenant differs and uses bot protection (Traveloka's rejects automated requests). | Manual entry. |
| Shopee, Sea, GoTo, Tokopedia, Bukalapak, Blibli, tiket.com | In-house career portals with no public feed. | Manual entry. |
| Google, Amazon, Microsoft, Meta, Apple, TikTok/ByteDance, NVIDIA | In-house career sites. Their terms of use restrict automated collection, and their posting pages render with JavaScript without JobPosting data. | Manual entry. |
| Adzuna, Jooble, USAJobs | Official APIs, but they require registration keys. | Good candidates for new adapters (see below). |

## Adding a source

1. Create `src/lib/sources/<name>.ts` exporting a `SourceAdapter`:
   - `list(source)`: return `NormalizedListing[]` for the board (build each with `listing()`).
   - `hydrate(source, listing)` (optional): fetch the full posting if `list` omits descriptions; mark summaries with `needsHydration: true`.
   - `resolveName(identifier)`: check the board exists and return a display name; throw if it doesn't.
   - `complete`: `true` if `list` returns every open posting, so missing ones can be closed.
2. Register it in `src/lib/sources/index.ts`.
3. Add the kind to `jobSourceKindEnum` in `src/db/schema.ts` and run `npm run db:generate`; then add it to `SOURCE_KINDS`, `SOURCE_LABELS`, `SOURCE_NEEDS_SLUG`, `SOURCE_SLUG_OPTIONAL`, `SOURCE_COMPLETE` and `SOURCE_SLUG_HINTS` in `src/lib/source-meta.ts`, and its URL pattern to `BOARD_URLS` if it has one.
4. Add a mocked-fetch test to `tests/source-adapters.test.ts`, and the board to `scripts/probe-sources.mts`.
5. If the API needs a key, add it as an environment variable and document it in the README.
