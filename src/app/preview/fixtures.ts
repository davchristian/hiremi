import type { FeedMatch } from "@/lib/feed";
import type { RefreshOverview } from "@/lib/refresh";
import type { ClientJob, ClientProfile, ClientSource } from "@/lib/types";

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function calendarDay(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function job(id: number, fields: Partial<ClientJob> & Pick<ClientJob, "company" | "role" | "stage">): ClientJob {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    appliedDate: null,
    followUpDate: null,
    link: null,
    notes: "",
    createdAt: daysAgo(id),
    updatedAt: daysAgo(1),
    ...fields,
  };
}

export const PREVIEW_JOBS: ClientJob[] = [
  job(1, { company: "Traveloka", role: "Backend Engineer Intern", stage: "wishlist" }),
  job(2, { company: "Halodoc", role: "Software Engineer Intern, Platform", stage: "wishlist" }),
  job(3, { company: "Xendit", role: "Platform Engineer Intern", stage: "applied", appliedDate: calendarDay(-8), followUpDate: calendarDay(-1) }),
  job(4, { company: "Mekari", role: "Backend Engineer Intern (Go)", stage: "applied", appliedDate: calendarDay(-7), followUpDate: calendarDay(0) }),
  job(5, { company: "Bukalapak", role: "Site Reliability Engineer Intern", stage: "applied", appliedDate: calendarDay(-16) }),
  job(6, { company: "Ninja Van", role: "Software Engineer Intern, Logistics", stage: "applied", appliedDate: calendarDay(-3), followUpDate: calendarDay(4) }),
  job(7, { company: "Gojek", role: "Product Engineer Intern, Payments", stage: "interview", appliedDate: calendarDay(-21) }),
  job(8, { company: "Tokopedia", role: "Software Engineer Intern", stage: "interview", appliedDate: calendarDay(-14) }),
  job(9, { company: "Grab", role: "Associate Software Engineer Intern", stage: "offer", appliedDate: calendarDay(-35) }),
  job(10, { company: "Shopee", role: "Backend Engineer Intern", stage: "rejected", appliedDate: calendarDay(-42) }),
  job(11, { company: "Agoda", role: "Data Engineer Intern", stage: "rejected", appliedDate: calendarDay(-50) }),
];

function match(id: number, fields: Partial<FeedMatch> & Pick<FeedMatch, "company" | "title" | "status" | "location">): FeedMatch {
  return {
    id: `10000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    source: "greenhouse",
    snippet: "",
    workplace: "unknown",
    remote: false,
    url: "https://example.com/posting",
    postedAt: daysAgo(id * 2),
    deadline: null,
    duration: null,
    season: null,
    score: null,
    matchedTerms: [],
    indonesia: false,
    statusLabel: "",
    reason: null,
    quote: null,
    workAuthorizationNote: null,
    overlapNote: null,
    overridden: false,
    approved: false,
    tier: 4,
    trackedJobId: null,
    ...fields,
  };
}

export const PREVIEW_MATCHES: FeedMatch[] = [
  match(1, {
    company: "Nearby",
    title: "Software Engineer Intern",
    location: "Remote (Worldwide)",
    source: "himalayas",
    workplace: "remote",
    remote: true,
    status: "eligible_remote",
    reason: "Remote and open worldwide",
    quote: "Remote (Worldwide)",
    overlapNote: "3 hours of overlap with CET; WIB is 6 hours ahead.",
    score: 0.58,
    matchedTerms: ["Go", "PostgreSQL", "Backend"],
    duration: "3 months",
  }),
  match(2, {
    company: "Kitabisa",
    title: "Data Analyst Intern",
    location: "Remote (Indonesia, Vietnam)",
    source: "himalayas",
    workplace: "remote",
    remote: true,
    status: "eligible_remote",
    reason: "Remote and open to candidates in Indonesia",
    quote: "Remote (Indonesia, Vietnam)",
    score: 0.41,
    matchedTerms: ["SQL"],
  }),
  match(3, {
    company: "GDP Labs",
    title: "Software Development Engineer - Internship",
    location: "Jakarta, Indonesia",
    source: "catapa",
    status: "eligible_indonesia",
    reason: "Based in Indonesia",
    quote: "Jakarta, Indonesia",
    score: 0.55,
    matchedTerms: ["Python", "Backend"],
    duration: "6 months",
    deadline: calendarDay(40),
    tier: 2,
    trackedJobId: "00000000-0000-4000-8000-000000000099",
  }),
  match(4, {
    company: "Xendit",
    title: "Backend Engineering Intern (Summer 2027)",
    location: "Jakarta, Indonesia",
    status: "eligible_indonesia",
    reason: "Hybrid in Indonesia",
    workplace: "hybrid",
    quote: "Jakarta, Indonesia",
    score: 0.62,
    season: "Summer 2027",
    matchedTerms: ["Go", "Payments", "APIs"],
    tier: 2,
  }),
  match(5, {
    company: "Airwallex",
    title: "Software Engineer Intern (Summer 2027)",
    location: "SG - Singapore; Singapore",
    source: "ashby",
    workplace: "onsite",
    status: "eligible_singapore",
    reason: "On-site in Singapore",
    quote: "SG - Singapore; Singapore",
    workAuthorizationNote:
      "Likely pass: a Training Employment Pass, applied for by the employer, valid for up to 3 months (Singapore Ministry of Manpower). The stated duration (12 weeks) fits that limit. Unknown: whether they sponsor interns from overseas universities.",
    season: "Summer 2027",
    duration: "12 weeks",
    deadline: calendarDay(54),
    score: 0.6,
    matchedTerms: ["Go", "Payments"],
    tier: 2,
  }),
  match(6, {
    company: "TikTok",
    title: "AI Infrastructure Engineer Intern (TikTok Live Recommendation)",
    location: "Singapore",
    source: "themuse",
    status: "eligible_singapore",
    reason: "Based in Singapore",
    quote: "Singapore",
    workAuthorizationNote:
      "Likely pass: a Training Employment Pass, applied for by the employer, valid for up to 3 months (Singapore Ministry of Manpower). The stated duration (3 months) fits that limit. Unknown: whether they sponsor interns from overseas universities.",
    duration: "3 months",
    score: 0.47,
    tier: 1,
  }),
  match(7, {
    company: "Mercari, inc.",
    title: "Class of 2028 Software Engineer Internship",
    location: "Remote, Minato City, Tokyo, Japan",
    source: "workable",
    workplace: "remote",
    remote: true,
    status: "check_manually",
    reason: "Remote, but listed in another Asian country; it may not be open to Indonesia",
    quote: "Remote, Minato City, Tokyo, Japan",
    duration: "2-3 months",
    deadline: calendarDay(25),
    score: 0.39,
    tier: 2,
  }),
];

export const PREVIEW_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  PREVIEW_MATCHES.map((entry) => [
    entry.id,
    `## About the role\n\nJoin the **${entry.company}** engineering team and ship production code from your first week. See [the engineering blog](https://example.com/blog) for how the team works.\n\n### What you'll do\n\n- Build and maintain services in Go and PostgreSQL\n- Write tests and take part in code review\n- Work with a mentor on a project you present at the end\n\n### What we look for\n\n- Currently studying computer science or a related field\n- Comfortable with at least one backend language\n- Curious, and clear in writing`,
  ]),
);

