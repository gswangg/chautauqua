// DEC-518 (wave-41 amendment, task w41-d): the sibling scan
// (spa-count-source-ledger.scan.test.ts) owns apiList<T> callers only --
// apiList<T> always targets a ListEnvelope<T> (see app/src/lib/api.ts), so
// its population is exactly the SPA's apiList call sites. But a count lie
// told through apiGet is invisible to that scan: FilesLibrary.tsx calls
// apiGet<EventFilesEnvelope>('/events/:id/files?...') against a
// page/perPage route (src/routes/files.ts) with a true total, and the old
// ledger's own prose falsely claimed MergePage.tsx was "the one place this
// codebase calls apiGet against a paginated list route" -- a decision with
// no code behind it once a second such caller existed.
//
// This file owns that family instead: every non-test module under
// app/src/** that calls apiGet with a URL literal shaped like a route this
// codebase registers whose own handler returns an object literal carrying
// both `items` and `total` as TOP-LEVEL keys (a paginated list envelope,
// per DEC-518's "population re-derived from source at test time" rule --
// never hand-listed on either side).
//
// VERDICT KEY -- identical vocabulary to the sibling scan:
//   'envelope'    -- every whole-set count this module renders reads
//                    res.total/res.count off the apiGet response. The cited
//                    file must contain a literal `.total`/`.count` token.
//   'page-scoped' -- the rendered number is deliberately about the visible
//                    rows only, and the source SAYS SO in a comment
//                    (checked: the cited snippet literally appears).
//   'unpaged'     -- no whole-set count is ever rendered from this apiGet
//                    call at all (only `.items` is read, e.g. a
//                    first-match lookup or a bounded per-parent list with
//                    no further-paging UI) -- the caller isn't making a
//                    count claim to be right or wrong about.
//
// This task's own scan found no live defect: all four population members
// below either render no count from the apiGet call at all, or read the
// count off `.total`/`.count` as required.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTES_DIR = join(ROOT, "src", "routes");
const APP_SRC_DIR = join(ROOT, "app", "src");

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

function relPath(absPath: string): string {
  return relative(ROOT, absPath).split("\\").join("/");
}

// ---------------------------------------------------------------------------
// A tiny string/template/comment-aware scanner. Needed because a naive
// brace counter miscounts `{`/`}` that appear inside string/template
// literals or comments, and because distinguishing a route's TOP-LEVEL
// `c.json({ items, total, ... })` from a nested `{ activity: { items,
// total } }` (see src/routes/api/pipeline.ts's GET /pipeline/:id, which is
// NOT a paginated-envelope route at its own top level) requires knowing
// object-literal nesting depth, not just brace balance.
// ---------------------------------------------------------------------------
type Mode = "CODE" | "SINGLE" | "DOUBLE" | "TEMPLATE";

/** Finds the substring from `src[openIdx]` (must be `{`) to its matching
 * `}`, aware of strings/templates/comments so braces inside them are never
 * mistaken for structural braces. `${...}` inside a template literal is
 * still real code (and its braces are counted), matching JS semantics. */
function findMatchingBrace(src: string, openIdx: number): string {
  const modeStack: Mode[] = ["CODE"];
  const braceKindStack: ("plain" | "template-expr")[] = [];
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === "CODE") {
      if (ch === "/" && src[i + 1] === "/") {
        const nl = src.indexOf("\n", i);
        i = nl === -1 ? src.length : nl;
        continue;
      }
      if (ch === "/" && src[i + 1] === "*") {
        const end = src.indexOf("*/", i + 2);
        i = end === -1 ? src.length : end + 1;
        continue;
      }
      if (ch === "'") {
        modeStack.push("SINGLE");
        continue;
      }
      if (ch === '"') {
        modeStack.push("DOUBLE");
        continue;
      }
      if (ch === "`") {
        modeStack.push("TEMPLATE");
        continue;
      }
      if (ch === "{") {
        depth++;
        braceKindStack.push("plain");
        continue;
      }
      if (ch === "}") {
        const kind = braceKindStack.pop();
        depth--;
        if (kind === "template-expr") modeStack.pop();
        if (depth === 0) return src.slice(openIdx, i + 1);
        continue;
      }
    } else if (top === "SINGLE" || top === "DOUBLE") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if ((top === "SINGLE" && ch === "'") || (top === "DOUBLE" && ch === '"')) modeStack.pop();
    } else if (top === "TEMPLATE") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") {
        modeStack.pop();
        continue;
      }
      if (ch === "$" && src[i + 1] === "{") {
        modeStack.push("CODE");
        braceKindStack.push("template-expr");
        depth++;
        i++;
        continue;
      }
    }
  }
  return src.slice(openIdx);
}

