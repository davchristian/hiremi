const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 7);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(value: string): Date | undefined {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function addDaysISODate(isoDate: string, days: number): string {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function isoDateToTimestamp(isoDate: string): string {
  return `${isoDate.slice(0, 10)}T00:00:00.000Z`;
}

export function daysSince(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

export function ageLabel(days: number): string {
  if (days <= 0) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function daysAgo(date: Date | string): string {
  return ageLabel(daysSince(date));
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return ageLabel(Math.floor(hours / 24));
}

export function startOfUtcWeek(date: Date): number {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return day - date.getUTCDay() * DAY_MS;
}

export function weeksBetween(earlierWeekStart: number, laterWeekStart: number): number {
  return Math.round((laterWeekStart - earlierWeekStart) / WEEK_MS);
}
