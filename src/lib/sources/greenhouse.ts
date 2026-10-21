import { cleanText, fetchFeed, htmlToMarkdown, listing, parseDate, type SourceAdapter } from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
  application_deadline?: string | null;
  content?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
  offices?: { name?: string; location?: string | null }[];
};

function boardUrl(token: string): string {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}`;
}

export const greenhouse: SourceAdapter = {
  async list(source) {
    const res = await fetchFeed(`${boardUrl(source.slug)}/jobs?content=true`);
    const json = (await res.json()) as { jobs?: GreenhouseJob[] };

    return (json.jobs ?? [])
      .filter((job) => job.id && job.title && job.absolute_url)
      .map((job) => {
        const offices = (job.offices ?? []).map((office) => cleanText(office.location || office.name));
        const location = cleanText(job.location?.name) || offices.filter(Boolean).join("; ");
        return listing({
          source: "greenhouse",
          externalId: `${source.slug}:${job.id}`,
          board: source.slug,
          company: cleanText(job.company_name) || source.label || source.slug,
          title: cleanText(job.title),
          department: cleanText(job.departments?.[0]?.name),
          description: htmlToMarkdown(job.content ?? ""),
          location,
          url: job.absolute_url,
          postedAt: parseDate(job.first_published ?? job.updated_at),
          deadline: parseDate(job.application_deadline),
        });
      });
  },

  async resolveName(token) {
    const res = await fetchFeed(boardUrl(token));
    const json = (await res.json()) as { name?: string };
    return cleanText(json.name) || token;
  },
};