/** Splits an object-literal block's TOP-LEVEL (depth-1) comma-separated
 * property segments, string/template/comment-aware. `block` includes the
 * outer `{`/`}`. */
function topLevelSegments(block: string): string[] {
  const inner = block.slice(1, -1);
  const segments: string[] = [];
  const modeStack: Mode[] = ["CODE"];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = inner[i];
    if (top === "CODE") {
      if (ch === "/" && inner[i + 1] === "/") {
        const nl = inner.indexOf("\n", i);
        i = nl === -1 ? inner.length : nl;
        continue;
      }
      if (ch === "/" && inner[i + 1] === "*") {
        const end = inner.indexOf("*/", i + 2);
        i = end === -1 ? inner.length : end + 1;
        continue;
      }
      if (ch === "'") {
        modeStack.push("SINGLE");
        continue;
      }
      if (ch === '"') {
        modeStack.push("DOUBLE");
        continue;
      }
      if (ch === "`") {
        modeStack.push("TEMPLATE");
        continue;
      }
      if (ch === "{" || ch === "[" || ch === "(") {
        depth++;
        continue;
      }
      if (ch === "}" || ch === "]" || ch === ")") {
        depth--;
        continue;
      }
      if (ch === "," && depth === 0) {
        segments.push(inner.slice(start, i));
        start = i + 1;
        continue;
      }
    } else if (top === "SINGLE" || top === "DOUBLE") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if ((top === "SINGLE" && ch === "'") || (top === "DOUBLE" && ch === '"')) modeStack.pop();
    } else if (top === "TEMPLATE") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") {
        modeStack.pop();
        continue;
      }
      if (ch === "$" && inner[i + 1] === "{") {
        modeStack.push("CODE");
        depth++;
        i++;
        continue;
      }
    }
  }
  const last = inner.slice(start);
  if (last.trim() !== "") segments.push(last);
  return segments;
}

