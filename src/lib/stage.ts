import { daysSince } from "@/lib/format";

export const STAGE_ORDER = [
  "wishlist",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const STAGE_CONFIG: Record<
  Stage,
  {
    label: string;
    textClass: string;
    borderClass: string;
    bgClass: string;
    dotClass: string;
    emptyHint: string;
  }
> = {
  wishlist: {
    label: "wishlist",
    textClass: "text-wishlist",
    borderClass: "border-wishlist",
    bgClass: "bg-wishlist",
    dotClass: "bg-wishlist",
    emptyHint: "nothing saved yet — add your first application",
  },
  applied: {
    label: "applied",
    textClass: "text-applied",
    borderClass: "border-applied",
    bgClass: "bg-applied",
    dotClass: "bg-applied",
    emptyHint: "move a card here once you apply",
  },
  interview: {
    label: "interview",
    textClass: "text-interview",
    borderClass: "border-interview",
    bgClass: "bg-interview",
    dotClass: "bg-interview",
    emptyHint: "interviews land here",
  },
  offer: {
    label: "offer",
    textClass: "text-offer",
    borderClass: "border-offer",
    bgClass: "bg-offer",
    dotClass: "bg-offer",
    emptyHint: "no offers yet",
  },
  rejected: {
    label: "rejected",
    textClass: "text-rejected",
    borderClass: "border-rejected",
    bgClass: "bg-rejected",
    dotClass: "bg-rejected",
    emptyHint: "none yet",
  },
};

export const STALE_AFTER_DAYS = 14;

export function isStale(job: { stage: Stage; appliedDate: string | null }): boolean {
  return (
    job.stage === "applied" && job.appliedDate !== null && daysSince(job.appliedDate) >= STALE_AFTER_DAYS
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