function source(id: number, fields: Partial<ClientSource> & Pick<ClientSource, "kind" | "slug" | "label">): ClientSource {
  return {
    id: `20000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    isDefault: true,
    lastFetchedAt: daysAgo(1),
    lastError: null,
    ...fields,
  };
}

export const PREVIEW_SOURCES: ClientSource[] = [
  source(1, { kind: "greenhouse", slug: "agoda", label: "Agoda", isDefault: false }),
  source(2, { kind: "lever", slug: "carousell", label: "Carousell", isDefault: false, lastError: "https://api.lever.co/v0/postings/carousell responded 404" }),
  source(3, { kind: "ashby", slug: "airwallex", label: "Airwallex" }),
  source(4, { kind: "ashby", slug: "openai", label: "OpenAI" }),
  source(5, { kind: "lever", slug: "ninjavan", label: "Ninja Van" }),
  source(6, { kind: "greenhouse", slug: "xendit", label: "Xendit" }),
  source(7, { kind: "smartrecruiters", slug: "grab", label: "Grab" }),
  source(8, { kind: "catapa", slug: "gdplabs", label: "GDP Labs" }),
  source(9, { kind: "themuse", slug: "Software Engineering", label: "The Muse: Software Engineering" }),
  source(10, { kind: "himalayas", slug: "Indonesia", label: "Himalayas: open to Indonesia", lastFetchedAt: null }),
];

export const PREVIEW_OVERVIEW: RefreshOverview = {
  running: { startedAt: daysAgo(0), remaining: 5 },
  lastFinishedAt: daysAgo(3),
  lastSummary: {
    sourcesChecked: 13,
    sourcesFailed: 1,
    newPostings: 17,
    changedPostings: 4,
    closedPostings: 6,
    byStatus: { eligible_remote: 9, eligible_indonesia: 2, eligible_singapore: 7, check_manually: 2, excluded: 31 },
    topNew: [
      { id: "a", company: "Airwallex", title: "Software Engineer Intern (Summer 2027)", status: "eligible_singapore", tier: 2 },
      { id: "b", company: "TikTok", title: "AI Infrastructure Engineer Intern", status: "eligible_singapore", tier: 1 },
    ],
  },
};

export const PREVIEW_PROFILE: ClientProfile = {
  targetRoles: ["Backend Engineer Intern", "Data Engineer Intern"],
  skills: ["Go", "PostgreSQL", "Python", "React"],
  experienceLevel: "student",
  locationPreference: "Bandung, Jakarta or remote",
  workMode: "any",
  blurb: "Final-year CS student who likes backend work: Postgres, APIs, and anything with a queue in it.",
  singaporePassConfirmed: false,
  hasEmbedding: true,
};
