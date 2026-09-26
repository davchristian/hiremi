import {
  cleanText,
  fetchFeed,
  htmlToText,
  looksRemote,
  parseDate,
  plainText,
  type NormalizedListing,
} from "./types";

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  isRemote?: boolean;
  isListed?: boolean;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
};

export async function fetchAshby(slug: string): Promise<NormalizedListing[]> {
  const res = await fetchFeed(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
  );
  const json = (await res.json()) as { jobs?: AshbyJob[] };

  return (json.jobs ?? [])
    .filter((job) => job.id && job.title && job.jobUrl && job.isListed !== false)
    .map((job) => {
      const title = cleanText(job.title);
      const location = cleanText(job.location);
      return {
        source: "ashby" as const,
        externalId: `${slug}:${job.id}`,
        company: slug,
        title,
        description: job.descriptionPlain
          ? plainText(job.descriptionPlain)
          : htmlToText(job.descriptionHtml ?? ""),
        location,
        remote: job.isRemote ?? looksRemote(location, title),
        url: job.jobUrl,
        postedAt: parseDate(job.publishedAt),
      };
    });
}