function topLevelKeys(block: string): string[] {
  const keys: string[] = [];
  for (const seg of topLevelSegments(block)) {
    const trimmed = seg.trim();
    const m = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(:|,|$)/.exec(trimmed);
    if (m) keys.push(m[1]!);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Side A -- paginated-envelope GET route shapes, derived from src/routes/**.
// A route qualifies iff: it is registered with `.get(`, and at least one
// `c.json({ ... })` in its handler carries BOTH `items` and `total` as
// TOP-LEVEL keys.
// ---------------------------------------------------------------------------
interface RouteReg {
  varName: string;
  method: string;
  path: string;
  index: number;
}

const ROUTE_REG_RE = /(\w+)\.(get|post|put|patch|delete)\(\s*(["'`])((?:\\.|(?!\3).)*)\3/g;
const CJSON_RE = /c\.json\(\s*\{/g;
const MOUNT_RE = /(\w+)\.route\(\s*(["'`])([^"'`]*)\2\s*,\s*(\w+)\s*\)/g;

function joinPaths(a: string, b: string): string {
  const combined = (a.replace(/\/$/, "") + "/" + b.replace(/^\//, "")).replace(/\/+/g, "/");
  return combined === "" ? "/" : combined;
}

/** Builds the Hono sub-app mount graph (parent var -> prefix -> child var)
 * by scanning src/index.ts AND every route module for `.route(prefix,
 * child)` calls (sub-apps mount other sub-apps, e.g. reviewPlansRoutes
 * composes 4 children before app.route("/", reviewRoutes) mounts IT). */
function buildMountGraph(routeFiles: string[]): Map<string, { parent: string; prefix: string }> {
  const mountsByChild = new Map<string, { parent: string; prefix: string }>();
  const files = [join(ROOT, "src", "index.ts"), ...routeFiles];
  for (const f of files) {
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    MOUNT_RE.lastIndex = 0;
    while ((m = MOUNT_RE.exec(src))) {
      const [, parent, , prefix, child] = m;
      if (!mountsByChild.has(child!)) mountsByChild.set(child!, { parent: parent!, prefix: prefix! });
    }
  }
  return mountsByChild;
}

function resolvePrefix(varName: string, mountsByChild: Map<string, { parent: string; prefix: string }>, cache: Map<string, string | null>): string | null {
  if (varName === "app") return "";
  if (cache.has(varName)) return cache.get(varName)!;
  const mount = mountsByChild.get(varName);
  if (!mount) return null;
  const parentPrefix = resolvePrefix(mount.parent, mountsByChild, cache);
  if (parentPrefix === null) return null;
  const full = joinPaths(parentPrefix, mount.prefix);
  cache.set(varName, full);
  return full;
}

/** Every full request path (e.g. "/api/v1/events/:eventId/files") this
 * codebase's own route registrations serve via GET with a top-level {
 * items, total } envelope. Exported so the population-population honesty
 * checks below can re-derive it independently of the ledger. */
export function scanEnvelopeRouteShapes(): string[] {
  const routeFiles = walk(ROUTES_DIR);
  const mountsByChild = buildMountGraph(routeFiles);
  const prefixCache = new Map<string, string | null>();
  const shapes = new Set<string>();

  for (const f of routeFiles) {
    const src = readFileSync(f, "utf8");
    const regs: RouteReg[] = [];
    let m: RegExpExecArray | null;
    ROUTE_REG_RE.lastIndex = 0;
    while ((m = ROUTE_REG_RE.exec(src))) {
      regs.push({ varName: m[1]!, method: m[2]!, path: m[4]!, index: m.index });
    }
    CJSON_RE.lastIndex = 0;
    while ((m = CJSON_RE.exec(src))) {
      const openIdx = m.index + m[0].length - 1;
      const block = findMatchingBrace(src, openIdx);
      const keys = topLevelKeys(block);
      if (!keys.includes("items") || !keys.includes("total")) continue;
      let owner: RouteReg | null = null;
      for (const r of regs) {
        if (r.index <= m.index) owner = r;
        else break;
      }
      if (!owner || owner.method !== "get") continue;
      const prefix = resolvePrefix(owner.varName, mountsByChild, prefixCache);
      if (prefix === null) continue;
      shapes.add(joinPaths(prefix, owner.path));
    }
  }
  return [...shapes].sort();
}

// ---------------------------------------------------------------------------
// Side B -- apiGet call sites under app/src/** whose URL literal matches one
// of the envelope route shapes above.
// ---------------------------------------------------------------------------
const APIGET_RE = /\bapiGet\s*(?:<[^>]*>)?\s*\(\s*(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g;
const API_PREFIX = "/api/v1"; // app/src/lib/api.ts prepends this to every apiGet(path) call

/** Strips a query string starting at the first '?' that appears OUTSIDE any
 * `${...}` interpolation -- a '?' inside a ternary inside the expression
 * doesn't end the path. */
function stripQuery(s: string): string {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "$" && s[i + 1] === "{") {
      depth++;
      i++;
      continue;
    }
    if (depth > 0 && s[i] === "}") {
      depth--;
      continue;
    }
    if (depth === 0 && s[i] === "?") return s.slice(0, i);
  }
  return s;
}

function callSegmentsRaw(quotedLiteral: string): string[] {
  const inner = quotedLiteral.slice(1, -1);
  const withPrefix = API_PREFIX + (inner.startsWith("/") ? inner : "/" + inner);
  return stripQuery(withPrefix)
    .split("/")
    .filter((s) => s.length > 0);
}

/** A call segment matches a route segment if the route segment is a
 * `:param` wildcard (matches anything), or the call segment's STATIC
 * prefix (the text before its first `${`, or the whole segment if there is
 * none) equals the route segment exactly. This lets `duplicates${query}`
 * match route segment `duplicates` (MergePage's `query` renders `?ids=...`
 * at runtime) while still refusing `${contact.id}` against an unrelated
 * literal segment like `duplicates`. */
function segMatches(routeSeg: string, callSegRaw: string): boolean {
  if (routeSeg === "*") return true;
  const idx = callSegRaw.indexOf("${");
  const staticPrefix = idx === -1 ? callSegRaw : callSegRaw.slice(0, idx);
  return staticPrefix === routeSeg;
}

function matchesAnyShape(callSegsRaw: string[], routeShapes: { segs: string[] }[]): boolean {
  return routeShapes.some((r) => r.segs.length === callSegsRaw.length && r.segs.every((s, i) => segMatches(s, callSegsRaw[i]!)));
}

/** Every non-test module under app/src/** whose source calls apiGet with a
 * URL literal matching one of the paginated-envelope route shapes. Exported
 * so the ledger-honesty checks can re-derive it independently. */
export function scanApiGetEnvelopeCallers(routeShapes: string[] = scanEnvelopeRouteShapes()): string[] {
  const shapes = routeShapes.map((s) => ({ segs: s.split("/").filter((seg) => seg.length > 0).map((seg) => (seg.startsWith(":") ? "*" : seg)) }));
  const files = walk(APP_SRC_DIR);
  const out = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    APIGET_RE.lastIndex = 0;
    while ((m = APIGET_RE.exec(src))) {
      const segs = callSegmentsRaw(m[1]!);
      if (matchesAnyShape(segs, shapes)) {
        out.add(relPath(f));
        break;
      }
    }
  }
  return [...out].sort();
}

// ---------------------------------------------------------------------------
// Ledger -- one row per population member.
// ---------------------------------------------------------------------------
interface LedgerEntry {
  file: string;
  verdict: "envelope" | "page-scoped" | "unpaged";
  reason: string;
  commentSnippet?: string;
}

const LEDGER: LedgerEntry[] = [
  {
    file: "app/src/pages/Agenda.tsx",
    verdict: "unpaged",
    reason: "GET /events/:eventId/breaks is bounded to MAX_BREAKS_PER_EVENT (unpaged-by-contract, same DEC-465 shape as the sibling ledger's other bounded lists); only res.items feeds allBreaks (day-filtered lists), no whole-set count is ever rendered from res.total.",
  },
  {
    file: "app/src/pages/contacts/DuplicateEmailNotice.tsx",
    verdict: "unpaged",
    reason: "GET /contacts?q= here is a first-match lookup (res.items.find(...) ?? res.items[0]) for the 409-duplicate-email forward path -- it renders a single contact's name/link, never a whole-set count from res.total.",
  },
  {
    file: "app/src/pages/contacts/MergePage.tsx",
    verdict: "envelope",
    reason: "DEC-748: pairPosition reads {index,total} off GET /contacts/duplicates?ids= straight from the envelope (res.total), never items.length -- this is the very defect DEC-748 fixed and the sibling ledger's stale prose wrongly claimed as the ONLY apiGet-envelope reader.",
  },
  {
    file: "app/src/pages/content/FilesLibrary.tsx",
    verdict: "envelope",
    reason: "setTotal(res.total) from GET /events/:eventId/files backs the header's 'N files' stat and the pager's 'Page P · N total' line.",
  },
];

const CHECKABLE_ROOT = "app/src/pages/";

/** Pure, exported classifier -- same shape and same checks as the sibling
 * scan's findLedgerProblems, applied to this file's own population/ledger. */
export function findLedgerProblems(population: string[], ledger: LedgerEntry[], readFile: (repoRelPath: string) => string | null = defaultReadFile): string[] {
  const problems: string[] = [];
  const populationSet = new Set<string>();
  for (const p of population) {
    if (populationSet.has(p)) {
      problems.push(`duplicate population member (broken population, not a ledger issue): ${p}`);
      continue;
    }
    populationSet.add(p);
  }

  const ledgerCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerCounts.set(entry.file, (ledgerCounts.get(entry.file) ?? 0) + 1);
  }

  for (const p of population) {
    const count = ledgerCounts.get(p) ?? 0;
    if (count === 0) problems.push(`population member with no ledger row: ${p}`);
    else if (count > 1) problems.push(`population member with ${count} ledger rows (must be exactly 1): ${p}`);
  }

  for (const entry of ledger) {
    if (!populationSet.has(entry.file)) problems.push(`stale ledger row citing a file not in the population: ${entry.file}`);
  }

  for (const entry of ledger) {
    if (!entry.file.startsWith(CHECKABLE_ROOT)) continue;
    if (readFile(entry.file) === null) {
      problems.push(`ledger row cites a nonexistent file: ${entry.file}`);
    }
  }

  const ENVELOPE_TOKEN_RE = /\.(total|count)\b/;
  for (const entry of ledger) {
    if (entry.verdict !== "envelope") continue;
    const src = readFile(entry.file);
    if (src === null) continue;
    if (!ENVELOPE_TOKEN_RE.test(src)) {
      problems.push(`ledger row ${entry.file} marked 'envelope' but its source contains no .total/.count token`);
    }
  }

  for (const entry of ledger) {
    if (entry.verdict !== "page-scoped") continue;
    if (!entry.commentSnippet) {
      problems.push(`ledger row ${entry.file} marked 'page-scoped' but carries no commentSnippet to verify`);
      continue;
    }
    const src = readFile(entry.file);
    if (src === null) continue;
    if (!src.includes(entry.commentSnippet)) {
      problems.push(`ledger row ${entry.file} marked 'page-scoped' but its source does not contain the cited justifying comment: "${entry.commentSnippet}"`);
    }
  }

  for (const entry of ledger) {
    if (!entry.reason || entry.reason.trim() === "") {
      problems.push(`ledger row ${entry.file} has no reason`);
    }
  }

  return problems;
}

