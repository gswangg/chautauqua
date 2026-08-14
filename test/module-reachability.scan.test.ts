// DEC-518 (Amendment, wave 32): "a cross-file manifest is DERIVED in a test,
// never hand-mirrored" applied to the SPA's own module graph -- the field
// guide's shape A SHARED COMPONENT WITH ONLY ITS OWN TEST AS CONSUMER MARKS
// THE SHAPE NOBODY BUILT (a wave built a surface, wrote its render test,
// never wired it into a page, and nothing failed).
//
// This reuses the parse-source/resolve-imports technique
// test/ssr-link-targets-scan.test.ts and test/helpers/index-mounts.ts
// already established for src/index.ts's route table, applied here to
// app/src/**'s own import graph instead of a Hono mount list. Scope is
// deliberately app/src/** ONLY (DEC-518's amendment text) -- one entry
// point (app/src/main.tsx, named by app/index.html's
// `<script type="module" src="./src/main.tsx">`, confirmed by reading
// app/vite.config.ts's root/build config), a bounded population, and the
// only place the shape has actually occurred. src/** is out of scope this
// wave.
//
// Walk: read every non-test module's source under app/src, extract every
// static `import ... from '<spec>'`, `export ... from '<spec>'` and
// `import('<spec>')` specifier, resolve relative specifiers to a file on
// disk (.ts/.tsx/.css, or /index.*), and build a directed graph. A
// `import type`/`export type` statement is NOT an edge -- it erases at
// build time and confers no real SPA-bundle reachability, so a module
// reached ONLY that way is a genuine (if legitimate) case for the ledger,
// not a bug in the walker.
//
// Any non-test module unreachable from the entry set must appear in
// ENTRY_OR_ALLOWED with a one-line reason, asserted equal in both
// directions so the ledger can't silently drift (grow stale entries or
// silently absorb a new orphan).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const APP_DIR = join(REPO_ROOT, "app");
const APP_SRC_DIR = join(APP_DIR, "src");

// ---------------------------------------------------------------------------
// Entry point(s), read from app/vite.config.ts and app/index.html -- never
// hand-guessed.
// ---------------------------------------------------------------------------

function readEntryModule(): string {
  const indexHtml = readFileSync(join(APP_DIR, "index.html"), "utf-8");
  const scriptMatch = /<script\s+type="module"\s+src="([^"]+)"/.exec(indexHtml);
  if (!scriptMatch || !scriptMatch[1]) {
    throw new Error("app/index.html has no <script type=\"module\" src=\"...\"> entry -- can't derive the SPA entry.");
  }
  // app/index.html's script src is relative to app/ (vite's `root`, per
  // app/vite.config.ts), e.g. "./src/main.tsx".
  const resolved = resolve(APP_DIR, scriptMatch[1]);
  if (!existsSync(resolved)) {
    throw new Error(`app/index.html points its entry script at ${resolved}, which doesn't exist.`);
  }
  return resolved;
}

const viteConfigSource = readFileSync(join(APP_DIR, "vite.config.ts"), "utf-8");
// Sanity check the file this test's rationale relies on hasn't changed shape
// out from under it (DEC-518's "the tree moves under you" lesson) -- fail
// loudly rather than silently trust a stale comment if `root: dirname` (i.e.
// app/index.html governs the entry) is ever removed.
if (!/root:\s*dirname/.test(viteConfigSource)) {
  throw new Error(
    "app/vite.config.ts no longer sets `root: dirname` -- this test's assumption that app/index.html names the " +
      "SPA entry needs re-deriving, not silently trusting.",
  );
}

const ENTRY_FILE = readEntryModule();

// ---------------------------------------------------------------------------
// Module discovery
// ---------------------------------------------------------------------------

function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

const ALL_MODULE_FILES = glob(APP_SRC_DIR, [".ts", ".tsx", ".css"]);
const isTestFile = (f: string) => f.endsWith(".test.ts") || f.endsWith(".test.tsx");
const NON_TEST_MODULES = ALL_MODULE_FILES.filter((f) => !isTestFile(f));

// ---------------------------------------------------------------------------
// Import-specifier extraction
// ---------------------------------------------------------------------------

/** Strips every `import type {...} from '...'`, `import type Foo from '...'`
 * and `export type {...} from '...'` statement out of the source, so the
 * generic extraction below never turns a type-only reference into a graph
 * edge (a module reached only through one of these is not really bundled in
 * -- it's a legitimate ledger case, not free reachability). */
function stripTypeOnlyImportExport(source: string): string {
  return source
    .replace(/import\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/import\s+type\s+[A-Za-z_$][\w$]*\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/export\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "");
}

const IMPORT_FROM_RE = /import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const EXPORT_FROM_RE = /export\s+[^;]*?from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

