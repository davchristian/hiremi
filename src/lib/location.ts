export const INDONESIA_TERMS = [
  "indonesia",
  "jakarta",
  "bandung",
  "surabaya",
  "yogyakarta",
  "jogja",
  "jogjakarta",
  "denpasar",
  "bali",
  "balikpapan",
  "medan",
  "semarang",
  "makassar",
  "palembang",
  "tangerang",
  "bekasi",
  "depok",
  "bogor",
  "batam",
  "malang",
] as const;

const ALTERNATION = INDONESIA_TERMS.join("|");

const PATTERN = new RegExp(`\\b(${ALTERNATION})\\b`, "i");

export const INDONESIA_SQL_PATTERN = `\\y(${ALTERNATION})\\y`;

export function isIndonesia(...fields: (string | null | undefined)[]): boolean {
  return PATTERN.test(fields.filter(Boolean).join(" "));
}
