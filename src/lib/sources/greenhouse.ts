import {
  cleanText,
  fetchFeed,
  htmlToText,
  looksRemote,
  parseDate,
  type NormalizedListing,
} from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
  content?: string;
  location?: { name?: string };
};

export async function fetchGreenhouse(slug: string): Promise<NormalizedListing[]> {
  const res = await fetchFeed(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
  );
  const json = (await res.json()) as { jobs?: GreenhouseJob[] };

  return (json.jobs ?? [])
    .filter((job) => job.id && job.title && job.absolute_url)
    .map((job) => {
      const title = cleanText(job.title);
      const location = cleanText(job.location?.name);
      return {
        source: "greenhouse" as const,
        externalId: `${slug}:${job.id}`,
        company: cleanText(job.company_name) || slug,
        title,
        description: htmlToText(job.content ?? ""),
        location,
        remote: looksRemote(location, title),
        url: job.absolute_url,
        postedAt: parseDate(job.first_published ?? job.updated_at),
      };
    });
}