function extractSpecifiers(source: string): string[] {
  const valueOnly = stripTypeOnlyImportExport(source);
  const specs: string[] = [];
  for (const re of [IMPORT_FROM_RE, EXPORT_FROM_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(valueOnly))) {
      const spec = m[1];
      if (spec) specs.push(spec);
    }
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Relative-specifier resolution
// ---------------------------------------------------------------------------

const RESOLVE_SUFFIXES = [".ts", ".tsx", ".css"];

function resolveSpecifier(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined; // bare/external specifier -- not an app/src module
  const dir = dirname(fromFile);
  const base = resolve(dir, spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const suffix of RESOLVE_SUFFIXES) {
    if (existsSync(base + suffix)) return base + suffix;
  }
  for (const suffix of RESOLVE_SUFFIXES) {
    const indexPath = join(base, `index${suffix}`);
    if (existsSync(indexPath)) return indexPath;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Reachability walk
// ---------------------------------------------------------------------------

const ENTRY_POINTS = [ENTRY_FILE];

function walkReachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (isTestFile(file)) continue; // test files' imports don't confer reachability
    if (!existsSync(file)) continue; // e.g. a .css leaf -- no further edges
    if (file.endsWith(".css")) continue; // CSS has no JS import statements to parse
    const source = readFileSync(file, "utf-8");
    for (const spec of extractSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec);
      if (resolved) stack.push(resolved);
    }
  }
  return seen;
}

const reachable = walkReachable(ENTRY_POINTS);

// ---------------------------------------------------------------------------
// Ledger: legitimate non-test modules reachable only OUTSIDE the pure
// static-import graph above (test infra wired via vitest config's
// setupFiles, or a dev-tooling manifest consumed by a script outside
// app/src), each with a one-line reason. Never a silent catch-all --
// exact-match asserted in both directions below.
// ---------------------------------------------------------------------------

const ENTRY_OR_ALLOWED: Record<string, string> = {
  "app/src/pages/agenda/types.ts":
    "Type-only module -- every consumer (DayGrid, SessionCard, ConflictChip, phoneSlots, PhoneAgenda, " +
    "UnscheduledTray, state.ts) imports it exclusively via `import type`, which erases at build time and confers " +
    "no runtime bundle reachability.",
  "app/src/pages/comms/types.ts":
    "Type-only module -- every consumer (ComposeWizard, RecentSends, HistoryTab, PreviewPane, TemplatesTab) " +
    "imports it exclusively via `import type`.",
  "app/src/pages/overview/types.ts":
    "Type-only module -- every consumer (AgendaWorkSection, rows.ts) imports it exclusively via `import type`.",
  "app/src/pages/speakers/speakerDetail.ts":
    "Type-only module (every export is an interface or a string-literal union type) -- its one consumer, " +
    "SpeakerDetailPage.tsx, imports it exclusively via `import type`.",
  "app/src/test-setup.ts":
    "Wired as vitest.config.ts / vitest.fast.config.ts setupFiles, not imported by any app/src module -- test " +
    "harness DOM cleanup (DEC-797), not part of the SPA bundle.",
  "app/src/test-utils/mockApi.ts":
    "Shared test helper imported only by *.render.test.tsx files -- test-file imports don't confer reachability " +
    "(DEC-518), and this module exists purely to serve those tests.",
  "app/src/routeManifest.ts":
    "Consumed by scripts/render-sweep.ts (../app/src/routeManifest, DEC-144/403 render-sweep gate), which lives " +
    "outside app/src and outside this scan's entry graph -- a dev-tooling manifest, not a module the SPA bundle " +
    "itself imports.",
};

const orphans = NON_TEST_MODULES.filter((f) => !reachable.has(f)).map((f) => relative(REPO_ROOT, f));

describe("every app/src module is reachable from the SPA entry (DEC-518 amendment, wave 32)", () => {
  it("parsed at least the expected floor of modules so the walk can't have silently narrowed", () => {
    expect(NON_TEST_MODULES.length).toBeGreaterThanOrEqual(150);
    expect(reachable.size).toBeGreaterThanOrEqual(100);
  });

  it("every non-test module is either reachable from app/src/main.tsx or listed in ENTRY_OR_ALLOWED with a reason", () => {
    const unlisted = orphans.filter((f) => !(f in ENTRY_OR_ALLOWED));
    if (unlisted.length > 0) {
      throw new Error(
        `${unlisted.length} app/src module(s) are unreachable from the SPA entry and not in ENTRY_OR_ALLOWED -- ` +
          `delete them (house rule: no dead code) or wire them into the page that wanted them, or name them in ` +
          `ENTRY_OR_ALLOWED with a reason if neither is safe:\n${unlisted.join("\n")}`,
      );
    }
  });

  it("ENTRY_OR_ALLOWED contains no stale entries (a module that's actually reachable, or doesn't exist)", () => {
    const stale = Object.keys(ENTRY_OR_ALLOWED).filter((rel) => {
      const abs = join(REPO_ROOT, rel);
      return !existsSync(abs) || reachable.has(abs);
    });
    if (stale.length > 0) {
      throw new Error(
        `ENTRY_OR_ALLOWED lists ${stale.length} entr(y/ies) that are stale (now reachable, or no longer exist) -- ` +
          `remove them so the ledger stays exact:\n${stale.join("\n")}`,
      );
    }
  });

  it("ENTRY_OR_ALLOWED exactly matches the set of orphans found (no drift in either direction)", () => {
    const ledgerKeys = new Set(Object.keys(ENTRY_OR_ALLOWED));
    const orphanSet = new Set(orphans);
    const missingFromLedger = [...orphanSet].filter((f) => !ledgerKeys.has(f));
    const extraInLedger = [...ledgerKeys].filter((f) => !orphanSet.has(f));
    expect(missingFromLedger).toEqual([]);
    expect(extraInLedger).toEqual([]);
  });
});
