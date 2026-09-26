import { cleanText, fetchFeed, htmlToText, parseDate, type NormalizedListing } from "./types";

type RemoteOkRow = {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  tags?: string[];
  legal?: string;
};

export async function fetchRemoteOk(): Promise<NormalizedListing[]> {
  const res = await fetchFeed("https://remoteok.com/api");
  const rows = (await res.json()) as RemoteOkRow[];
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => !row.legal && row.id && cleanText(row.position) && cleanText(row.company))
    .map((row) => {
      const tags = row.tags?.length ? `\n\nTags: ${row.tags.join(", ")}` : "";
      return {
        source: "remoteok" as const,
        externalId: String(row.id),
        company: cleanText(row.company),
        title: cleanText(row.position),
        description: `${htmlToText(row.description ?? "")}${tags}`.trim(),
        location: cleanText(row.location) || "Remote",
        remote: true,
        url: row.url ?? row.apply_url ?? `https://remoteok.com/remote-jobs/${row.slug ?? row.id}`,
        postedAt: parseDate(row.date),
      };
    });
}
