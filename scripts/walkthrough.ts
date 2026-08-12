// J1->J12 walkthrough orchestrator (DEC-062): a thin sequential runner over
// the five DEC-060 modules in scripts/walkthrough/{producer,review,speaker,
// public,data}.ts. Parses --url (default http://localhost:8787), asserts
// every module file exists on disk, then spawns each in the fixed order
// producer -> review -> speaker -> public -> data via
// `npx tsx scripts/walkthrough/<area>.ts --url <url>` with stdio inherited
// so each module's own console output streams through live.
//
// Scripts/ tooling (not src/ pure-core, DEC-002), so node: imports are
// fine here. Pure helpers (module order, arg construction, message
// formatting) live in scripts/walkthrough-lib.ts for unit testing without
// node: imports; see test/walkthrough-lib.test.ts.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WALKTHROUGH_AREAS,
  buildSpawnArgs,
  formatAreaPass,
  formatFailureMessage,
  formatMissingModulesMessage,
  formatSummaryTable,
  modulePath,
  parseUrlArg,
  type WalkthroughAreaResult,
} from "./walkthrough-lib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

function main(): void {
  const url = parseUrlArg(process.argv.slice(2), "http://localhost:8787");

  const missing = WALKTHROUGH_AREAS.map((area) => modulePath(area)).filter(
    (rel) => !existsSync(join(REPO_ROOT, rel)),
  );
  if (missing.length > 0) {
    console.error(formatMissingModulesMessage(missing));
    process.exitCode = 1;
    return;
  }

  console.log(`Running J1->J12 walkthrough against ${url}`);
  console.log(`Order: ${WALKTHROUGH_AREAS.join(" -> ")}`);
  console.log("");

  const results: WalkthroughAreaResult[] = [];

  for (const area of WALKTHROUGH_AREAS) {
    console.log(`--- ${area} ---`);
    const args = buildSpawnArgs(area, url);
    const result = spawnSync("npx", args, {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    if (result.error) {
      console.error(formatFailureMessage(area));
      console.error(result.error.message);
      results.push({ area, status: "FAIL" });
      continue;
    }
    if (result.status !== 0) {
      console.error(formatFailureMessage(area));
      results.push({ area, status: "FAIL" });
      continue;
    }
    console.log(formatAreaPass(area));
    console.log("");
    results.push({ area, status: "PASS" });
  }

  console.log("Summary:");
  console.log(formatSummaryTable(results));
  console.log("");

  const anyFailed = results.some((r) => r.status === "FAIL");
  if (anyFailed) {
    process.exitCode = 1;
    console.log("walkthrough FAILED");
  } else {
    console.log("walkthrough OK");
  }
}

main();
