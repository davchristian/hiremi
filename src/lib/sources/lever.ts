import {
  cleanText,
  fetchFeed,
  htmlToText,
  looksRemote,
  parseDate,
  plainText,
  type NormalizedListing,
} from "./types";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  workplaceType?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  lists?: { text?: string; content?: string }[];
  categories?: { location?: string; team?: string; commitment?: string };
};

function describe(posting: LeverPosting): string {
  const intro = posting.descriptionPlain
    ? plainText(posting.descriptionPlain)
    : htmlToText(posting.description ?? "");
  const lists = (posting.lists ?? []).map((list) =>
    [cleanText(list.text), htmlToText(list.content ?? "")].filter(Boolean).join("\n"),
  );
  return [intro, ...lists, plainText(posting.additionalPlain)].filter(Boolean).join("\n\n");
}

export async function fetchLever(slug: string): Promise<NormalizedListing[]> {
  const res = await fetchFeed(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  );
  const postings = (await res.json()) as LeverPosting[];

  return (Array.isArray(postings) ? postings : [])
    .filter((posting) => posting.id && posting.text && posting.hostedUrl)
    .map((posting) => {
      const title = cleanText(posting.text);
      const location = cleanText(posting.categories?.location);
      return {
        source: "lever" as const,
        externalId: `${slug}:${posting.id}`,
        company: slug,
        title,
        description: describe(posting),
        location,
        remote:
          posting.workplaceType === "remote" ||
          looksRemote(location, title, posting.categories?.commitment ?? ""),
        url: posting.hostedUrl,
        postedAt: parseDate(posting.createdAt),
      };
    });
}