function defaultReadFile(repoRelPath: string): string | null {
  const full = join(ROOT, repoRelPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}

describe("spa-envelope-reader-ledger.scan (DEC-518 wave-41 amendment)", () => {
  const routeShapes = scanEnvelopeRouteShapes();
  const population = scanApiGetEnvelopeCallers(routeShapes);

  it("tripwire: at least 20 GET route shapes in this codebase return a top-level { items, total } envelope, never hardcoded", () => {
    expect(routeShapes.length).toBeGreaterThanOrEqual(20);
  });

  it("a nested envelope (GET /pipeline/:id's { entry, contact, activity: { items, total } }) is NOT counted -- items/total must be TOP-LEVEL keys, not buried in a child object", () => {
    expect(routeShapes).not.toContain("/api/v1/pipeline/:id");
  });

  it("GET /events/:eventId/files (FilesLibrary's route) is a detected envelope shape", () => {
    expect(routeShapes).toContain("/api/v1/events/:eventId/files");
  });

  it("tripwire: at least 4 non-test app/src/** modules call apiGet against one of those route shapes, never hardcoded", () => {
    expect(population.length).toBeGreaterThanOrEqual(4);
  });

  it("FilesLibrary.tsx is in the population -- the exact blind spot this task closes (out of the sibling scan's apiList-only population, and wrongly absent from any apiGet ledger before this file existed)", () => {
    expect(population).toContain("app/src/pages/content/FilesLibrary.tsx");
  });

  it("MergePage.tsx is in the population -- the sibling ledger's prose called it 'the one place this codebase calls apiGet against a paginated list route', which is THIS file's population, not that one's", () => {
    expect(population).toContain("app/src/pages/contacts/MergePage.tsx");
  });

  it("every population member has exactly one ledger row, and every ledger row names a live population member", () => {
    const problems = findLedgerProblems(population, LEDGER).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate population member"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every ledger row's cited file exists on disk", () => {
    const problems = findLedgerProblems(population, LEDGER).filter((p) => p.includes("nonexistent file"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every 'envelope' row's file contains a .total/.count token", () => {
    const problems = findLedgerProblems(population, LEDGER).filter((p) => p.includes("no .total/.count token"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every 'page-scoped' row's file contains its cited justifying comment", () => {
    const problems = findLedgerProblems(population, LEDGER).filter((p) => p.includes("does not contain the cited justifying comment") || p.includes("carries no commentSnippet"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findLedgerProblems(population, LEDGER);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findLedgerProblems negative controls (DEC-518 wave-35 amendment: every scan ships one)", () => {
  const basePopulation = ["app/src/pages/synthetic/Compliant.tsx"];
  const files: Record<string, string> = {
    "app/src/pages/synthetic/Compliant.tsx": "setTotal(res.total); // reads the envelope",
    "app/src/pages/synthetic/ItemsLengthLie.tsx": "const count = res.items.length; // whole-set claim, envelope not read",
    "app/src/pages/synthetic/PageScopedNoComment.tsx": "const n = items.length; // no justification written down",
    "app/src/pages/synthetic/PageScopedWithComment.tsx": "// deliberately about the visible rows only\nconst n = items.length;",
  };
  function fakeReadFile(p: string): string | null {
    return p in files ? files[p]! : null;
  }
  const baseLedger: LedgerEntry[] = [{ file: "app/src/pages/synthetic/Compliant.tsx", verdict: "envelope", reason: "reads res.total" }];

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findLedgerProblems(basePopulation, baseLedger, fakeReadFile)).toEqual([]);
  });

  it("a synthetic module rendering a count from items.length, ledgered as 'envelope', IS reported (envelope claim vs .total presence)", () => {
    const pop = ["app/src/pages/synthetic/ItemsLengthLie.tsx"];
    const ledger: LedgerEntry[] = [{ file: "app/src/pages/synthetic/ItemsLengthLie.tsx", verdict: "envelope", reason: "claims envelope" }];
    const problems = findLedgerProblems(pop, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("no .total/.count token"))).toBe(true);
  });

  it("a stale ledger row naming a dead file IS reported (ledger -> population direction)", () => {
    const ledger: LedgerEntry[] = [...baseLedger, { file: "app/src/pages/synthetic/DoesNotExist.tsx", verdict: "unpaged", reason: "stale" }];
    const problems = findLedgerProblems(basePopulation, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("app/src/pages/synthetic/DoesNotExist.tsx"))).toBe(true);
  });

  it("a population member with no ledger row IS reported (population -> ledger direction)", () => {
    const pop = [...basePopulation, "app/src/pages/synthetic/Unledgered.tsx"];
    const problems = findLedgerProblems(pop, baseLedger, fakeReadFile);
    expect(problems.some((p) => p.includes("Unledgered.tsx"))).toBe(true);
  });

  it("a 'page-scoped' row whose file lacks the cited comment IS reported", () => {
    const pop = ["app/src/pages/synthetic/PageScopedNoComment.tsx"];
    const ledger: LedgerEntry[] = [
      { file: "app/src/pages/synthetic/PageScopedNoComment.tsx", verdict: "page-scoped", reason: "claims justification", commentSnippet: "deliberately about the visible rows only" },
    ];
    const problems = findLedgerProblems(pop, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("does not contain the cited justifying comment"))).toBe(true);
  });

  it("a 'page-scoped' row whose file DOES contain the cited comment is accepted", () => {
    const pop = ["app/src/pages/synthetic/PageScopedWithComment.tsx"];
    const ledger: LedgerEntry[] = [
      { file: "app/src/pages/synthetic/PageScopedWithComment.tsx", verdict: "page-scoped", reason: "justified", commentSnippet: "deliberately about the visible rows only" },
    ];
    expect(findLedgerProblems(pop, ledger, fakeReadFile)).toEqual([]);
  });

  it("a nonexistent file cited by any verdict IS reported", () => {
    const pop = ["app/src/pages/synthetic/Ghost.tsx"];
    const ledger: LedgerEntry[] = [{ file: "app/src/pages/synthetic/Ghost.tsx", verdict: "unpaged", reason: "ghost" }];
    const problems = findLedgerProblems(pop, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("nonexistent file"))).toBe(true);
  });
});
