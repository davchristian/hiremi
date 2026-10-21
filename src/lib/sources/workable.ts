import { cleanText, fetchFeed, htmlToMarkdown, listing, parseDate, type SourceAdapter } from "./types";

type WorkableLocation = { country?: string; countryCode?: string; city?: string; region?: string; hidden?: boolean };

type WorkableJob = {
  title: string;
  shortcode: string;
  employment_type?: string;
  experience?: string;
  telecommuting?: boolean;
  department?: string;
  function?: string;
  url?: string;
  shortlink?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  locations?: WorkableLocation[];
  description?: string;
};

function accountUrl(account: string, details: boolean): string {
  return `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}${details ? "?details=true" : ""}`;
}

function locationsOf(job: WorkableJob): WorkableLocation[] {
  const visible = (job.locations ?? []).filter((location) => !location.hidden);
  return visible.length ? visible : [{ country: job.country, city: job.city, region: job.state }];
}

export const workable: SourceAdapter = {
  async list(source) {
    const res = await fetchFeed(accountUrl(source.slug, true));
    const json = (await res.json()) as { name?: string; jobs?: WorkableJob[] };
    const company = cleanText(json.name) || source.label || source.slug;

    return (json.jobs ?? [])
      .filter((job) => job.shortcode && cleanText(job.title))
      .map((job) => {
        const locations = locationsOf(job);
        const place = locations
          .map((location) => [location.city, location.region, location.country].map(cleanText).filter(Boolean).join(", "))
          .filter(Boolean)
          .join("; ");
        return listing({
          source: "workable",
          externalId: `${source.slug}:${job.shortcode}`,
          board: source.slug,
          company,
          title: cleanText(job.title),
          department: cleanText(job.department || job.function),
          employmentType: [job.employment_type, job.experience].map(cleanText).filter(Boolean).join(", "),
          description: htmlToMarkdown(job.description ?? ""),
          location: job.telecommuting ? `Remote${place ? `, ${place}` : ""}` : place,
          workplace: job.telecommuting ? "remote" : "unknown",
          url: job.url || job.shortlink || `https://apply.workable.com/j/${job.shortcode}`,
          postedAt: parseDate(job.published_on ?? job.created_at),
          countryCodes: locations.map((location) => cleanText(location.countryCode)).filter(Boolean),
        });
      });
  },

  async resolveName(account) {
    const res = await fetchFeed(accountUrl(account, false));
    const json = (await res.json()) as { name?: string };
    return cleanText(json.name) || account;
  },
};
