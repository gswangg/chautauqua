// DEC-627: "a closed two-list enumeration" is only trustworthy if it's
// actually closed -- this test enumerates every mutating route registration
// under src/routes/** from source (never a hand-copied list, per the field
// guide's "hand-listed manifests desync -- enumerate in a test") and
// requires each one to match exactly one of pubcache.ts's NEVER_PUBLIC /
// PUBLIC_AFFECTING patterns via the real affectsPublicOutput() predicate.
//
// Full mount paths are resolved from source too: src/index.ts's
// `app.route(prefix, subApp)` calls and any nested `x.route(prefix, y)`
// composition (src/routes/review/index.ts folds its four sub-apps into
// `reviewRoutes` before index.ts mounts that) are parsed into a prefix
// map, walked recursively back to the root ("app"), and concatenated with
// each route's own literal path.
//
// w8-g: DEC-627's enumeration only ran in one direction (every route ->
// some pattern). This file adds the other direction: every pattern in
// NEVER_PUBLIC/PUBLIC_AFFECTING must match at least one real registered
// route (no dead patterns), the two lists must never both match the same
// route (disjointness, with one documented, narrow exception below), and
// neither list may contain a duplicate pattern. On this pass every pattern
// in both lists turned out to be live -- no dead pattern or typo was found,
// so that direction is invariant lock-in (a green result on day one is the
// correct outcome, not a sign the check is toothless). The disjointness
// check did surface one real, already-safe overlap; see
// KNOWN_WILDCARD_SHADOW_OVERLAPS below for the finding and why it's fine.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyMutatingPath, matchPattern, NEVER_PUBLIC, PUBLIC_AFFECTING } from "../src/server/pubcache";

const REPO_ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(REPO_ROOT, "src", "routes");
const INDEX_FILE = join(REPO_ROOT, "src", "index.ts");

