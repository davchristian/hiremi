import { COMPANY_TIERS, type CompanyTier } from "@/config/companies";
import { TARGET_SEASON } from "@/config/discovery";
import type { Eligibility } from "@/lib/eligibility";
import { seasonIsOver } from "@/lib/posting-hints";

const SUFFIXES = /\b(?:inc|llc|ltd|limited|pte|plc|corp|corporation|co|company|group|holdings?|tbk|pt|gmbh|sa|ag|bv|kk)\b/g;

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

const TIER_INDEX: [string, CompanyTier][] = Object.entries(COMPANY_TIERS)
  .flatMap(([tier, names]) => names.map((name) => [normalizeCompany(name), Number(tier) as CompanyTier] as [string, CompanyTier]))
  .sort((a, b) => b[0].length - a[0].length);

export function companyTier(company: string): CompanyTier {
  const normalized = normalizeCompany(company);
  if (!normalized) return 4;
  for (const [name, tier] of TIER_INDEX) {
    if (normalized === name || normalized.startsWith(`${name} `) || normalized.endsWith(` ${name}`)) return tier;
  }
  return 4;
}

export const STATUS_ORDER: Eligibility[] = [
  "eligible_remote",
  "eligible_indonesia",
  "eligible_singapore",
  "check_manually",
  "excluded",
];

export function seasonRank(
  season: string | null,
  seasonStart: Date | null,
  now: Date = new Date(),
  target: string = TARGET_SEASON,
): number {
  if (season === target) return 0;
  if (!season || !seasonStart) return 1;
  if (seasonIsOver(seasonStart, now)) return 3;
  return 2;
}

export type Rankable = {
  status: Eligibility | null;
  company: string;
  season: string | null;
  seasonStart: Date | null;
  score: number | null;
  postedAt: Date | null;
};

export function comparePriority(a: Rankable, b: Rankable, now: Date = new Date()): number {
  const status = STATUS_ORDER.indexOf(a.status ?? "check_manually") - STATUS_ORDER.indexOf(b.status ?? "check_manually");
  if (status) return status;
  const tier = companyTier(a.company) - companyTier(b.company);
  if (tier) return tier;
  const season = seasonRank(a.season, a.seasonStart, now) - seasonRank(b.season, b.seasonStart, now);
  if (season) return season;
  if (a.seasonStart && b.seasonStart && a.seasonStart.getTime() !== b.seasonStart.getTime()) {
    return a.seasonStart.getTime() - b.seasonStart.getTime();
  }
  const score = (b.score ?? -1) - (a.score ?? -1);
  if (score) return score;
  return (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
}
