import type { jobSourceKindEnum } from "@/db/schema";

export type JobSourceKind = (typeof jobSourceKindEnum.enumValues)[number];

export const SOURCE_KINDS: JobSourceKind[] = [
  "kalibrr",
  "greenhouse",
  "lever",
  "ashby",
  "remoteok",
  "weworkremotely",
];

export const SOURCE_LABELS: Record<JobSourceKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  remoteok: "RemoteOK",
  weworkremotely: "We Work Remotely",
  kalibrr: "Kalibrr (Indonesia / SEA)",
};

export const SOURCE_NEEDS_SLUG: Record<JobSourceKind, boolean> = {
  greenhouse: true,
  lever: true,
  ashby: true,
  remoteok: false,
  weworkremotely: false,
  kalibrr: false,
};

export const SOURCE_SLUG_OPTIONAL: Record<JobSourceKind, boolean> = {
  greenhouse: false,
  lever: false,
  ashby: false,
  remoteok: false,
  weworkremotely: false,
  kalibrr: true,
};

export function acceptsSlug(kind: JobSourceKind): boolean {
  return SOURCE_NEEDS_SLUG[kind] || SOURCE_SLUG_OPTIONAL[kind];
}

export const SOURCE_SLUG_HINTS: Record<JobSourceKind, string> = {
  greenhouse: "from boards.greenhouse.io/<slug>",
  lever: "from jobs.lever.co/<slug>",
  ashby: "from jobs.ashbyhq.com/<slug>",
  remoteok: "aggregate feed — no slug needed",
  weworkremotely: "aggregate feed — no slug needed",
  kalibrr: "country — leave blank for Indonesia, or try Philippines",
};
