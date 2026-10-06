import { cleanText, fetchFeed, htmlToMarkdown, listing, parseDate, type SourceAdapter } from "./types";

type SrLocation = {
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
  hybrid?: boolean;
  fullLocation?: string;
};

type SrPosting = {
  id: string;
  name: string;
  company?: { identifier?: string; name?: string };
  releasedDate?: string;
  location?: SrLocation;
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  customField?: { fieldLabel?: string; valueLabel?: string }[];
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
};

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const API = "https://api.smartrecruiters.com/v1/companies";

function customField(posting: SrPosting, label: string): string {
  return cleanText(posting.customField?.find((field) => field.fieldLabel === label)?.valueLabel);
}

function locationOf(location: SrLocation | undefined): string {
  if (!location) return "";
  const full = cleanText(location.fullLocation).replace(/(?:,\s*)+/g, ", ").replace(/^,\s*|,\s*$/g, "");
  const base = full || [location.city, location.region].map(cleanText).filter(Boolean).join(", ");
  return location.remote ? `Remote${base ? `, ${base}` : ""}` : base;
}

function postingUrl(company: string, posting: SrPosting): string {
  return posting.postingUrl || `https://jobs.smartrecruiters.com/${encodeURIComponent(company)}/${posting.id}`;
}

function toListing(company: string, label: string, posting: SrPosting) {
  const experience = cleanText(posting.experienceLevel?.label);
  const employment = cleanText(posting.typeOfEmployment?.label);
  const jobFamily = customField(posting, "Job Family");
  return listing({
    source: "smartrecruiters",
    externalId: `${company}:${posting.id}`,
    board: company,
    company: cleanText(posting.company?.name) || label || company,
    title: cleanText(posting.name),
    department:
      cleanText(posting.department?.label) || customField(posting, "Department Name") || cleanText(posting.function?.label),
    employmentType: [employment, experience, jobFamily].filter(Boolean).join(", "),
    location: locationOf(posting.location),
    workplace: posting.location?.remote ? "remote" : posting.location?.hybrid ? "hybrid" : "unknown",
    url: postingUrl(company, posting),
    postedAt: parseDate(posting.releasedDate),
    countryCodes: posting.location?.country ? [posting.location.country] : [],
    needsHydration: true,
  });
}

export const smartrecruiters: SourceAdapter = {
  complete: true,

  async list(source) {
    const company = source.slug;
    const postings: SrPosting[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchFeed(
        `${API}/${encodeURIComponent(company)}/postings?q=intern&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      const json = (await res.json()) as { content?: SrPosting[]; totalFound?: number };
      const content = json.content ?? [];
      postings.push(...content);
      if (content.length < PAGE_SIZE || postings.length >= (json.totalFound ?? 0)) break;
    }
    return postings
      .filter((posting) => posting.id && cleanText(posting.name))
      .map((posting) => toListing(company, source.label, posting));
  },

  async hydrate(source, summary) {
    const id = summary.externalId.slice(summary.externalId.indexOf(":") + 1);
    const res = await fetchFeed(`${API}/${encodeURIComponent(source.slug)}/postings/${encodeURIComponent(id)}`);
    const posting = (await res.json()) as SrPosting;
    const sections = posting.jobAd?.sections ?? {};
    const description = ["jobDescription", "qualifications", "additionalInformation", "companyDescription"]
      .map((key) => sections[key])
      .filter((section) => section?.text)
      .map((section) => `## ${cleanText(section!.title)}\n\n${htmlToMarkdown(section!.text ?? "")}`)
      .join("\n\n");
    return { ...toListing(source.slug, source.label, { ...posting, id }), description, needsHydration: false };
  },

  async resolveName(company) {
    const res = await fetchFeed(`${API}/${encodeURIComponent(company)}/postings?limit=1`);
    const json = (await res.json()) as { content?: SrPosting[]; totalFound?: number };
    const first = json.content?.[0];
    if (!first) throw new Error(`No open SmartRecruiters postings for ${company}`);
    return cleanText(first.company?.name) || company;
  },
};
