import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true, override: true });

const { runRefreshTick } = await import("@/lib/refresh");
const report = await runRefreshTick({ manual: process.argv.includes("--new-cycle") });

for (const source of report.sources) {
  console.log(`${source.error ? "FAIL" : "ok  "} ${source.kind}/${source.slug}: ${source.fetched} postings, ${source.relevant} internships, ${source.closed} closed${source.error ? `, ${source.error}` : ""}`);
}
console.log(
  `cycle ${report.cycleFinished ? "finished" : `running, ${report.sourcesRemaining} boards left`}; ${report.listingsUpserted} stored, ${report.closedByDeadline} closed by deadline, ${report.classified} classified, ${report.embedded} embedded${report.embeddingSkipped ? ` (${report.embeddingSkipped})` : ""}`,
);
if (report.summary) console.log("summary", JSON.stringify(report.summary));
process.exit(0);
