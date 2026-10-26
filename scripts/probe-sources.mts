import { adapterFor, type SourceRef } from "@/lib/sources";
import { isSoftwareInternship } from "@/lib/roles";
import { classifyByRules, excludedByListing } from "@/lib/eligibility";
import { postingHints } from "@/lib/posting-hints";

const sources: SourceRef[] = [
  { kind: "ashby", slug: "airwallex", label: "Airwallex" },
  { kind: "ashby", slug: "openai", label: "OpenAI" },
  { kind: "ashby", slug: "snowflake", label: "Snowflake" },
  { kind: "lever", slug: "ninjavan", label: "Ninja Van" },
  { kind: "lever", slug: "nium", label: "Nium" },
  { kind: "lever", slug: "binance", label: "Binance" },
  { kind: "greenhouse", slug: "okta", label: "Okta" },
  { kind: "greenhouse", slug: "twilio", label: "Twilio" },
  { kind: "greenhouse", slug: "xendit", label: "Xendit" },
  { kind: "smartrecruiters", slug: "grab", label: "Grab" },
  { kind: "workable", slug: "mercari", label: "Mercari" },
  { kind: "catapa", slug: "gdplabs", label: "GDP Labs" },
  { kind: "themuse", slug: "Software Engineering", label: "The Muse" },
  { kind: "himalayas", slug: "Indonesia", label: "Himalayas" },
  { kind: "ycombinator", slug: "internships", label: "YC" },
  { kind: "linkedin", slug: "Indonesia", label: "LinkedIn" },
  { kind: "linkedin", slug: "Singapore", label: "LinkedIn" },
];

const only = process.argv[2];

for (const source of sources.filter((s) => !only || s.kind === only || s.slug === only)) {
  const adapter = adapterFor(source.kind);
  const started = Date.now();
  try {
    const all = await adapter.list(source);
    const relevant = all.filter(isSoftwareInternship);
    const counts: Record<string, number> = {};
    const rows: string[] = [];
    for (let item of relevant.slice(0, 40)) {
      const pre = excludedByListing(item);
      if (!pre && adapter.hydrate && item.needsHydration) {
        try {
          item = await adapter.hydrate(source, item);
        } catch (error) {
          rows.push(`   hydration failed   ${item.title.slice(0, 60).padEnd(60)} | ${(error as Error).message}`);
          continue;
        }
      }
      const hints = postingHints(item);
      const result = pre ? { withoutPass: pre } : classifyByRules({ ...item, duration: hints.duration });
      const status = result.withoutPass.status;
      counts[status] = (counts[status] ?? 0) + 1;
      rows.push(
        `   ${status.padEnd(18)} ${item.title.slice(0, 60).padEnd(60)} | ${item.location.slice(0, 40).padEnd(40)} | ${result.withoutPass.reason}${hints.season ? ` | ${hints.season}` : ""}${hints.duration ? ` | ${hints.duration}` : ""}${hints.deadline ? ` | due ${hints.deadline.toISOString().slice(0, 10)}` : ""}`,
      );
    }
    console.log(`${source.kind}/${source.slug}: ${all.length} postings, ${relevant.length} software internships, ${Date.now() - started}ms`, counts);
    for (const row of rows.slice(0, 12)) console.log(row);
  } catch (error) {
    console.log(`${source.kind}/${source.slug}: ERROR ${(error as Error).message}`);
  }
}
