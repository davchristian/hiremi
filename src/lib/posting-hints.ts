const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)";
const YEAR = "(20\\d{2})(?!\\d)";

const DATE_FORMS = [
  { pattern: `${MONTH}\\s+${DAY}(?:,?\\s+${YEAR})?`, month: 1, day: 2, year: 3 },
  { pattern: `${DAY}\\s+${MONTH}(?:,?\\s+${YEAR})?`, month: 2, day: 1, year: 3 },
  { pattern: `${YEAR}-(\\d{2})-(\\d{2})`, month: 2, day: 3, year: 1 },
] as const;

const DEADLINE_LEAD =
  "(?:applications?\\s+(?:will\\s+)?(?:close|closes|closing|are\\s+due|due|deadline)|application\\s+deadline|closing\\s+date|deadline(?:\\s+to\\s+apply)?|apply\\s+(?:by|before)|submit\\s+(?:by|before)|batas\\s+(?:akhir|waktu)\\s+pendaftaran)";

const DEADLINE_PATTERNS = DATE_FORMS.map(
  (form) =>
    [new RegExp(`${DEADLINE_LEAD}[^.\\n]{0,24}?\\b${form.pattern}`, "i"), form] as const,
);

function monthIndex(token: string): number {
  const lower = token.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower) - 1;
  return MONTHS.findIndex((name) => name.startsWith(lower.slice(0, 3)));
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCMonth() === month ? date : null;
}

export function extractDeadline(text: string, reference: Date = new Date()): Date | null {
  let best: { match: RegExpExecArray; form: (typeof DATE_FORMS)[number] } | null = null;
  for (const [pattern, form] of DEADLINE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const end = match.index + match[0].length;
    const bestEnd = best ? best.match.index + best.match[0].length : Infinity;
    if (!best || match.index < best.match.index || (match.index === best.match.index && end < bestEnd)) {
      best = { match, form };
    }
  }
  if (!best) return null;

  const { match, form } = best;
  const month = monthIndex(match[form.month]);
  const day = Number(match[form.day]);
  const explicitYear = match[form.year] ? Number(match[form.year]) : null;
  if (explicitYear) return utcDate(explicitYear, month, day);

  const year = reference.getUTCFullYear();
  const thisYear = utcDate(year, month, day);
  if (!thisYear) return null;
  const sixtyDaysAgo = reference.getTime() - 60 * 24 * 60 * 60 * 1000;
  return thisYear.getTime() < sixtyDaysAgo ? utcDate(year + 1, month, day) : thisYear;
}

const DURATION =
  /\b(\d{1,2})(?:\s*(?:-|to|–)\s*(\d{1,2}))?[\s-]*(weeks?|months?|minggu|bulan)\b/i;

export function extractDuration(text: string): string | null {
  const match = DURATION.exec(text);
  if (!match) return null;
  const [, from, to, rawUnit] = match;
  const unit = /^(week|minggu)/i.test(rawUnit) ? "week" : "month";
  const upper = Number(to ?? from);
  if (upper < 1 || (unit === "week" && upper > 52) || (unit === "month" && upper > 24)) return null;
  const amount = to ? `${Number(from)}-${Number(to)}` : String(Number(from));
  return `${amount} ${unit}${upper === 1 ? "" : "s"}`;
}

export function durationInWeeks(duration: string | null): number | null {
  if (!duration) return null;
  const match = /^(?:\d+-)?(\d+) (week|month)s?$/.exec(duration);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === "week" ? amount : Math.round(amount * 4.345);
}

const SEASON_STARTS: Record<string, number> = { spring: 2, summer: 5, fall: 8, autumn: 8, winter: 0 };

const SEASON =
  /\b(spring|summer|fall|autumn|winter)\s*(?:of\s+)?['’]?(20\d{2}|\d{2})\b|\b(20\d{2})\s+(spring|summer|fall|autumn|winter)\b/i;

export type Season = { label: string; start: Date };

export function extractSeason(text: string): Season | null {
  const match = SEASON.exec(text);
  if (!match) return null;
  const name = (match[1] ?? match[4]).toLowerCase();
  const rawYear = match[2] ?? match[3];
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  const canonical = name === "autumn" ? "fall" : name;
  return {
    label: `${canonical[0].toUpperCase()}${canonical.slice(1)} ${year}`,
    start: new Date(Date.UTC(year, SEASON_STARTS[name], 1)),
  };
}

const SEASON_LENGTH_MS = 92 * 24 * 60 * 60 * 1000;

export function seasonIsOver(start: Date | null, now: Date = new Date()): boolean {
  return start !== null && start.getTime() + SEASON_LENGTH_MS < now.getTime();
}

export type PostingHints = {
  deadline: Date | null;
  duration: string | null;
  season: string | null;
  seasonStart: Date | null;
};

export function postingHints(
  posting: { title: string; description: string; deadline?: Date | null },
  reference: Date = new Date(),
): PostingHints {
  const text = `${posting.title}\n${posting.description}`;
  const season = extractSeason(posting.title) ?? extractSeason(posting.description);
  return {
    deadline: posting.deadline ?? extractDeadline(posting.description, reference),
    duration: extractDuration(text),
    season: season?.label ?? null,
    seasonStart: season?.start ?? null,
  };
}
