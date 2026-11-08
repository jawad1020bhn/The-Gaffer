#!/usr/bin/env node
/** Read-only source coverage audit. Loader validity is a separate check: validate.mjs / ofm-cli. */
import process from "node:process";
import { pathToFileURL } from "node:url";
import { auditQuality } from "./lib/quality.mjs";
import { readPackageDocuments } from "./validate.mjs";

function printReport(report) {
  console.log(
    `Source quality: ${report.counts.clubs} clubs, ${report.counts.players} players, ${report.counts.competitions} competitions`,
  );
  console.log("Coverage is not loader validity. Missing data is not filled or rewritten.");
  for (const [field, metric] of Object.entries(report.coverage)) {
    const percent =
      metric.total === 0 ? "n/a" : `${((metric.present / metric.total) * 100).toFixed(1)}%`;
    console.log(
      `  ${field}: ${metric.present}/${metric.total} (${percent}); ${metric.missing} missing/unusable`,
    );
  }
  const stale = report.contractsBeforeBaseYear;
  console.log(
    stale === null
      ? "  contracts before base year: not checked (no usable baseYear)"
      : `  contracts before ${report.contractCutoff}: ${stale.length} (source dates preserved)`,
  );
  console.log(
    `  clubs without explicit competition: ${report.clubsWithoutExplicitCompetition.length}`,
  );
  if (!report.competitionCoverageComplete)
    console.log(
      "  Selector fields are unresolved; these clubs may still participate at world build.",
    );
  for (const club of report.clubsWithoutExplicitCompetition) {
    console.log(`    ${club.id} — ${club.name} (${club.country ?? "unknown country"})`);
  }
  console.log(`  dangling participant references: ${report.danglingParticipants.length}`);
  console.log(`  placeholder club names requiring review: ${report.placeholderClubs.length}`);
  for (const club of report.placeholderClubs) console.log(`    ${club.id} — ${club.name}`);
  console.log(`  authored staff records: ${report.counts.staff} (not a count of generated staff)`);
  console.log(
    `  national tournaments: ${report.counts.nationalTournaments} (not a count of national teams)`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith("--"));
  if (
    !target ||
    args.some((arg) => arg.startsWith("--") && arg !== "--json") ||
    args.filter((arg) => !arg.startsWith("--")).length !== 1
  ) {
    console.error(
      "usage: node tools/eafc-import/audit.mjs <package directory | .ofm archive> [--json]",
    );
    process.exitCode = 2;
    return;
  }
  const { documents } = await readPackageDocuments(target);
  const report = auditQuality(documents);
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(`audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
