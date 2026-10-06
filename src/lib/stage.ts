import { daysSince, todayISODate } from "@/lib/format";

export const STAGE_ORDER = [
  "wishlist",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const STAGE_CONFIG: Record<Stage, { label: string; color: string; emptyHint: string }> = {
  wishlist: {
    label: "Wishlist",
    color: "var(--color-wishlist)",
    emptyHint: "Save roles you want to apply to. Add one here, or from Discover.",
  },
  applied: {
    label: "Applied",
    color: "var(--color-applied)",
    emptyHint: "Move an application here once you've sent it.",
  },
  interview: {
    label: "Interview",
    color: "var(--color-interview)",
    emptyHint: "Applications with an interview scheduled land here.",
  },
  offer: {
    label: "Offer",
    color: "var(--color-offer)",
    emptyHint: "No offers yet.",
  },
  rejected: {
    label: "Rejected",
    color: "var(--color-rejected)",
    emptyHint: "Nothing here.",
  },
};

export const STALE_AFTER_DAYS = 14;

export function isStale(job: { stage: Stage; appliedDate: string | null }): boolean {
  return (
    job.stage === "applied" && job.appliedDate !== null && daysSince(job.appliedDate) >= STALE_AFTER_DAYS
  );
}

export function isFollowUpDue(
  job: { stage: Stage; followUpDate: string | null },
  today: string = todayISODate(),
): boolean {
  return (
    job.followUpDate !== null &&
    job.stage !== "offer" &&
    job.stage !== "rejected" &&
    job.followUpDate.slice(0, 10) <= today
  );
}

export function nextStage(stage: Stage): Stage | null {
  if (stage === "rejected" || stage === "offer") return null;
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[idx + 1] ?? null;
}

export function previousStage(stage: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx <= 0) return null;
  return STAGE_ORDER[idx - 1];
}
