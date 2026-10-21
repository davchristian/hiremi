import { cleanText, decodeEntities, fetchFeed, listing, looksRemote, plainText, type NormalizedListing, type SourceAdapter } from "./types";

type YcJob = {
  id: number;
  title?: string;
  url?: string;
  location?: string;
  type?: string;
  prettyRole?: string;
  roleSpecificType?: string;
  companyName?: string;
  description?: string;
};

type YcPage = { props?: { jobPostings?: YcJob[]; job?: YcJob } };

const ORIGIN = "https://www.ycombinator.com";
const DEFAULT_PAGE = "internships";

function pagePath(slug: string): string {
  return (
    slug
      .trim()
      .replace(/^(?:https?:\/\/)?(?:www\.)?ycombinator\.com\/?/i, "")
      .replace(/[?#].*$/, "")
      .replace(/^\/+|\/+$/g, "")
      .toLowerCase() || DEFAULT_PAGE
  );
}

export function readYcPage(html: string): YcPage {
  const match = /\bdata-page="([^"]*)"/.exec(html);
  if (!match) throw new Error("The YC page has no job data");
  return JSON.parse(decodeEntities(match[1])) as YcPage;
}

async function fetchPage(path: string): Promise<YcPage> {
  const res = await fetchFeed(`${ORIGIN}/${path}`, "text/html");
  return readYcPage(await res.text());
}

function toListing(board: string, job: YcJob): NormalizedListing {
  const location = cleanText(job.location);
  const title = cleanText(job.title);
  return listing({
    source: "ycombinator",
    externalId: String(job.id),
    board,
    company: cleanText(job.companyName) || "Unknown company",
    title,
    department: [cleanText(job.prettyRole), cleanText(job.roleSpecificType)].filter(Boolean).join(", "),
    employmentType: cleanText(job.type),
    description: plainText(job.description),
    location: location.replace(/ \/ /g, "; "),
    workplace: looksRemote(location) && !location.includes(" / ") ? "remote" : "unknown",
    url: new URL(job.url!, ORIGIN).toString(),
    needsHydration: !job.description,
  });
}

export const ycombinator: SourceAdapter = {
  complete: false,

  async list(source) {
    const path = pagePath(source.slug);
    const page = await fetchPage(path);
    return (page.props?.jobPostings ?? [])
      .filter((job) => job.id && job.url && cleanText(job.title))
      .map((job) => toListing(path, job));
  },

  async hydrate(source, summary) {
    const page = await fetchPage(new URL(summary.url).pathname.replace(/^\/+/, ""));
    const job = page.props?.job;
    if (!job?.id) throw new Error(`No YC job at ${summary.url}`);
    return { ...toListing(pagePath(source.slug), { ...job, url: job.url || summary.url }), needsHydration: false };
  },

  async resolveName(slug) {
    const path = pagePath(slug);
    const page = await fetchPage(path);
    if (!page.props?.jobPostings) throw new Error(`ycombinator.com/${path} is not a job list`);
    return path === DEFAULT_PAGE ? "YC: internships" : `YC: ${path.replace(/^jobs\/role\//, "")}`;
  },
};
