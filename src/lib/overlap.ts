const WIB_OFFSET = 7;

const NAMED_ZONES: [RegExp, number, string][] = [
  [/\b(?:central european(?: summer)? time|cest)\b/i, 2, "CEST"],
  [/\bcet\b/i, 1, "CET"],
  [/\b(?:pacific(?: standard)? time|pst)\b/i, -8, "Pacific time"],
  [/\bpdt\b/i, -7, "PDT"],
  [/\b(?:mountain time|mst)\b/i, -7, "Mountain time"],
  [/\b(?:us central time|central time|cst)\b/i, -6, "US Central time"],
  [/\b(?:eastern(?: standard)? time|est)\b/i, -5, "Eastern time"],
  [/\bedt\b/i, -4, "EDT"],
  [/\b(?:bst|british summer time)\b/i, 1, "BST"],
  [/\beet\b/i, 2, "EET"],
  [/\b(?:ist|india standard time)\b/i, 5.5, "India time"],
  [/\b(?:sgt|singapore time)\b/i, 8, "Singapore time"],
  [/\bhkt\b/i, 8, "Hong Kong time"],
  [/\b(?:pht|philippine time)\b/i, 8, "Philippine time"],
  [/\bjst\b/i, 9, "Japan time"],
  [/\bkst\b/i, 9, "Korea time"],
  [/\baedt\b/i, 11, "AEDT"],
  [/\baest\b/i, 10, "AEST"],
  [/\bnzst\b/i, 12, "New Zealand time"],
  [/\bwib\b/i, 7, "WIB"],
  [/\b(?:gmt|utc)\b(?!\s*[+-−]\s*\d)/i, 0, "UTC"],
];

const SHORT_ZONE = /(?:\d\s*(?:[ap]\.?m\.?)?\s*|\()(PT|MT|CT|ET)\b/;

const SHORT_ZONES: Record<string, { offset: number; label: string }> = {
  PT: { offset: -8, label: "Pacific time" },
  MT: { offset: -7, label: "Mountain time" },
  CT: { offset: -6, label: "US Central time" },
  ET: { offset: -5, label: "Eastern time" },
};

const OFFSET_ZONE = /\b(?:utc|gmt)\s*([+-−])\s*(\d{1,2})(?::?(\d{2}))?\b/i;

const CONTEXT =
  /\b(?:overlap|overlapping|working hours|work hours|business hours|core hours|office hours|time ?zones?|available (?:during|between|from)|online (?:during|between))\b/i;

const RANGE =
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|to|until|and)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;

const HOURS = /\b(\d{1,2})\+?\s*(?:hours?|hrs?)\b/i;

type Zone = { offset: number; label: string };

function zoneIn(sentence: string): Zone | null {
  const offset = OFFSET_ZONE.exec(sentence);
  if (offset) {
    const sign = offset[1] === "+" ? 1 : -1;
    const value = sign * (Number(offset[2]) + (offset[3] ? Number(offset[3]) / 60 : 0));
    return { offset: value, label: offset[0].toUpperCase().replace(/\s+/g, "").replace("−", "-") };
  }
  for (const [pattern, value, label] of NAMED_ZONES) {
    if (pattern.test(sentence)) return { offset: value, label };
  }
  const short = SHORT_ZONE.exec(sentence);
  return short ? SHORT_ZONES[short[1]] : null;
}

function to24(hour: number, meridiem: string | undefined, fallback?: string): number {
  const marker = (meridiem ?? fallback ?? "").toLowerCase().replace(/\./g, "");
  if (marker === "pm" && hour < 12) return hour + 12;
  if (marker === "am" && hour === 12) return 0;
  return hour;
}

export function formatClock(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  const whole = Math.floor(normalized);
  const minutes = Math.round((normalized - whole) * 60);
  const meridiem = whole < 12 ? "am" : "pm";
  const twelve = whole % 12 === 0 ? 12 : whole % 12;
  return minutes ? `${twelve}:${String(minutes).padStart(2, "0")}${meridiem}` : `${twelve}${meridiem}`;
}

function relation(offset: number): string {
  const diff = WIB_OFFSET - offset;
  if (diff === 0) return "the same as WIB";
  const amount = Math.abs(diff);
  return `WIB is ${amount} hour${amount === 1 ? "" : "s"} ${diff > 0 ? "ahead" : "behind"}`;
}

export function translateOverlap(sentence: string): string | null {
  if (!CONTEXT.test(sentence)) return null;
  const zone = zoneIn(sentence);
  if (!zone || zone.offset === WIB_OFFSET) return null;

  const range = RANGE.exec(sentence);
  if (range && (range[3] || range[6] || range[2] || range[5])) {
    const start = to24(Number(range[1]), range[3], range[6]) + (range[2] ? Number(range[2]) / 60 : 0);
    const end = to24(Number(range[4]), range[6]) + (range[5] ? Number(range[5]) / 60 : 0);
    if (start < 24 && end <= 24) {
      const shift = WIB_OFFSET - zone.offset;
      return `${formatClock(start)}-${formatClock(end)} ${zone.label} is ${formatClock(start + shift)}-${formatClock(end + shift)} WIB.`;
    }
  }

  const hours = HOURS.exec(sentence);
  if (hours) {
    return `${Number(hours[1])} hours of overlap with ${zone.label}; ${relation(zone.offset)}.`;
  }
  return `Works with ${zone.label}; ${relation(zone.offset)}.`;
}

export function overlapNote(sentences: string[]): { note: string; quote: string } | null {
  for (const sentence of sentences) {
    const note = translateOverlap(sentence);
    if (note) return { note, quote: sentence };
  }
  return null;
}
