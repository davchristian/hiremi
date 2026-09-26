import { cleanText, fetchFeed, htmlToText, parseDate, type NormalizedListing } from "./types";

type KalibrrJob = {
  id: number;
  name: string;
  slug: string;
  company_name?: string;
  company?: { code?: string; name?: string };
  description?: string;
  qualifications?: string;
  activation_date?: string;
  is_work_from_home?: boolean;
  is_hybrid?: boolean;
  is_open_to_fresh_grads?: boolean;
  google_location?: {
    address_components?: { city?: string; region?: string; country?: string };
  };
};

const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const DEFAULT_COUNTRY = "Indonesia";

function locationOf(job: KalibrrJob): string {
  const parts = job.google_location?.address_components;
  return [parts?.city, parts?.region, parts?.country].map(cleanText).filter(Boolean).join(", ");
}

function normalize(job: KalibrrJob): NormalizedListing {
  const companyCode = job.company?.code;
  const company = cleanText(job.company_name ?? job.company?.name) || "Unknown";

  const description = [
    htmlToText(job.description ?? ""),
    htmlToText(job.qualifications ?? ""),
    job.is_open_to_fresh_grads ? "Open to fresh graduates." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    source: "kalibrr",
    externalId: String(job.id),
    company,
    title: cleanText(job.name),
    description,
    location: locationOf(job),
    remote: Boolean(job.is_work_from_home),
    url: companyCode
      ? `https://www.kalibrr.com/c/${companyCode}/jobs/${job.id}/${job.slug}`
      : `https://www.kalibrr.com/job/${job.id}/${job.slug}`,
    postedAt: parseDate(job.activation_date),
  };
}

export async function fetchKalibrr(country: string): Promise<NormalizedListing[]> {
  const target = country.trim() || DEFAULT_COUNTRY;
  const listings: NormalizedListing[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `https://www.kalibrr.com/kjs/job_board/search` +
      `?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&country=${encodeURIComponent(target)}`;

    const res = await fetchFeed(url);
    const json = (await res.json()) as { jobs?: KalibrrJob[]; count?: number };
    const jobs = json.jobs ?? [];

    listings.push(...jobs.filter((job) => job.id && cleanText(job.name)).map(normalize));

    if (jobs.length < PAGE_SIZE) break;
  }

  return listings;
}
