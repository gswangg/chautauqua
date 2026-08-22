// DEC-518 (Amendment, wave 6): "a cross-file manifest is DERIVED in a test,
// never hand-mirrored" applied to EVERY shipped module graph, not just the
// SPA's. Wave 32's version scoped itself to app/src/** with a schedule-shaped
// line ("src/** is out of scope this wave") -- exactly where a second,
// orphan copy of the docs screenshot shoot (scripts/docs-shots.mjs) hid
// until this amendment (see decisions/DEC-518.md, "wave 6" amendment). The
// scope rule now is a RULE, not a date: every shipped root with a real,
// derivable entry point is walked, so the next orphan can't hide in an
// unwalked root.
//
// Three roots, three entry derivations -- never hand-guessed:
//   1. app/src/**  -- entry is app/src/main.tsx, named by app/index.html's
//      `<script type="module" src="./src/main.tsx">` (app/vite.config.ts's
//      `root: dirname` makes index.html's script src authoritative).
//   2. src/**      -- entry is the Cloudflare Worker's module, named by
//      wrangler.jsonc's own `"main"` field.
//   3. scripts/**  -- entry SET is every script path literal that appears
//      in package.json's own `"scripts"` values (including the wrapped
//      command's own path when a script is piped through
//      `sh scripts/with-test-lock.sh <cmd> <path>`) -- one entry per line
//      that actually gets run, never a hand-picked subset.
//
// All three roots are walked as ONE graph: scripts/*.ts freely imports
// from ../src/** and ../app/src/** (seed.ts, perf-seed.ts, perf-smoke.ts,
// seed-r2.ts, stress-bars.ts, render-sweep.ts, docs-shots.ts all do), so a
// single shared resolver/walker is correct where three independent ones
// would double-count or miss a cross-root edge.
//
// A `scripts/**` module invoked by a COMPUTED runtime path (e.g.
// scripts/walkthrough.ts's `spawnSync("npx", ["tsx",
// scripts/walkthrough/${area}.ts, ...])` over WALKTHROUGH_AREAS) is real,
// intentional, operator-facing reachability -- but it is not a static
// import edge, so those modules are legitimate ENTRY_OR_ALLOWED ledger
// members, not bugs.
//
// Walk: read every non-test module's source, extract every static
// `import ... from '<spec>'`, `export ... from '<spec>'` and
// `import('<spec>')` specifier, resolve relative specifiers to a file on
// disk (.ts/.tsx/.css/.mjs/.js, or /index.*), and build a directed graph.
// An `import type`/`export type` statement is NOT an edge -- it erases at
// build time and confers no real bundle/runtime reachability, so a module
// reached ONLY that way is a genuine (if legitimate) ledger case, not a
// bug in the walker.
//
// Any non-test module unreachable from the entry set must appear in
// ENTRY_OR_ALLOWED with a rule-shaped, one-line reason -- what the file IS
// and why it legitimately has no importer, never a wave/branch/schedule --
// asserted equal in both directions so the ledger can't silently drift
// (grow stale entries or silently absorb a new orphan).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const APP_DIR = join(REPO_ROOT, "app");
const APP_SRC_DIR = join(APP_DIR, "src");
const SRC_DIR = join(REPO_ROOT, "src");
const SCRIPTS_DIR = join(REPO_ROOT, "scripts");

// ---------------------------------------------------------------------------
// Entry point(s) -- each derived from the file that actually governs it,
// never hand-guessed.
// ---------------------------------------------------------------------------

function readAppEntryModule(): string {
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

function readWorkerEntryModule(): string {
  const wranglerSource = readFileSync(join(REPO_ROOT, "wrangler.jsonc"), "utf-8");
  const mainMatch = /"main"\s*:\s*"([^"]+)"/.exec(wranglerSource);
  if (!mainMatch || !mainMatch[1]) {
    throw new Error("wrangler.jsonc has no \"main\" field -- can't derive the Worker entry.");
  }
  const resolved = resolve(REPO_ROOT, mainMatch[1]);
  if (!existsSync(resolved)) {
    throw new Error(`wrangler.jsonc's "main" points at ${resolved}, which doesn't exist.`);
  }
  return resolved;
}

/**
 * Every scripts/**-relative path literal that appears anywhere in
 * package.json's own `"scripts"` values -- this is what actually gets run
 * (`npm run <name>`), including the wrapped command's own path when a
 * script is piped through `sh scripts/with-test-lock.sh <cmd> <path>`
 * (e.g. `"shots:docs": "sh scripts/with-test-lock.sh tsx
 * scripts/docs-shots.ts"` yields scripts/docs-shots.ts, the thing that
 * actually runs, not just the lock wrapper).
 */
