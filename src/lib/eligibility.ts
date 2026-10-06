import type { eligibilityEnum, workplaceEnum } from "@/db/schema";
import { overlapNote } from "@/lib/overlap";
import { durationInWeeks } from "@/lib/posting-hints";
import { REGION_LABELS, regionOfCountryCode, regionsIn, type Region } from "@/lib/regions";

export type Eligibility = (typeof eligibilityEnum.enumValues)[number];
export type Workplace = (typeof workplaceEnum.enumValues)[number];

export const ELIGIBLE_STATUSES: readonly Eligibility[] = [
  "eligible_remote",
  "eligible_indonesia",
  "eligible_singapore",
];

export const STATUS_LABELS: Record<Eligibility, string> = {
  eligible_remote: "Remote, open to Indonesia",
  eligible_indonesia: "In Indonesia",
  eligible_singapore: "In Singapore",
  check_manually: "Check manually",
  excluded: "Not eligible",
};

export type RemoteScope =
  | "worldwide"
  | "apac"
  | "asia"
  | "indonesia"
  | "asia_other"
  | "excludes_indonesia"
  | "unspecified";

export type EligibilityFacts = {
  workplace: Workplace;
  onsiteRegions: Region[];
  remoteScope: RemoteScope | null;
  citizenshipRequired: boolean;
  clearanceRequired: boolean;
  noSponsorship: boolean;
  overlap: string | null;
  quotes: {
    location?: string;
    remote?: string;
    citizenship?: string;
    clearance?: string;
    sponsorship?: string;
    overlap?: string;
  };
};

export type EligibilityDecision = {
  status: Eligibility;
  reason: string;
  quote: string | null;
  workAuthorizationNote: string | null;
  overlapNote: string | null;
};

export type DecideOptions = { singaporePass: boolean; duration: string | null };

export type PostingForEligibility = {
  title: string;
  location: string;
  description: string;
  workplace?: Workplace | null;
  countryCodes?: string[];
  remoteCountries?: string[];
  duration?: string | null;
};

const BOILERPLATE =
  /\b(?:equal (?:employment )?opportunit|without regard to|regardless of|race,? colou?r|national origin|veteran status|gender identity|sexual orientation|e-verify|reasonable accommodation|affirmative action|protected (?:characteristic|veteran|class|status)|privacy (?:notice|policy))/i;

const REMOTE_WORD = /\b(?:remote|remotely|work from home|wfh|fully distributed|distributed team|work from anywhere)\b/i;
const HYBRID_WORD = /\bhybrid\b/i;
const ONSITE_WORD = /\b(?:on-?site|in[- ]office|office[- ]based|in person|in-person)\b/i;

const WORLDWIDE = /\b(?:worldwide|anywhere(?! in the (?:us|u\.s\.|united states|uk|eu))|global(?:ly)?|any (?:location|country)|all countries|location[- ]independent|work from anywhere)\b/i;
const APAC = /\b(?:apac|asia[- ]pacific|asia pac)\b/i;
const ASIA = /\b(?:asia|south[- ]?east asia|asean)\b/i;

const WORLDWIDE_SENTENCE =
  /\b(?:work from anywhere|anywhere in the world|(?:remote|work)\s+(?:from\s+)?(?:worldwide|globally|anywhere)\b(?! in the (?:us|u\.s\.|united states|uk|eu))|open to (?:candidates|applicants)?\s*(?:from\s+)?(?:anywhere|worldwide|all countries|any country)|from any country|location[- ]independent)/i;

const RESTRICTION =
  /\b(?:must|should|need to|needs to|required to|have to)\s+(?:be\s+)?(?:currently\s+)?(?:located|based|residing|reside|live|living)\s+(?:in|within)\b|\b(?:open|available|limited)\s+(?:only\s+)?to\s+(?:candidates|applicants|residents|people|those)?\s*(?:who\s+(?:are|live)\s+)?(?:located\s+|based\s+|residing\s+)?in\b|\b(?:authori[sz]ed|eligible|legally able)\s+to\s+work\s+in\b|\b(?:u\.?s\.?|us|uk|eu|europe|canada)[- ]based\b|\b(?:us|u\.s\.|uk|eu|emea|americas|europe|canada|latam)\s+only\b|\bonly\s+(?:hire|hiring|accept)\w*\s+(?:candidates\s+)?(?:in|from)\b/i;

