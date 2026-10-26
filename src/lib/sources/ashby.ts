import {
  cleanText,
  fetchFeed,
  htmlToMarkdown,
  listing,
  parseDate,
  plainText,
  workplaceFrom,
  type SourceAdapter,
} from "./types";
import { titleCase } from "./names";

type AshbyAddress = { postalAddress?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } };

type AshbyJob = {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string; address?: AshbyAddress }[];
  isRemote?: boolean;
  isListed?: boolean;
  workplaceType?: string | null;
  address?: AshbyAddress;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
};

function boardUrl(board: string): string {
  return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`;
}

function employmentLabel(value: string | undefined): string {
  return cleanText(value).replace(/([a-z])([A-Z])/g, "$1 $2");
}

export const ashby: SourceAdapter = {
  async list(source) {
    const res = await fetchFeed(boardUrl(source.slug));
    const json = (await res.json()) as { jobs?: AshbyJob[] };

    return (json.jobs ?? [])
      .filter((job) => job.id && job.title && job.jobUrl && job.isListed !== false)
      .map((job) => {
        const locations = [job.location, ...(job.secondaryLocations ?? []).map((entry) => entry.location)];
        const countries = [job.address, ...(job.secondaryLocations ?? []).map((entry) => entry.address)]
          .map((address) => cleanText(address?.postalAddress?.addressCountry))
          .filter(Boolean);
        const workplace = workplaceFrom(job.workplaceType);
        return listing({
          source: "ashby",
          externalId: `${source.slug}:${job.id}`,
          board: source.slug,
          company: source.label || titleCase(source.slug),
          title: cleanText(job.title),
          department: cleanText(job.department || job.team),
          employmentType: employmentLabel(job.employmentType),
          description: job.descriptionHtml
            ? htmlToMarkdown(job.descriptionHtml)
            : plainText(job.descriptionPlain),
          location: [...new Set([...locations.map(cleanText), ...countries].filter(Boolean))].join("; "),
          workplace: workplace === "unknown" && job.isRemote ? "remote" : workplace,
          url: job.jobUrl,
          postedAt: parseDate(job.publishedAt),
        });
      });
  },

  async resolveName(board) {
    const res = await fetchFeed(boardUrl(board));
    const json = (await res.json()) as { jobs?: unknown };
    if (!Array.isArray(json.jobs)) throw new Error(`No Ashby board named ${board}`);
    return titleCase(board);
  },
};