function readScriptEntryModules(): string[] {
  const pkgSource = readFileSync(join(REPO_ROOT, "package.json"), "utf-8");
  const pkg = JSON.parse(pkgSource) as { scripts?: Record<string, string> };
  if (!pkg.scripts) {
    throw new Error("package.json has no \"scripts\" block -- can't derive scripts/** entries.");
  }
  const combined = Object.values(pkg.scripts).join(" ");
  const pathRe = /scripts\/[\w-]+(?:\/[\w-]+)*\.(?:ts|tsx|mjs|js)/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(combined))) {
    found.add(m[0]);
  }
  if (found.size === 0) {
    throw new Error("No scripts/**.ts path literals found in package.json's scripts block -- derivation is broken.");
  }
  return [...found].map((rel) => {
    const abs = resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) {
      throw new Error(`package.json's scripts block names ${rel}, which doesn't exist at ${abs}.`);
    }
    return abs;
  });
}

const ENTRY_POINTS = [readAppEntryModule(), readWorkerEntryModule(), ...readScriptEntryModules()];

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

const ALL_MODULE_FILES = [
  ...glob(APP_SRC_DIR, [".ts", ".tsx", ".css"]),
  ...glob(SRC_DIR, [".ts", ".tsx"]),
  ...glob(SCRIPTS_DIR, [".ts", ".tsx", ".mjs", ".js"]),
];
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

/** A CSS `@import './x.css'` (bare or `url(...)`-wrapped) is a REAL bundle
 * edge: Vite inlines it at build time, so a submodule stylesheet attached
 * that way is genuinely shipped, not an orphan. The walker used to skip
 * `.css` files outright ("CSS has no JS import statements to parse"), which
 * was true only while no stylesheet imported another; the first CSS->CSS
 * edge in the tree (contacts.css -> contacts-modals.css, the contention
 * custodian's Modals submodule split) made that blind spot report a shipped
 * file as unreachable. Comments are stripped first so a decision note
 * quoting an `@import` line is never mistaken for a real edge. */
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;