function listSourceFiles(dir: string, extRe: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full, extRe));
    } else if (extRe.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function relativePath(file: string): string {
  return file.slice(REPO_ROOT.length + 1);
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/** Joins a mount prefix and a route's own literal path the way Hono's
 * app.route() does: "/" as a prefix is a no-op, otherwise concatenate and
 * collapse a doubled slash at the seam. */
function joinPath(prefix: string, path: string): string {
  if (prefix === "/" || prefix === "") return path;
  const combined = prefix.replace(/\/$/, "") + path;
  return combined.replace(/\/{2,}/g, "/");
}

const routeFiles = [...listSourceFiles(ROUTES_ROOT, /\.(ts|tsx)$/), INDEX_FILE];
const sourcesByFile = new Map<string, string>(routeFiles.map((f) => [f, readFileSync(f, "utf8")]));

/** (childVar -> {prefix, parentVar}) parsed from every `x.route("<prefix>",
 * y)` call across src/routes/** and src/index.ts. The root is the literal
 * identifier "app" in src/index.ts, whose resolved prefix is "". */
interface Mount {
  prefix: string;
  parentVar: string;
}
const mounts = new Map<string, Mount>();
const mountRe = /(\w+)\.route\(\s*["'`]([^"'`]+)["'`]\s*,\s*(\w+)\s*\)/g;
for (const [, source] of sourcesByFile) {
  let m: RegExpExecArray | null;
  mountRe.lastIndex = 0;
  while ((m = mountRe.exec(source)) !== null) {
    const [, parentVar, prefix, childVar] = m;
    mounts.set(childVar!, { prefix: prefix!, parentVar: parentVar! });
  }
}

const prefixCache = new Map<string, string>();
function resolvePrefix(varName: string): string {
  if (varName === "app") return "";
  if (prefixCache.has(varName)) return prefixCache.get(varName)!;
  const mount = mounts.get(varName);
  if (!mount) {
    throw new Error(
      `pubcache-purge-classification scan: no app.route(...) mount found for "${varName}" -- ` +
        `every route sub-app must be reachable from "app" in src/index.ts (directly or via nested .route() composition).`,
    );
  }
  const parentPrefix = resolvePrefix(mount.parentVar);
  const full = joinPath(parentPrefix || "/", mount.prefix);
  prefixCache.set(varName, full);
  return full;
}

interface MutatingRoute {
  file: string;
  line: number;
  method: string;
  fullPath: string;
}

// Only identifiers that are actually Hono sub-apps (declared `export const
// XRoutes = new Hono<AppEnv>()`) are route registrations -- this excludes
// unrelated same-named calls like `db.delete(...)` or `store.put(...)`.
const routeVarRe = /export const (\w+) = new Hono</g;
const routeVarNames = new Set<string>();
for (const [, source] of sourcesByFile) {
  let m: RegExpExecArray | null;
  routeVarRe.lastIndex = 0;
  while ((m = routeVarRe.exec(source)) !== null) routeVarNames.add(m[1]!);
}

const registrationRe = /(\w+)\.(post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]/g;
const mutatingRoutes: MutatingRoute[] = [];
for (const [file, source] of sourcesByFile) {
  let m: RegExpExecArray | null;
  registrationRe.lastIndex = 0;
  while ((m = registrationRe.exec(source)) !== null) {
    const [, varName, method, literalPath] = m;
    if (!routeVarNames.has(varName!)) continue; // e.g. db.delete(...), store.put(...)
    const prefix = resolvePrefix(varName!);
    mutatingRoutes.push({
      file,
      line: lineNumberAt(source, m.index),
      method: method!.toUpperCase(),
      fullPath: joinPath(prefix, literalPath!),
    });
  }
}

describe("DEC-627: source-scanned mutating routes are all classified", () => {
  it("finds at least 60 mutating route registrations (scanner sanity check)", () => {
    expect(mutatingRoutes.length).toBeGreaterThanOrEqual(60);
  });

  it("every registered .post/.patch/.put/.delete route resolves a concrete, absolute full path", () => {
    for (const r of mutatingRoutes) {
      expect(r.fullPath.startsWith("/"), `${relativePath(r.file)}:${r.line} resolved to "${r.fullPath}"`).toBe(true);
    }
  });

  it("every mutating route matches exactly one of the two closed lists", () => {
    const offenders: string[] = [];
    for (const r of mutatingRoutes) {
      const classification = classifyMutatingPath(r.fullPath);
      if (classification === "unclassified") {
        offenders.push(
          `  ${relativePath(r.file)}:${r.line}: ${r.method} ${r.fullPath} matches neither NEVER_PUBLIC nor ` +
            `PUBLIC_AFFECTING in src/server/pubcache.ts -- add a pattern to exactly one list.`,
        );
      }
    }
    if (offenders.length > 0) {
      throw new Error(`Found ${offenders.length} unclassified mutating route(s):\n${offenders.join("\n")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("every pattern in NEVER_PUBLIC and PUBLIC_AFFECTING matches at least one registered mutating route", () => {
    const dead: string[] = [];
    for (const pattern of NEVER_PUBLIC) {
      if (!mutatingRoutes.some((r) => matchPattern(pattern, r.fullPath))) {
        dead.push(`  NEVER_PUBLIC: "${pattern}" matches no registered mutating route.`);
      }
    }
    for (const pattern of PUBLIC_AFFECTING) {
      if (!mutatingRoutes.some((r) => matchPattern(pattern, r.fullPath))) {
        dead.push(`  PUBLIC_AFFECTING: "${pattern}" matches no registered mutating route.`);
      }
    }
    if (dead.length > 0) {
      throw new Error(`Found ${dead.length} dead pattern(s) in pubcache.ts's closed lists:\n${dead.join("\n")}`);
    }
    expect(dead).toEqual([]);
  });

  // DEC-627 finding (w8-g, added when this disjointness test was written): the
  // single-segment ":seg" wildcard in matchPattern matches ANY literal value,
  // so PUBLIC_AFFECTING's "/api/v1/contacts/:id" (for the real PATCH
  // /contacts/:id route in src/routes/api/contacts/crud.ts) also syntactically
  // matches the literal sibling static route registered as POST
  // /api/v1/contacts/bulk-email (src/routes/api/contacts/bulk-email.ts:128).
  // This is NOT a live misclassification: classifyMutatingPath checks
  // NEVER_PUBLIC first (see its own doc comment and the "every mutating
  // route matches exactly one of the two closed lists" test above), and
  // NEVER_PUBLIC already lists "/api/v1/contacts/bulk-email*" explicitly, so
  // that route is correctly classified never-public in production. It is a
  // known, narrow limitation of a wildcard segment being unable to exclude a
  // sibling literal path in this pattern language, not a dead pattern or a
  // typo to fix — allowlisted here by exact resolved path, with this
  // rationale, rather than silently weakening the check for every route.
  const KNOWN_WILDCARD_SHADOW_OVERLAPS = new Set<string>(["/api/v1/contacts/bulk-email"]);

  it("no registered mutating route matches patterns in both NEVER_PUBLIC and PUBLIC_AFFECTING (disjointness)", () => {
    const overlaps: string[] = [];
    for (const r of mutatingRoutes) {
      if (KNOWN_WILDCARD_SHADOW_OVERLAPS.has(r.fullPath)) continue;
      const inNeverPublic = NEVER_PUBLIC.some((p) => matchPattern(p, r.fullPath));
      const inPublicAffecting = PUBLIC_AFFECTING.some((p) => matchPattern(p, r.fullPath));
      if (inNeverPublic && inPublicAffecting) {
        overlaps.push(`  ${relativePath(r.file)}:${r.line}: ${r.method} ${r.fullPath} matches both lists.`);
      }
    }
    if (overlaps.length > 0) {
      throw new Error(`Found ${overlaps.length} route(s) matching both closed lists:\n${overlaps.join("\n")}`);
    }
    expect(overlaps).toEqual([]);
  });

  it("no duplicate pattern exists within or across NEVER_PUBLIC and PUBLIC_AFFECTING", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [listName, list] of [
      ["NEVER_PUBLIC", NEVER_PUBLIC],
      ["PUBLIC_AFFECTING", PUBLIC_AFFECTING],
    ] as const) {
      for (const pattern of list) {
        const prior = seen.get(pattern);
        if (prior) {
          dupes.push(`  "${pattern}" appears in both ${prior} and ${listName} (or twice within one list).`);
        } else {
          seen.set(pattern, listName);
        }
      }
    }
    if (dupes.length > 0) {
      throw new Error(`Found ${dupes.length} duplicate pattern(s):\n${dupes.join("\n")}`);
    }
    expect(dupes).toEqual([]);
  });
});
