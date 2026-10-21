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

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  additional?: string;
  lists?: { text?: string; content?: string }[];
  categories?: {
    location?: string;
    allLocations?: string[];
    team?: string;
    department?: string;
    commitment?: string;
  };
};

function describe(posting: LeverPosting): string {
  const intro = posting.description
    ? htmlToMarkdown(posting.description)
    : plainText(posting.descriptionPlain);
  const lists = (posting.lists ?? []).map((list) =>
    [list.text ? `### ${cleanText(list.text)}` : "", htmlToMarkdown(`<ul>${list.content ?? ""}</ul>`)]
      .filter(Boolean)
      .join("\n\n"),
  );
  const additional = posting.additional
    ? htmlToMarkdown(posting.additional)
    : plainText(posting.additionalPlain);
  return [intro, ...lists, additional].filter(Boolean).join("\n\n");
}

function postingsUrl(company: string): string {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
}

export const lever: SourceAdapter = {
  async list(source) {
    const res = await fetchFeed(postingsUrl(source.slug));
    const postings = (await res.json()) as LeverPosting[];

    return (Array.isArray(postings) ? postings : [])
      .filter((posting) => posting.id && posting.text && posting.hostedUrl)
      .map((posting) => {
        const locations = posting.categories?.allLocations?.length
          ? posting.categories.allLocations
          : [posting.categories?.location ?? ""];
        return listing({
          source: "lever",
          externalId: `${source.slug}:${posting.id}`,
          board: source.slug,
          company: source.label || titleCase(source.slug),
          title: cleanText(posting.text),
          department: cleanText(posting.categories?.department || posting.categories?.team),
          employmentType: cleanText(posting.categories?.commitment),
          description: describe(posting),
          location: locations.map(cleanText).filter(Boolean).join("; "),
          workplace: workplaceFrom(posting.workplaceType),
          url: posting.hostedUrl,
          postedAt: parseDate(posting.createdAt),
          countryCodes: posting.country ? [posting.country] : [],
        });
      });
  },

  async resolveName(company) {
    const res = await fetchFeed(postingsUrl(company));
    const postings = (await res.json()) as unknown;
    if (!Array.isArray(postings)) throw new Error(`No Lever board named ${company}`);
    return titleCase(company);
  },
};
