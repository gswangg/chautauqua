// Repo file index, for resolving a citation's path and checking which
// top-level directory it lives under.
//
// Extracted from test/citation-form-drift.scan.test.ts (contention-hotspot
// decomposition, custodian task custodian-test_citation_form_drift_scan_test_ts):
// pure extraction, no behavior change. Same resolution contract as
// test/decision-doc-citation.scan.test.ts's resolvePath: a slash-bearing
// path is repo-relative as written; a bare basename resolves uniquely
// against every file in the tree or is dropped (ambiguous/missing
// citations are not this scan's job -- that is DIRECTION 1 resolution in
// test/decision-doc-citation.scan.test.ts; a citation that cannot be
// resolved at all cannot be classified as "resolves under" any directory,
// so it is simply not counted here).
import { readdirSync } from "node:fs";
import { join } from "node:path";

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".wrangler"]);

export function enumerateAllRepoFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        out.push(join(dir, entry.name));
      }
    }
  }
  walk(root);
  return out;
}

export interface RepoIndex {
  resolvePath(rawPath: string): string | null;
}

/** Builds a repo-relative file index rooted at `root` and returns a
 * resolvePath function closed over it. Mirrors
 * test/decision-doc-citation.scan.test.ts's resolvePath exactly. */
export function buildRepoIndex(root: string): RepoIndex {
  const allRepoFiles = enumerateAllRepoFiles(root);
  const allRelFiles = new Set(allRepoFiles.map((abs) => abs.slice(root.length + 1)));

  const basenameMap = new Map<string, string[]>();
  for (const abs of allRepoFiles) {
    const base = abs.slice(abs.lastIndexOf("/") + 1);
    const rel = abs.slice(root.length + 1);
    const list = basenameMap.get(base);
    if (list) list.push(rel);
    else basenameMap.set(base, [rel]);
  }

  return {
    resolvePath(rawPath: string): string | null {
      if (rawPath.includes("/")) {
        return allRelFiles.has(rawPath) ? rawPath : null;
      }
      const matches = basenameMap.get(rawPath) ?? [];
      return matches.length === 1 ? matches[0]! : null;
    },
  };
}

export const IN_SCOPE_DIR_PREFIXES = ["app/src/", "src/", "test/", "scripts/", "migrations/"];

export function resolvesUnderScope(relPath: string): boolean {
  return IN_SCOPE_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}
