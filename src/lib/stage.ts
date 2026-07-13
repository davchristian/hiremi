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
  { label: string; color: string; textClass: string; borderClass: string; bgClass: string; dotClass: string }
> = {
  wishlist: {
    label: "wishlist",
    color: "#B392F0",
    textClass: "text-wishlist",
    borderClass: "border-wishlist",
    bgClass: "bg-wishlist",
    dotClass: "bg-wishlist",
  },
  applied: {
    label: "applied",
    color: "#4EC9E0",
    textClass: "text-applied",
    borderClass: "border-applied",
    bgClass: "bg-applied",
    dotClass: "bg-applied",
  },
  interview: {
    label: "interview",
    color: "#E3B341",
    textClass: "text-interview",
    borderClass: "border-interview",
    bgClass: "bg-interview",
    dotClass: "bg-interview",
  },
  offer: {
    label: "offer",
    color: "#3FB950",
    textClass: "text-offer",
    borderClass: "border-offer",
    bgClass: "bg-offer",
    dotClass: "bg-offer",
  },
  rejected: {
    label: "rejected",
    color: "#F85149",
    textClass: "text-rejected",
    borderClass: "border-rejected",
    bgClass: "bg-rejected",
    dotClass: "bg-rejected",
  },
};

/** The stage a card moves to when the "forward" action is used, or null at the end of the line. */
export function nextStage(stage: Stage): Stage | null {
  if (stage === "rejected" || stage === "offer") return null;
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[idx + 1] ?? null;
}

/** The stage a card moves to when the "back" action is used, or null if already at the start. */
export function previousStage(stage: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx <= 0) return null;
  return STAGE_ORDER[idx - 1];
}
