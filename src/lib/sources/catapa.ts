import { cleanText, fetchFeed, htmlToMarkdown, listing, parseDate, type SourceAdapter } from "./types";

type Named = { name?: string | null } | null | undefined;

type CatapaJob = {
  id: string;
  tenant?: string;
  createdDate?: number;
  updatedDate?: number;
  jobTitle?: Named;
  titleDescription?: string;
  jobLink?: string;
  jobStatus?: string;
  organization?: Named;
  location?: (Named & { city?: Named & { state?: Named & { country?: Named } } }) | null;
  jobDetail?: {
    open?: number | null;
    close?: number | null;
    description?: string | null;
    requirement?: string | null;
    benefit?: string | null;
    employmentType?: Named;
    jobFunction?: Named;
  } | null;
};

const PAGE_SIZE = 50;
const MAX_PAGES = 10;

function jobsUrl(company: string, page: number, size = PAGE_SIZE): string {
  return `https://api-apps.catapa.com/careerpage/${encodeURIComponent(company)}/jobs?page=${page}&size=${size}`;
}

function section(title: string, html: string | null | undefined): string {
  const body = htmlToMarkdown(html ?? "");
  return body ? `## ${title}\n\n${body}` : "";
}

function locationOf(job: CatapaJob): string {
  const city = job.location?.city;
  return [cleanText(job.location?.name), cleanText(city?.state?.country?.name) || "Indonesia"]
    .filter(Boolean)
    .join(", ");
}

export const catapa: SourceAdapter = {
  async list(source) {
    const jobs: CatapaJob[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchFeed(jobsUrl(source.slug, page));
      const json = (await res.json()) as { content?: CatapaJob[]; last?: boolean };
      jobs.push(...(json.content ?? []));
      if (json.last !== false) break;
    }

    return jobs
      .filter((job) => job.id && cleanText(job.jobTitle?.name) && (job.jobStatus ?? "PUBLISHED") === "PUBLISHED")
      .map((job) => {
        const tenant = cleanText(job.tenant) || source.slug;
        return listing({
          source: "catapa",
          externalId: `${source.slug}:${job.id}`,
          board: source.slug,
          company: cleanText(job.organization?.name) || source.label || tenant,
          title: cleanText(job.jobTitle?.name),
          department: cleanText(job.jobDetail?.jobFunction?.name),
          employmentType: [cleanText(job.jobDetail?.employmentType?.name), cleanText(job.titleDescription)]
            .filter(Boolean)
            .join(", "),
          description: [
            section("Description", job.jobDetail?.description),
            section("Requirements", job.jobDetail?.requirement),
            section("Benefits", job.jobDetail?.benefit),
          ]
            .filter(Boolean)
            .join("\n\n"),
          location: locationOf(job),
          url: `https://career.catapa.com${job.jobLink ?? `/${tenant}/${job.id}`}`,
          postedAt: parseDate(job.jobDetail?.open ?? job.createdDate),
          deadline: parseDate(job.jobDetail?.close),
        });
      });
  },

  async resolveName(company) {
    const res = await fetchFeed(jobsUrl(company, 0, 1));
    const json = (await res.json()) as { content?: CatapaJob[] };
    const first = json.content?.[0];
    return cleanText(first?.organization?.name) || cleanText(first?.tenant) || company;
  },
};
