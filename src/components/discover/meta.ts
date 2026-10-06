import type { Eligibility } from "@/lib/eligibility";
import type { PopUpOption } from "@/components/hig/popup-button";

export const STATUS_META: Record<Eligibility, { label: string; section: string; color: string }> = {
  eligible_remote: { label: "Remote, open to Indonesia", section: "Remote, open to Indonesia", color: "var(--color-success)" },
  eligible_indonesia: { label: "In Indonesia", section: "In Indonesia", color: "var(--color-success)" },
  eligible_singapore: { label: "In Singapore", section: "In Singapore", color: "var(--color-success)" },
  check_manually: { label: "Check manually", section: "Check manually", color: "var(--color-warning)" },
  excluded: { label: "Not eligible", section: "Not eligible", color: "var(--color-text-dim)" },
};

export const STATUS_OPTIONS: PopUpOption<Eligibility>[] = (Object.keys(STATUS_META) as Eligibility[]).map((status) => ({
  value: status,
  label: STATUS_META[status].label,
  color: STATUS_META[status].color,
}));

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const WORKPLACE_LABELS: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  unknown: "Not stated",
};
