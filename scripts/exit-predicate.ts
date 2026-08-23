// DEC-069 exit predicate, made mechanical (wave 37 task w37-b).
//
// This script has NO npm script per its original wave-37 note, but has
// since been wired to `npm run exit:predicate` (package.json). Invoke it
// directly:
//
//   npx tsx scripts/exit-predicate.ts --product-sha <sha>
//
// It reads docs/verification-log.md, resolves each section's ancestry
// against <sha> via `git merge-base --is-ancestor`, prints the graded
// table, and exits 1 unless all five slots read PASS and the v12 mobile
// campaign is DONE.
//
// CUSTODIAN DECOMPOSITION (contention hotspot -- 4 merge conflicts on this
// file): the DEC-069 five-slot grading machinery and the v12 campaign
// grading machinery, previously ~1500 lines inline in this one file, now
// live in scripts/exit-predicate/log-sections.ts and
// scripts/exit-predicate/campaign.ts (which itself imports the
// constant-name registries from scripts/exit-predicate/campaign-scope.ts).
// This file is now a thin orchestrator: it re-exports every public symbol
// those modules exported before the split (so every existing importer --
// tests and other scripts -- keeps working unchanged) and holds only the
// CLI entry point below. NO BEHAVIOR CHANGE: every function, regex and
// constant moved verbatim.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export * from "./exit-predicate/log-sections";
export * from "./exit-predicate/campaign-scope";
export * from "./exit-predicate/campaign";

import {
  gitAncestorResult,
  gradePredicate,
  parseLogSections,
  formatPredicateTable,
} from "./exit-predicate/log-sections";
import { buildCampaignReport, formatCampaignReport, loadCampaignFiles } from "./exit-predicate/campaign";

if (import.meta.url === `file://${process.argv[1]}`) {
  const USAGE =
    "exit-predicate: usage: npx tsx scripts/exit-predicate.ts --product-sha <sha> " +
    "[--suite-verified-sha <sha>] [--frames-verified-sha <sha>]";

  const flagIdx = process.argv.indexOf("--product-sha");
  if (flagIdx === -1 || !process.argv[flagIdx + 1]) {
    throw new Error(USAGE);
  }
  const productSha = process.argv[flagIdx + 1] as string;

  // wave-132 (task w7-e, instrument integrity repair): evidence that the
  // fast-tier suite has been run green, supplied on the command line --
  // never discovered by this process (no child_process spawn of vitest
  // lives here). Absent, campaignDone can never be true (see
  // buildCampaignReport's suiteEvidence requirement) and the summary says
  // so explicitly below.
  const suiteFlagIdx = process.argv.indexOf("--suite-verified-sha");
  let suiteVerifiedAtSha: string | null = null;
  if (suiteFlagIdx !== -1) {
    const val = process.argv[suiteFlagIdx + 1];
    if (!val) {
      throw new Error(USAGE);
    }
    suiteVerifiedAtSha = val;
  }

  // DEC-069 wave-43 amendment (task w43-e, HOLE 1): the SAME shape one tier
  // over -- evidence that `npx vitest run frame-verdicts.render
  // frame390.render` (every v12 frame-verdict render file, SLOW tier, never
  // exercised by `npm run test:fast`) has been run green, supplied on the
  // command line only. Never discovered by spawning vitest from this
  // process (wave-132 instrument-integrity repair applies to this tier too).
  const framesFlagIdx = process.argv.indexOf("--frames-verified-sha");
  let framesVerifiedAtSha: string | null = null;
  if (framesFlagIdx !== -1) {
    const val = process.argv[framesFlagIdx + 1];
    if (!val) {
      throw new Error(USAGE);
    }
    framesVerifiedAtSha = val;
  }

  const REPO_ROOT = join(import.meta.dirname, "..");
  const LOG_FILE = join(REPO_ROOT, "docs", "verification-log.md");
  const markdown = readFileSync(LOG_FILE, "utf8");
  const sections = parseLogSections(markdown);

  const ancestorCache = new Map<string, boolean>();
  function isAncestor(ancestorSha: string, descendantSha: string): boolean {
    const key = `${ancestorSha}:${descendantSha}`;
    const cached = ancestorCache.get(key);
    if (cached !== undefined) return cached;
    const result = gitAncestorResult(
      () =>
        execFileSync("git", ["merge-base", "--is-ancestor", ancestorSha, descendantSha], {
          cwd: REPO_ROOT,
          stdio: "pipe",
        }),
      ancestorSha,
      descendantSha,
    );
    ancestorCache.set(key, result);
    return result;
  }

  const rows = gradePredicate(sections, productSha, isAncestor);
  console.log(formatPredicateTable(rows));
  const allPass = rows.every((r) => r.status === "PASS");

  console.log("");
  console.log("-- v12 mobile campaign (DEC-069 wave-116, machine-derived) --");
  const campaignFiles = loadCampaignFiles(REPO_ROOT);
  const campaignReport = buildCampaignReport(campaignFiles, {
    productSha,
    suiteVerifiedAtSha,
    framesVerifiedAtSha,
    isAncestor,
  });
  console.log(formatCampaignReport(campaignReport));

  if (!allPass || !campaignReport.verdict.campaignDone) {
    if (!allPass) {
      console.error(
        `exit-predicate: not all five DEC-069 slots are PASS at product sha ${productSha}.`,
      );
    }
    if (!campaignReport.verdict.campaignDone) {
      console.error("exit-predicate: v12 mobile campaign is not yet DONE (see rows above).");
    }
    if (suiteVerifiedAtSha === null) {
      console.error(
        "exit-predicate: no --suite-verified-sha given -- the fast-tier suite has not been " +
          "verified against this tree. Run `npm run test:fast`, then re-run this script with " +
          "--suite-verified-sha <sha the suite passed at>.",
      );
    }
    if (framesVerifiedAtSha === null) {
      console.error(
        "exit-predicate: no --frames-verified-sha given -- the v12 frame-verdict render suite " +
          "has not been verified against this tree (this is a SEPARATE, slow-tier suite: " +
          "`npm run test:fast` never runs it -- see docs/mobile-campaign.md). Run " +
          "`npx vitest run frame-verdicts.render frame390.render`, then re-run this script with " +
          "--frames-verified-sha <sha the suite passed at>.",
      );
    }
    process.exit(1);
  }
}
