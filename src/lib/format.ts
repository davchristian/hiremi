/** Derives a commit-hash-style short id from a UUID, e.g. "a3f9c1e". */
export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 7);
}

/** Formats a date as a git-log-style relative age, e.g. "3d ago", "today". */
export function daysAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday as start of week
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
