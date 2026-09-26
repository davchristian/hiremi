import { cleanText, fetchFeed, htmlToText, parseDate, type NormalizedListing } from "./types";

const FEED_URL = "https://weworkremotely.com/categories/remote-programming-jobs.rss";

function tagContent(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

export async function fetchWeWorkRemotely(): Promise<NormalizedListing[]> {
  const res = await fetchFeed(FEED_URL, "application/rss+xml, application/xml, text/xml");
  const xml = await res.text();

  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const listings: NormalizedListing[] = [];

  for (const item of items) {
    const link = cleanText(tagContent(item, "link"));
    if (!link) continue;

    const rawTitle = tagContent(item, "title");
    const separator = rawTitle.indexOf(":");
    const company = separator > 0 ? cleanText(rawTitle.slice(0, separator)) : "Unknown";
    const title = cleanText(separator > 0 ? rawTitle.slice(separator + 1) : rawTitle);
    if (!title) continue;

    listings.push({
      source: "weworkremotely",
      externalId: cleanText(tagContent(item, "guid")) || link,
      company: company || "Unknown",
      title,
      description: htmlToText(tagContent(item, "description")),
      location: cleanText(tagContent(item, "region")) || "Remote",
      remote: true,
      url: link,
      postedAt: parseDate(tagContent(item, "pubDate")),
    });
  }

  return listings;
}
