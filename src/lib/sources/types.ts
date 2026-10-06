import type { JobSourceKind } from "@/lib/source-meta";
import type { Workplace } from "@/lib/eligibility";

export type { JobSourceKind } from "@/lib/source-meta";

export type NormalizedListing = {
  source: JobSourceKind;
  externalId: string;
  board: string;
  company: string;
  title: string;
  department: string;
  employmentType: string;
  description: string;
  location: string;
  workplace: Workplace;
  remote: boolean;
  url: string;
  postedAt: Date | null;
  deadline: Date | null;
  countryCodes: string[];
  remoteCountries: string[];
  needsHydration: boolean;
};

export type SourceRef = { kind: JobSourceKind; slug: string; label: string };

export type SourceAdapter = {
  list(source: SourceRef): Promise<NormalizedListing[]>;
  hydrate?(source: SourceRef, listing: NormalizedListing): Promise<NormalizedListing>;
  resolveName(identifier: string): Promise<string>;
  complete: boolean;
};

export function listing(
  fields: Pick<NormalizedListing, "source" | "externalId" | "board" | "company" | "title" | "url"> &
    Partial<NormalizedListing>,
): NormalizedListing {
  const workplace = fields.workplace ?? "unknown";
  return {
    department: "",
    employmentType: "",
    description: "",
    location: "",
    postedAt: null,
    deadline: null,
    countryCodes: [],
    remoteCountries: [],
    needsHydration: false,
    ...fields,
    workplace,
    remote: fields.remote ?? workplace === "remote",
  };
}

export function workplaceFrom(value: string | null | undefined): Workplace {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "remote" || normalized === "fullyremote") return "remote";
  if (normalized === "hybrid") return "hybrid";
  if (normalized === "onsite" || normalized === "inoffice" || normalized === "office") return "onsite";
  return "unknown";
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  zwj: "",
  zwnj: "",
  shy: "",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  sbquo: "‚",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  middot: "·",
  deg: "°",
  times: "×",
  divide: "÷",
  plusmn: "±",
  rarr: "→",
  larr: "←",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  auml: "ä",
  iacute: "í",
  oacute: "ó",
  ouml: "ö",
  uacute: "ú",
  uuml: "ü",
  ntilde: "ñ",
  ccedil: "ç",
  szlig: "ß",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity] ?? ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function isEncodedMarkup(html: string): boolean {
  const encodedTags = html.match(/&lt;\/?[a-z]/gi)?.length ?? 0;
  const rawTags = html.match(/<\/?[a-z]/gi)?.length ?? 0;
  return encodedTags > rawTags;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToText(html: string): string {
  const markup = isEncodedMarkup(html) ? decodeEntities(html) : html;
  const text = markup
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|table|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, " ");

  return normalizeWhitespace(decodeEntities(text));
}

function linkMarkdown(href: string, inner: string): string {
  const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(href) || decodeEntities(href) === decodeEntities(text)) return text;
  return `[${text}](${decodeEntities(href)})`;
}

export function htmlToMarkdown(html: string): string {
  const markup = isEncodedMarkup(html) ? decodeEntities(html) : html;
  const text = markup
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) =>
      linkMarkdown(href, inner),
    )
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag: string, inner: string) => {
      if (/<\/?(?:p|div|li|ul|ol|h[1-6]|br|table|tr)\b/i.test(inner)) return inner;
      const content = inner.replace(/<[^>]+>/g, "").trim();
      return content ? ` **${content}** ` : " ";
    })
    .replace(/<h[1-2]\b[^>]*>/gi, "\n\n## ")
    .replace(/<h[3-6]\b[^>]*>/gi, "\n\n### ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|table|section|article|blockquote)>/gi, "\n\n")
    .replace(/<\/?[a-z][^>]*>/gi, " ");

  return normalizeWhitespace(decodeEntities(text))
    .replace(/\*\*([^*\n]+?)\*\* ([.,;:!?)])/g, "**$1**$2")
    .replace(/^(#{2,3}) +\*\*([^*\n]+)\*\*$/gm, "$1 $2")
    .replace(/^- +/gm, "- ")
    .replace(/^(?:- )?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownToText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainText(text: string | null | undefined): string {
  return normalizeWhitespace(text ?? "");
}

export function cleanText(value: string | null | undefined): string {
  return decodeEntities(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim();
}

export function looksRemote(...fields: string[]): boolean {
  return /\bremote\b|\bwork from home\b|\banywhere\b|\bdistributed\b/i.test(fields.join(" "));
}

export function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(typeof value === "number" ? value : String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export const USER_AGENT =
  "hiremi/1.0 (personal internship tracker; reads public job board APIs on a 3-day cycle)";
const TIMEOUT_MS = 15_000;

export async function fetchFeed(url: string, accept = "application/json"): Promise<Response> {
  const res = await fetch(url, {
    headers: { Accept: accept, "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res;
}
