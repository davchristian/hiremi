import type { JobSourceKind } from "@/lib/source-meta";

export type { JobSourceKind } from "@/lib/source-meta";

export type NormalizedListing = {
  source: JobSourceKind;
  externalId: string;
  company: string;
  title: string;
  description: string;
  location: string;
  remote: boolean;
  url: string;
  postedAt: Date | null;
};

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

const USER_AGENT = "job-tracker (personal job application tracker)";
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