const CITIZENSHIP =
  /\b(?:u\.?s\.?|american|singapore(?:an)?|uk|british|canadian|australian|eu|japanese|korean|chinese|indian)\s+citizen(?:s|ship)?\b|\bcitizens?\s+only\b|\bmust\s+(?:be|hold)\s+(?:a\s+)?(?:[\w.]+\s+){0,2}citizen(?:ship)?\b|\bcitizenship\s+(?:is\s+)?required\b|\b(?:citizens?|PRs?)\s*(?:and|or|\/)\s*(?:permanent residents?|PRs?|citizens?)\s+only\b|\bpermanent residents?\s+only\b|\bsingaporeans?\s+(?:and|or|\/)\s+(?:singapore\s+)?PRs?\b|\bsingaporeans?\s+only\b/i;

const INDONESIAN_CITIZEN = /\b(?:indonesian|wni|warga negara indonesia)\b/i;

const CLEARANCE =
  /\b(?:security clearance|secret clearance|top secret|ts\/sci|clearance\s+(?:is\s+)?required|active clearance|government clearance)\b/i;

const NO_SPONSORSHIP =
  /\b(?:unable|not able|cannot|can ?not|can't|will not|won't|do(?:es)? not|don't|doesn't|are not able|is not able)\s+(?:to\s+)?(?:provide|offer|support|consider)?\s*(?:any\s+)?(?:visa|work\s+(?:visa|permit|pass)|immigration|employment\s+pass)?\s*sponsor(?:ship)?\b|\bno\s+(?:visa\s+)?sponsorship\b|\bwithout\s+(?:the\s+need\s+for\s+)?(?:any\s+)?(?:visa\s+|employer\s+|current\s+or\s+future\s+)?sponsorship\b|\bsponsorship\s+(?:is\s+)?not\s+(?:available|provided|offered)\b|\bmust\s+(?:already\s+)?(?:have|hold|possess)\s+(?:the\s+|a\s+)?(?:valid\s+)?(?:legal\s+)?(?:right|work\s+pass|work\s+permit|authori[sz]ation)\s+to\s+work\s+in\s+singapore\b|\bmust\s+(?:already\s+)?(?:have|hold)\s+(?:the\s+|a\s+)?(?:legal\s+)?right\s+to\s+work\b/i;

export function sentencesOf(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((sentence) => sentence.replace(/^[-*•\s]+/, "").replace(/\*\*/g, "").trim())
    .filter((sentence) => sentence.length > 0 && !BOILERPLATE.test(sentence));
}

function firstMatch(sentences: string[], pattern: RegExp): string | undefined {
  return sentences.find((sentence) => pattern.test(sentence));
}

function shorten(quote: string | undefined | null): string | null {
  if (!quote) return null;
  const clean = quote.replace(/\s+/g, " ").trim();
  return clean.length > 280 ? `${clean.slice(0, 277)}...` : clean;
}

function scopeFrom(text: string): RemoteScope | null {
  if (WORLDWIDE.test(text)) return "worldwide";
  const regions = regionsIn(text);
  if (regions.includes("indonesia")) return "indonesia";
  if (APAC.test(text)) return "apac";
  if (ASIA.test(text)) return "asia";
  if (regions.includes("singapore") || regions.includes("asia_other")) return "asia_other";
  if (regions.includes("other")) return "excludes_indonesia";
  return null;
}

function scopeFromCountries(countries: string[]): RemoteScope | null {
  if (countries.length === 0) return null;
  if (countries.some((country) => /^(?:worldwide|anywhere|global)$/i.test(country.trim()))) return "worldwide";
  if (countries.some((country) => country.trim().toLowerCase() === "id" || regionsIn(country).includes("indonesia"))) {
    return "indonesia";
  }
  if (countries.some((country) => APAC.test(country))) return "apac";
  if (countries.some((country) => ASIA.test(country))) return "asia";
  const regions = countries.map((country) =>
    /^[a-z]{2}$/i.test(country.trim()) ? regionOfCountryCode(country) : (regionsIn(country)[0] ?? "other"),
  );
  return regions.some((region) => region === "singapore" || region === "asia_other")
    ? "asia_other"
    : "excludes_indonesia";
}

