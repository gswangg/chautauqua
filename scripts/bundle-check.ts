// DEC-058: enforce SPEC §7 front-end perf budgets.
//
// Globs public/admin/assets/ for the entry chunk (index-*.js) and entry
// stylesheet (index-*.css) emitted by `vite build`. Exactly one of each
// must exist. Gzips every chunk in the directory, prints a size table, and
// fails loudly (exit 1) if the entry JS + entry CSS combined gzip size
// exceeds the budget.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// dist dir directly are fine here — same convention as scripts/perf-smoke.ts.
// The pure size-check logic lives in scripts/bundle-check-lib.ts (no node:
// imports) so it's directly unit-testable; see test/bundle-check.test.ts.

import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { BUDGET_BYTES, type ChunkSize, checkEntryBudget, findUniqueMatch, formatBytes } from "./bundle-check-lib";

function main(): void {
  const assetsDir = join(process.cwd(), "public", "admin", "assets");
  const files = readdirSync(assetsDir).filter((f) => statSync(join(assetsDir, f)).isFile());

  const entryJsName = findUniqueMatch(files, /^index-.*\.js$/, "JS");
  const entryCssName = findUniqueMatch(files, /^index-.*\.css$/, "CSS");

  const rawSizes = new Map<string, number>();
  const chunks: ChunkSize[] = files.map((name) => {
    const raw = readFileSync(join(assetsDir, name));
    rawSizes.set(name, raw.length);
    const gzip = gzipSync(raw);
    return { name, gzipBytes: gzip.length };
  });

  console.log("Bundle chunk sizes (public/admin/assets):");
  console.log("");
  const rows = chunks
    .slice()
    .sort((a, b) => b.gzipBytes - a.gzipBytes)
    .map((c) => ({
      name: c.name,
      raw: formatBytes(rawSizes.get(c.name) ?? 0),
      gzip: formatBytes(c.gzipBytes),
    }));
  const nameWidth = Math.max(...rows.map((r) => r.name.length), "file".length);
  console.log(`${"file".padEnd(nameWidth)}  raw          gzip`);
  for (const r of rows) {
    console.log(`${r.name.padEnd(nameWidth)}  ${r.raw.padEnd(11)}  ${r.gzip}`);
  }
  console.log("");

  const result = checkEntryBudget(chunks, entryJsName, entryCssName);
  console.log(
    `Entry bundle: ${entryJsName} + ${entryCssName} = ${formatBytes(result.totalBytes)} gzip ` +
      `(budget ${formatBytes(BUDGET_BYTES)})`,
  );
  console.log("bundle:check PASSED");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
