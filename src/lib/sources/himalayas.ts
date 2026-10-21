import { cleanText, fetchFeed, htmlToMarkdown, listing, parseDate, type SourceAdapter } from "./types";

type HimalayasJob = {
  title: string;
  companyName?: string;
  employmentType?: string;
  locationRestrictions?: string[];
  categories?: string[];
  description?: string;
  pubDate?: number;
  applicationLink?: string;
  guid?: string;
};

type HimalayasPage = { jobs?: HimalayasJob[]; totalCount?: number; nextCursor?: string | null };

const DEFAULT_COUNTRY = "Indonesia";
const PAGE_SIZE = 20;
const MAX_PAGES = 10;

function searchUrl(country: string, cursor: string | null, page: number): string {
  const base = `https://himalayas.app/jobs/api/search?employment_type=Intern&country=${encodeURIComponent(country)}`;
  if (cursor) return `${base}&cursor=${encodeURIComponent(cursor)}`;
  return page > 1 ? `${base}&page=${page}` : base;
}

export const himalayas: SourceAdapter = {
  async list(source) {
    const country = source.slug.trim() || DEFAULT_COUNTRY;
    const jobs = new Map<string, HimalayasJob>();
    let cursor: string | null = null;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetchFeed(searchUrl(country, cursor, page));
      const json = (await res.json()) as HimalayasPage;
      const batch = (json.jobs ?? []).filter((job) => job.guid || job.applicationLink);
      const before = jobs.size;
      for (const job of batch) jobs.set(job.guid || job.applicationLink!, job);
      cursor = json.nextCursor ?? null;
      if (batch.length < PAGE_SIZE || jobs.size === before || jobs.size >= (json.totalCount ?? 0)) break;
    }

    return [...jobs.values()]
      .filter((job) => cleanText(job.title))
      .map((job) => {
        const restrictions = (job.locationRestrictions ?? []).map(cleanText).filter(Boolean);
        const url = job.guid || job.applicationLink!;
        return listing({
          source: "himalayas",
          externalId: url.replace(/^https?:\/\/himalayas\.app\//, ""),
          board: country,
          company: cleanText(job.companyName) || "Unknown company",
          title: cleanText(job.title),
          employmentType: cleanText(job.employmentType),
          description: htmlToMarkdown(job.description ?? ""),
          location: `Remote (${restrictions.length ? restrictions.join(", ") : "Worldwide"})`,
          workplace: "remote",
          url,
          postedAt: parseDate(job.pubDate ? job.pubDate * 1000 : null),
          remoteCountries: restrictions.length ? restrictions : ["Worldwide"],
        });
      });
  },

  async resolveName(country) {
    return `Himalayas: open to ${country.trim() || DEFAULT_COUNTRY}`;
  },
};
