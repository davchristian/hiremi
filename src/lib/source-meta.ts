import type { jobSourceKindEnum } from "@/db/schema";

export type JobSourceKind = (typeof jobSourceKindEnum.enumValues)[number];

export const SOURCE_KINDS: JobSourceKind[] = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "catapa",
  "themuse",
  "himalayas",
  "ycombinator",
  "linkedin",
];

export const SOURCE_LABELS: Record<JobSourceKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  catapa: "CATAPA",
  themuse: "The Muse",
  himalayas: "Himalayas",
  ycombinator: "Y Combinator",
  linkedin: "LinkedIn",
  web: "Imported page",
};

export const SOURCE_NEEDS_SLUG: Record<JobSourceKind, boolean> = {
  greenhouse: true,
  lever: true,
  ashby: true,
  smartrecruiters: true,
  workable: true,
  catapa: true,
  themuse: false,
  himalayas: false,
  ycombinator: false,
  linkedin: false,
  web: false,
};

export const SOURCE_SLUG_OPTIONAL: Record<JobSourceKind, boolean> = {
  greenhouse: false,
  lever: false,
  ashby: false,
  smartrecruiters: false,
  workable: false,
  catapa: false,
  themuse: true,
  himalayas: true,
  ycombinator: true,
  linkedin: true,
  web: false,
};

export const SOURCE_COMPLETE: Record<JobSourceKind, boolean> = {
  greenhouse: true,
  lever: true,
  ashby: true,
  smartrecruiters: true,
  workable: true,
  catapa: true,
  themuse: false,
  himalayas: false,
  ycombinator: false,
  linkedin: false,
  web: false,
};

export const AGGREGATOR_KINDS: JobSourceKind[] = SOURCE_KINDS.filter((kind) => !SOURCE_COMPLETE[kind]);

export function acceptsSlug(kind: JobSourceKind): boolean {
  return SOURCE_NEEDS_SLUG[kind] || SOURCE_SLUG_OPTIONAL[kind];
}

export const SOURCE_SLUG_HINTS: Record<JobSourceKind, string> = {
  greenhouse: "Board name from boards.greenhouse.io/<name>, or paste the board URL",
  lever: "Company name from jobs.lever.co/<name>, or paste the board URL",
  ashby: "Board name from jobs.ashbyhq.com/<name>, or paste the board URL",
  smartrecruiters: "Company ID from jobs.smartrecruiters.com/<id>, or paste the board URL",
  workable: "Account name from apply.workable.com/<name>, or paste the board URL",
  catapa: "Company name from career.catapa.com/<name>, or paste the board URL",
  themuse: "Category, such as Software Engineering or Data and Analytics. Leave blank for Software Engineering.",
  himalayas: "Country the job must be open to. Leave blank for Indonesia.",
  ycombinator: "A job list page on ycombinator.com, such as jobs/role/software-engineer/singapore. Leave blank for internships.",
  linkedin: "Location to search, such as Singapore or Jakarta. Leave blank for Indonesia.",
  web: "",
};

export const SOURCE_SLUG_DEFAULTS: Partial<Record<JobSourceKind, string>> = {
  themuse: "Software Engineering",
  himalayas: "Indonesia",
  ycombinator: "internships",
  linkedin: "Indonesia",
};

const BOARD_URLS: [JobSourceKind, RegExp][] = [
  ["greenhouse", /^(?:https?:\/\/)?(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i],
  ["greenhouse", /^(?:https?:\/\/)?boards-api\.greenhouse\.io\/v1\/boards\/([\w-]+)/i],
  ["lever", /^(?:https?:\/\/)?jobs(?:\.eu)?\.lever\.co\/([\w.-]+)/i],
  ["ashby", /^(?:https?:\/\/)?jobs\.ashbyhq\.com\/([\w.%-]+)/i],
  ["smartrecruiters", /^(?:https?:\/\/)?(?:jobs|careers)\.smartrecruiters\.com\/([\w-]+)/i],
  ["workable", /^(?:https?:\/\/)?apply\.workable\.com\/([\w-]+)/i],
  ["catapa", /^(?:https?:\/\/)?career\.catapa\.com\/([\w-]+)/i],
];

export function parseBoardInput(input: string): { kind: JobSourceKind; slug: string } | null {
  const value = input.trim();
  for (const [kind, pattern] of BOARD_URLS) {
    const match = pattern.exec(value);
    if (match) return { kind, slug: decodeURIComponent(match[1]) };
  }
  return null;
}