function workplaceOf(posting: PostingForEligibility, sentences: string[]): Workplace {
  if (posting.workplace && posting.workplace !== "unknown") return posting.workplace;
  const head = `${posting.title} ${posting.location}`;
  if (REMOTE_WORD.test(head) && !HYBRID_WORD.test(head)) return "remote";
  if (HYBRID_WORD.test(head)) return "hybrid";
  if (ONSITE_WORD.test(head)) return "onsite";
  const body = sentences.join("\n");
  if (/\b(?:this|the)\s+(?:is\s+a\s+)?(?:role|position|internship|job)\s+is\s+(?:fully\s+)?remote\b|\bfully remote\b|\b100% remote\b/i.test(body)) {
    return "remote";
  }
  if (/\bhybrid\b/i.test(body)) return "hybrid";
  if (ONSITE_WORD.test(body)) return "onsite";
  return "unknown";
}

export function extractFacts(posting: PostingForEligibility): EligibilityFacts {
  const sentences = sentencesOf(posting.description);
  const workplace = workplaceOf(posting, sentences);
  const quotes: EligibilityFacts["quotes"] = {};

  const locationRegions = new Set<Region>(regionsIn(posting.location));
  for (const code of posting.countryCodes ?? []) locationRegions.add(regionOfCountryCode(code));
  if (posting.location) quotes.location = posting.location;

  let remoteScope: RemoteScope | null = null;
  let onsiteRegions: Region[] = [];

  if (workplace === "remote") {
    const restriction = firstMatch(sentences, RESTRICTION);
    const restrictionScope = restriction ? scopeFrom(restriction) : null;
    const listedScope = scopeFromCountries(posting.remoteCountries ?? []);
    const locationScope = scopeFrom(posting.location.replace(new RegExp(REMOTE_WORD, "gi"), " "));

    remoteScope = listedScope ?? locationScope;
    quotes.remote = remoteScope ? posting.location || undefined : undefined;

    if (restriction && restrictionScope) {
      const narrows = restrictionScope === "excludes_indonesia" || restrictionScope === "asia_other";
      if (!remoteScope || (narrows && remoteScope !== "indonesia")) {
        remoteScope = restrictionScope;
        quotes.remote = restriction;
      }
    }

    if (!remoteScope) {
      const worldwide = firstMatch(sentences, WORLDWIDE_SENTENCE);
      remoteScope = worldwide ? "worldwide" : "unspecified";
      quotes.remote = worldwide ?? (posting.location || firstMatch(sentences, REMOTE_WORD));
    }
  } else {
    onsiteRegions = [...locationRegions];
  }

  const citizenship = sentences.find(
    (sentence) => CITIZENSHIP.test(sentence) && !INDONESIAN_CITIZEN.test(sentence),
  );
  if (citizenship) quotes.citizenship = citizenship;

  const clearance = firstMatch(sentences, CLEARANCE);
  if (clearance) quotes.clearance = clearance;

  const sponsorship = firstMatch(sentences, NO_SPONSORSHIP);
  if (sponsorship) quotes.sponsorship = sponsorship;

  const overlap = workplace === "remote" ? overlapNote(sentences) : null;
  if (overlap) quotes.overlap = overlap.quote;

  return {
    workplace,
    onsiteRegions,
    remoteScope,
    citizenshipRequired: Boolean(citizenship),
    clearanceRequired: Boolean(clearance),
    noSponsorship: Boolean(sponsorship),
    overlap: overlap?.note ?? null,
    quotes,
  };
}

const SCOPE_REASONS: Partial<Record<RemoteScope, string>> = {
  worldwide: "Remote and open worldwide",
  apac: "Remote and open across Asia-Pacific",
  asia: "Remote and open across Asia",
  indonesia: "Remote and open to candidates in Indonesia",
};

const TEP_WEEKS = 13;

export function singaporeNote(options: DecideOptions, noSponsorship: boolean): string {
  if (options.singaporePass) {
    return noSponsorship
      ? "You confirmed a Singapore work pass on your profile, so the employer doesn't need to sponsor one."
      : "You confirmed a Singapore work pass on your profile.";
  }
  const weeks = durationInWeeks(options.duration);
  const fit =
    weeks === null
      ? "The posting doesn't state a duration, so it's unclear whether the internship fits that limit."
      : weeks <= TEP_WEEKS
        ? `The stated duration (${options.duration}) fits that limit.`
        : `The stated duration (${options.duration}) is longer than that limit, so the employer would need another pass.`;
  return [
    "Likely pass: a Training Employment Pass, applied for by the employer, valid for up to 3 months (Singapore Ministry of Manpower).",
    fit,
    "Unknown: whether they sponsor interns from overseas universities.",
  ].join(" ");
}

