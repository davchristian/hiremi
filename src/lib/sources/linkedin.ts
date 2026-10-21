import { cleanText, fetchFeed, htmlToMarkdown, htmlToText, listing, looksRemote, parseDate, type NormalizedListing, type SourceAdapter } from "./types";

const GUEST_API = "https://www.linkedin.com/jobs-guest/jobs/api";
const DEFAULT_LOCATION = "Indonesia";
const KEYWORDS = "software engineer intern";
const MAX_PAGES = 4;
const PACE_MS = 300;
const COOLDOWN_MS = 10 * 60_000;

let rateLimitedUntil = 0;

async function guestFetch(url: string): Promise<string> {
  if (Date.now() < rateLimitedUntil) throw new Error("LinkedIn is rate limiting requests, try again later");
  await new Promise((resolve) => setTimeout(resolve, PACE_MS));
  try {
    const res = await fetchFeed(url, "text/html");
    return await res.text();
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("responded 429")) rateLimitedUntil = Date.now() + COOLDOWN_MS;
    throw error;
  }
}

function searchUrl(location: string, start: number): string {
  const params = new URLSearchParams({ keywords: KEYWORDS, location, f_JT: "I", start: String(start) });
  return `${GUEST_API}/seeMoreJobPostings/search?${params}`;
}

function textOf(html: string, className: string): string {
  const match = new RegExp(`<[a-z0-9]+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)</[a-z0-9]+>`, "i").exec(html);
  return match ? cleanText(htmlToText(match[1])) : "";
}

function jobUrl(href: string, id: string): string {
  try {
    const url = new URL(cleanText(href));
    return `${url.origin}${url.pathname}`;
  } catch {
    return `https://www.linkedin.com/jobs/view/${id}`;
  }
}

export function parseSearchCards(html: string, location: string): NormalizedListing[] {
  return html
    .split(/<li\b[^>]*>/i)
    .slice(1)
    .flatMap((card) => {
      const id = /urn:li:jobPosting:(\d+)/.exec(card)?.[1];
      const title = textOf(card, "base-search-card__title");
      if (!id || !title) return [];
      const place = textOf(card, "job-search-card__location");
      const href = /class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i.exec(card)?.[1] ?? "";
      return [
        listing({
          source: "linkedin",
          externalId: id,
          board: location,
          company: textOf(card, "base-search-card__subtitle") || "Unknown company",
          title,
          location: place,
          workplace: looksRemote(place) ? "remote" : "unknown",
          url: jobUrl(href, id),
          postedAt: parseDate(/<time[^>]*datetime="([^"]+)"/i.exec(card)?.[1]),
          needsHydration: true,
        }),
      ];
    });
}

function criteria(html: string, label: string): string {
  const pattern = new RegExp(
    `job-criteria-subheader[^>]*>\\s*${label}\\s*</h3>\\s*<span[^>]*>([\\s\\S]*?)</span>`,
    "i",
  );
  return cleanText(pattern.exec(html)?.[1]);
}

export function parseJobPosting(html: string, summary: NormalizedListing): NormalizedListing {
  const markup = /class="show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? "";
  const employment = criteria(html, "Employment type");
  const seniority = criteria(html, "Seniority level");
  return {
    ...summary,
    department: criteria(html, "Job function") || summary.department,
    employmentType: [...new Set([employment, seniority].filter(Boolean))].join(", ") || summary.employmentType,
    description: htmlToMarkdown(markup),
    needsHydration: false,
  };
}

export const linkedin: SourceAdapter = {
  complete: false,

  async list(source) {
    const location = source.slug.trim() || DEFAULT_LOCATION;
    const jobs = new Map<string, NormalizedListing>();
    for (let page = 0; page < MAX_PAGES; page++) {
      let html: string;
      try {
        html = await guestFetch(searchUrl(location, jobs.size));
      } catch (error) {
        if (page === 0) throw error;
        break;
      }
      const cards = parseSearchCards(html, location);
      const before = jobs.size;
      for (const card of cards) jobs.set(card.externalId, card);
      if (!cards.length || jobs.size === before) break;
    }
    return [...jobs.values()];
  },

  async hydrate(_source, summary) {
    try {
      return parseJobPosting(await guestFetch(`${GUEST_API}/jobPosting/${encodeURIComponent(summary.externalId)}`), summary);
    } catch {
      return { ...summary, needsHydration: false };
    }
  },

  async resolveName(location) {
    const value = location.trim() || DEFAULT_LOCATION;
    if (!parseSearchCards(await guestFetch(searchUrl(value, 0)), value).length) {
      throw new Error(`LinkedIn has no software internships in ${value}`);
    }
    return `LinkedIn: ${value}`;
  },
};