function extractCssImportSpecifiers(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const specs: string[] = [];
  CSS_IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CSS_IMPORT_RE.exec(withoutComments))) {
    const spec = m[1];
    if (spec) specs.push(spec);
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Relative-specifier resolution
// ---------------------------------------------------------------------------

const RESOLVE_SUFFIXES = [".ts", ".tsx", ".css", ".mjs", ".js"];

function resolveSpecifier(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined; // bare/external specifier -- not a repo module
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

function walkReachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (isTestFile(file)) continue; // test files' imports don't confer reachability
    if (!existsSync(file)) continue; // e.g. an asset leaf -- no further edges
    const source = readFileSync(file, "utf-8");
    const specs = file.endsWith(".css") ? extractCssImportSpecifiers(source) : extractSpecifiers(source);
    for (const spec of specs) {
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
// setupFiles, a module reached only via `import type`, or a scripts/**
// module invoked by a runtime-computed path rather than a static import),
// each with a rule-shaped one-line reason. Never a silent catch-all --
// exact-match asserted in both directions below.
// ---------------------------------------------------------------------------

const ENTRY_OR_ALLOWED: Record<string, string> = {
  "app/src/negative-margin-adjacency-ceiling.ts":
    "Ratchet-constant module for a brand-new instrument (DEC-919 wave-152 amendment, task w8-eg) -- its only " +
    "importer is app/src/negative-margin-adjacency.scan.test.ts, and test-file imports don't confer " +
    "reachability (DEC-518). Isolated so every re-measure of the ratchet touches only this constant and its " +
    "history comment (mirrors app/src/phone-overflow-scan/starved-track-ceiling.ts's precedent).",
  "app/src/phone-overflow-scan/budget.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Derives the phone content budget; it is scan vocabulary, never SPA bundle code.",
  "app/src/phone-overflow-scan/cascade.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Resolves which CSS rule wins at phone width; it is scan vocabulary, never SPA bundle code.",
  "app/src/phone-overflow-scan/checks.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Holds the per-rule overflow predicates; it is scan vocabulary, never SPA bundle code.",
  "app/src/phone-overflow-scan/cross-bundle.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Resolves cross-bundle receipt citations; it is scan vocabulary, never SPA bundle code.",
  "app/src/phone-overflow-scan/population.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Enumerates the scanned CSS population; it is scan vocabulary, never SPA bundle code.",
  "app/src/phone-overflow-scan/rules.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Extracts CSS rules and media spans; it is scan vocabulary, never SPA bundle code.",
  "app/src/phone-overflow-scan/starved-track-ceiling.ts":
    "Scan-mechanics module for a custodian-split scan suite -- its only importer is " +
    "app/src/phone-horizontal-overflow.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518). Carries STARVED_FLEX_TRACK_CEILING alone because scripts/exit-predicate.ts requires " +
    "exactly one tracked declaration of `export const STARVED_FLEX_TRACK_CEILING = <int>;` in the " +
    "whole tree, and isolating it (away from ./checks.ts) keeps every re-seed of the ratchet to a " +
    "single-file diff, not a diff against the population/check machinery; it is scan vocabulary, " +
    "never SPA bundle code.",
  "app/src/pages/agenda/types.ts":
    "Type-only module -- every consumer (DayGrid, SessionCard, ConflictChip, phoneSlots, PhoneAgenda, " +
    "UnscheduledTray, state.ts) imports it exclusively via `import type`, which erases at build time and confers " +
    "no runtime bundle reachability.",
  "app/src/pages/comms/types.ts":
    "Type-only module -- every consumer (ComposeWizard, RecentSends, HistoryTab, PreviewPane, TemplatesTab) " +
    "imports it exclusively via `import type`.",
  "app/src/pages/overview/types.ts":
    "Type-only module -- every consumer (AgendaWorkSection, rows.ts) imports it exclusively via `import type`.",
  "app/src/pages/settings/TracksRoomsPanel.render-helpers.ts":
    "Test-only fixture module for a custodian-split render suite -- five sibling suites " +
    "(TracksRoomsPanel.render.test.tsx, -errors.render.test.tsx, -remove.render.test.tsx, " +
    "-edit-save.render.test.tsx, -css.test.ts) import it, but it carries a plain `.ts` extension " +
    "precisely so vitest's include globs never collect it as a suite of its own, which is why the " +
    "reachability walk -- which excludes test files as entry points -- cannot see its importers.",
  "app/src/pages/speakers/speakerDetail.ts":
    "Type-only module (every export is an interface or a string-literal union type) -- its one consumer, " +
    "SpeakerDetailPage.tsx, imports it exclusively via `import type`.",
  "src/server/repo/agenda/types.ts":
    "Type-only module -- every consumer (rows.ts, labels.ts, payload.ts, auto-schedule.ts, index.ts) imports it " +
    "exclusively via `import type` / `export type ... from`, which erases at build time and confers no runtime " +
    "reachability.",
  "app/src/test-setup.ts":
    "Wired as vitest.config.ts / vitest.fast.config.ts setupFiles, not imported by any app/src module -- test " +
    "harness DOM cleanup (DEC-797), not part of the SPA bundle.",
  "app/src/test-utils/mockApi.ts":
    "Shared test helper imported only by *.render.test.tsx files -- test-file imports don't confer reachability " +
    "(DEC-518), and this module exists purely to serve those tests.",
  "app/src/test-utils/phoneBlock.ts":
    "Shared phone-block CSS scanning vocabulary (comment-stripping, brace-depth block extraction, rule lookup) " +
    "imported only by *.render.test.tsx CSS pins -- test-file imports don't confer reachability (DEC-518), " +
    "same shape as mockApi.ts above (field guide DEC-613).",
  "app/src/pages/settings/PeopleRolesPanel.test-helpers.tsx":
    "Shared fixtures (SELF/OTHER, mockPeople, renderPanel, the console.error guard) imported only by the five " +
    "PeopleRolesPanel.*.render.test.tsx spec files -- test-file imports don't confer reachability (DEC-518). " +
    "Split out of a single 855-line PeopleRolesPanel.render.test.tsx (custodian decomposition, wave v12m-w12), " +
    "so it is test-only code, never SPA bundle code; same shape as mockApi.ts above.",
  "app/src/phone-tap-target-scan/core.ts":
    "Scanning primitives (CSS/TSX file population, declared-height parsing, flex-centre and exemption-comment " +
    "readers) imported only by app/src/phone-tap-target.scan.test.ts and its wave-v12m-w12 siblings " +
    "(phone-tap-target-anchor-floor.scan.test.ts, phone-tap-target-ssr.scan.test.ts) -- test-file imports don't " +
    "confer reachability (DEC-518). Split out of that suite in wave v12m-w8 (custodian decomposition of an " +
    "882-line merge-conflict hotspot), so it is the scan's own code, never SPA bundle code; same shape as mockApi.ts.",
  "app/src/phone-tap-target-scan/anchor-floor.ts":
    "Row-action-anchor half of the same wave-v12m-w8 decomposition -- imported only by " +
    "app/src/phone-tap-target-anchor-floor.scan.test.ts (wave v12m-w12 split), and test-file imports don't " +
    "confer reachability (DEC-518).",
  "app/src/phone-tap-target-scan/ssr.ts":
    "SSR-route (public/portal/docs/auth) half of the same wave-v12m-w8 decomposition -- imported only by " +
    "app/src/phone-tap-target-ssr.scan.test.ts (wave v12m-w12 split), and test-file imports don't confer " +
    "reachability (DEC-518).",
  "app/src/phone-tap-target-scan/ceilings.ts":
    "Ratchet ceiling constants (with their full amendment-history comments) for the phone tap-target floor " +
    "scans, extracted in wave v12m-w12 so lanes lowering different ceilings stop colliding on the same lines " +
    "-- imported only by phone-tap-target.scan.test.ts and its two siblings, and test-file imports don't " +
    "confer reachability (DEC-518).",
  "app/src/phone-tap-target-scan/spa-classless.ts":
    "SPA classless-control population (wave v12m-w10, task w10-na, DEC-180 wave-154 amendment) -- imported " +
    "only by app/src/phone-tap-target-spa-classless-control.scan.test.ts, and test-file imports don't confer " +
    "reachability (DEC-518); it is the scan's own code, never SPA bundle code, same shape as its core.ts / " +
    "anchor-floor.ts / ssr.ts / undeclared.ts siblings above.",
  "app/src/phone-tap-target-scan/undeclared.ts":
    "Undeclared-height half of the same phone-tap-target scan decomposition (DEC-367 PREDICATE REPAIR: a " +
    "control that declares NO height at all took the base scan's same `continue` as one already at 44px) -- " +
    "imported only by app/src/phone-tap-target-undeclared.scan.test.ts, and test-file imports don't confer " +
    "reachability (DEC-518); it is the scan's own code, never SPA bundle code, same shape as its core.ts / " +
    "anchor-floor.ts / ssr.ts siblings above.",
  "app/src/phone-tap-target-scan/width-ceiling.ts":
    "Isolated ratchet-constant holder (DEC-808 wave-26, task w26-j) for `WIDTH_FLOOR_OFFENDERS_CEILING`, split " +
    "into its own file so a lane re-measuring the width-half floor never collides with ./width-floor.ts's " +
    "population/predicate machinery -- imported only by app/src/phone-tap-target-width-floor.scan.test.ts, and " +
    "test-file imports don't confer reachability (DEC-518); same shape as its ceilings.ts sibling above.",
  "app/src/phone-tap-target-scan/width-floor.ts":
    "Width-half tap-floor lens (DEC-393/DEC-808 wave-26, task w26-j) grading the hit-box WIDTH clause the " +
    "existing height-only floor scans never covered -- imported only by " +
    "app/src/phone-tap-target-width-floor.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518); it is the scan's own code, never SPA bundle code, same shape as its core.ts / anchor-floor.ts " +
    "/ ssr.ts / undeclared.ts siblings above.",
  "src/routes/docs-content/technical-names.ts":
    "ASD-STE100 rule-1.5/1.6 technical-name declaration for the docs articles -- consumed only by " +
    "test/docs-ste.scan.test.ts (the docs dictionary scan), and test-file imports don't confer reachability " +
    "(DEC-518); it exists purely to serve that scan, same shape as mockApi.ts above.",
  "scripts/walkthrough/producer.ts":
    "Spawned by scripts/walkthrough.ts via `spawnSync(\"npx\", [\"tsx\", modulePath(area), ...])` over " +
    "WALKTHROUGH_AREAS (scripts/walkthrough-lib.ts) -- a runtime-computed child-process path, never a static " +
    "import, so it correctly falls outside the static reachability graph while still being real, invoked code.",
  "scripts/walkthrough/review.ts":
    "Spawned by scripts/walkthrough.ts via a runtime-computed `scripts/walkthrough/${area}.ts` path over " +
    "WALKTHROUGH_AREAS -- same shape as producer.ts, never a static import.",
  "scripts/walkthrough/speaker.ts":
    "Spawned by scripts/walkthrough.ts via a runtime-computed `scripts/walkthrough/${area}.ts` path over " +
    "WALKTHROUGH_AREAS -- same shape as producer.ts, never a static import.",
  "scripts/walkthrough/public.ts":
    "Spawned by scripts/walkthrough.ts via a runtime-computed `scripts/walkthrough/${area}.ts` path over " +
    "WALKTHROUGH_AREAS -- same shape as producer.ts, never a static import.",
  "scripts/walkthrough/data.ts":
    "Spawned by scripts/walkthrough.ts via a runtime-computed `scripts/walkthrough/${area}.ts` path over " +
    "WALKTHROUGH_AREAS -- same shape as producer.ts, never a static import.",
  "scripts/walkthrough/scale.ts":
    "Spawned by scripts/walkthrough.ts via a runtime-computed `scripts/walkthrough/${area}.ts` path over " +
    "WALKTHROUGH_AREAS -- same shape as producer.ts, never a static import (scripts/walkthrough/stress.ts is a " +
    "sibling module but is instead a direct package.json entry, `gate:scale`, so it needs no ledger entry).",
  "app/src/comment-blind-css-assertion-scan/ceiling.ts":
    "Ratchet ceiling constant module (DEC-374 amendment, wave v12m-w8 task w8-ef) -- its only importer is " +
    "test/comment-blind-css-assertion.scan.test.ts, and test-file imports don't confer reachability (DEC-518). " +
    "Same shape as starved-track-ceiling.ts above: isolated into its own file so a worker re-measuring the " +
    "ratchet touches only this constant, never the scan's detection machinery.",
  "app/src/comment-blind-css-assertion-scan/local-stripper-ceiling.ts":
    "Ratchet ceiling constant module (DEC-374/DEC-613, wave v12m-w8 task w8-ef) for the same scan's second " +
    "offender class -- its only importer is test/comment-blind-css-assertion.scan.test.ts, and test-file " +
    "imports don't confer reachability (DEC-518). Same shape as its ceiling.ts sibling above.",
  "app/src/phone-tap-target-scan/width-ceiling.ts":
    "Ratchet constant/predicate module for the width half of the 44px floor (DEC-393/DEC-808) -- isolated " +
    "into its own file so scripts/exit-predicate.ts finds exactly one tracked declaration of `export const " +
    "WIDTH_FLOOR_OFFENDERS_CEILING = <int>;` and every re-measure of the ratchet touches only this constant " +
    "and its history comment, never the population/predicate machinery in ./width-floor.ts (same shape as " +
    "starved-track-ceiling.ts above). Its sole importer is " +
    "app/src/phone-tap-target-width-floor.scan.test.ts, and test-file imports don't confer reachability " +
    "(DEC-518).",
  "app/src/phone-tap-target-scan/width-floor.ts":
    "Population/predicate module for the width half of the 44px floor (DEC-393/DEC-808) -- grades every " +
    "glyph-only/empty-with-aria-label control against a declared >=44px min-width/width effective at 390, " +
    "kept out of width-ceiling.ts so re-measuring the ratchet constant never touches this detection " +
    "machinery. Its sole importer is app/src/phone-tap-target-width-floor.scan.test.ts, and test-file " +
    "imports don't confer reachability (DEC-518).",
};

const orphans = NON_TEST_MODULES.filter((f) => !reachable.has(f)).map((f) => relative(REPO_ROOT, f));

describe("every app/src, src and scripts module is reachable from a real entry point (DEC-518 amendment, wave 6)", () => {
  it("parsed at least the expected floor of modules so the walk can't have silently narrowed", () => {
    expect(NON_TEST_MODULES.length).toBeGreaterThanOrEqual(500);
    expect(reachable.size).toBeGreaterThanOrEqual(400);
  });

  it("every non-test module is either reachable from an entry point or listed in ENTRY_OR_ALLOWED with a reason", () => {
    const unlisted = orphans.filter((f) => !(f in ENTRY_OR_ALLOWED));
    if (unlisted.length > 0) {
      throw new Error(
        `${unlisted.length} module(s) are unreachable from any entry point and not in ENTRY_OR_ALLOWED -- ` +
          `delete them (house rule: no dead code) or wire them into whatever wanted them, or name them in ` +
          `ENTRY_OR_ALLOWED with a rule-shaped reason if neither is safe:\n${unlisted.join("\n")}`,
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
