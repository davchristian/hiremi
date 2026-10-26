import { cleanText, fetchFeed, htmlToMarkdown, listing, parseDate, type SourceAdapter } from "./types";

type MuseJob = {
  id: number;
  name: string;
  contents?: string;
  publication_date?: string;
  locations?: { name?: string }[];
  categories?: { name?: string }[];
  levels?: { name?: string }[];
  refs?: { landing_page?: string };
  company?: { name?: string };
};

const DEFAULT_CATEGORY = "Software Engineering";
const MAX_PAGES = 15;

function pageUrl(category: string, page: number): string {
  return `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(category)}&level=Internship&page=${page}`;
}

export const themuse: SourceAdapter = {
  async list(source) {
    const category = source.slug.trim() || DEFAULT_CATEGORY;
    const jobs: MuseJob[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchFeed(pageUrl(category, page));
      const json = (await res.json()) as { results?: MuseJob[]; page_count?: number };
      jobs.push(...(json.results ?? []));
      if (page + 1 >= (json.page_count ?? 0)) break;
    }

    return jobs
      .filter((job) => job.id && cleanText(job.name) && job.refs?.landing_page)
      .map((job) => {
        const locations = (job.locations ?? []).map((location) => cleanText(location.name)).filter(Boolean);
        const remote = locations.some((location) => /flexible|remote/i.test(location));
        return listing({
          source: "themuse",
          externalId: String(job.id),
          board: category,
          company: cleanText(job.company?.name) || "Unknown company",
          title: cleanText(job.name),
          employmentType: (job.levels ?? []).map((entry) => cleanText(entry.name)).filter(Boolean).join(", "),
          description: htmlToMarkdown(job.contents ?? ""),
          location: locations.join("; "),
          workplace: remote && locations.length === 1 ? "remote" : "unknown",
          url: job.refs!.landing_page!,
          postedAt: parseDate(job.publication_date),
        });
      });
  },

  async resolveName(category) {
    const value = category.trim() || DEFAULT_CATEGORY;
    const res = await fetchFeed(pageUrl(value, 0));
    const json = (await res.json()) as { total?: number };
    if (!json.total) throw new Error(`The Muse has no internships in the category ${value}`);
    return `The Muse: ${value}`;
  },
};