function decision(
  status: Eligibility,
  reason: string,
  quote: string | null | undefined,
  extra: Partial<EligibilityDecision> = {},
): EligibilityDecision {
  return {
    status,
    reason,
    quote: shorten(quote),
    workAuthorizationNote: null,
    overlapNote: null,
    ...extra,
  };
}

function placeList(regions: Region[]): string {
  return regions.map((region) => REGION_LABELS[region]).join(" and ");
}

export function decide(facts: EligibilityFacts, options: DecideOptions): EligibilityDecision {
  if (facts.citizenshipRequired) {
    return decision("excluded", "Requires a citizenship or residency you don't hold", facts.quotes.citizenship);
  }
  if (facts.clearanceRequired) {
    return decision("excluded", "Requires a security clearance", facts.quotes.clearance);
  }

  if (facts.workplace === "remote") {
    const scope = facts.remoteScope ?? "unspecified";
    const reason = SCOPE_REASONS[scope];
    if (reason) {
      return decision("eligible_remote", reason, facts.quotes.remote, { overlapNote: facts.overlap });
    }
    if (scope === "excludes_indonesia") {
      return decision("excluded", "Remote, but limited to countries that don't include Indonesia", facts.quotes.remote);
    }
    if (scope === "asia_other") {
      return decision(
        "check_manually",
        "Remote, but listed in another Asian country; it may not be open to Indonesia",
        facts.quotes.remote,
        { overlapNote: facts.overlap },
      );
    }
    return decision("check_manually", "Remote, but no country is stated", facts.quotes.remote, {
      overlapNote: facts.overlap,
    });
  }

  const where =
    facts.workplace === "hybrid" ? "Hybrid" : facts.workplace === "onsite" ? "On-site" : "Based";

  if (facts.onsiteRegions.includes("indonesia")) {
    return decision("eligible_indonesia", `${where} in Indonesia`, facts.quotes.location);
  }

  if (facts.onsiteRegions.includes("singapore")) {
    if (facts.noSponsorship && !options.singaporePass) {
      return decision(
        "excluded",
        "In Singapore, but the employer won't sponsor a work pass",
        facts.quotes.sponsorship,
      );
    }
    return decision("eligible_singapore", `${where} in Singapore`, facts.quotes.location, {
      workAuthorizationNote: singaporeNote(options, facts.noSponsorship),
    });
  }

  if (facts.onsiteRegions.length > 0) {
    return decision(
      "excluded",
      `${where} ${facts.onsiteRegions.includes("other") ? "outside Asia" : `in ${placeList(facts.onsiteRegions)}`}`,
      facts.quotes.location,
    );
  }

  return decision("check_manually", "No location is stated", facts.quotes.location ?? null);
}

export type RuleClassification = {
  facts: EligibilityFacts;
  withoutPass: EligibilityDecision;
  withPass: EligibilityDecision;
  needsModel: boolean;
};

export function classifyByRules(posting: PostingForEligibility): RuleClassification {
  const facts = extractFacts(posting);
  const duration = posting.duration ?? null;
  const withoutPass = decide(facts, { singaporePass: false, duration });
  const withPass = decide(facts, { singaporePass: true, duration });
  return { facts, withoutPass, withPass, needsModel: withoutPass.status === "check_manually" };
}

export function excludedByListing(posting: Omit<PostingForEligibility, "description">): EligibilityDecision | null {
  const result = classifyByRules({ ...posting, description: "" });
  return result.withoutPass.status === "excluded" && result.withPass.status === "excluded"
    ? result.withoutPass
    : null;
}

export function effectiveStatus(
  listing: { eligibility: Eligibility | null; eligibilityWithPass: Eligibility | null },
  options: { singaporePass: boolean; override?: Eligibility | null },
): Eligibility | null {
  if (options.override) return options.override;
  return options.singaporePass ? listing.eligibilityWithPass : listing.eligibility;
}
