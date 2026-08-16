// Extracted from test/pubcache-purge-classification.test.ts (DEC-627) so any
// test that needs "every route registration, from source, with its resolved
// full mounted path" can reuse the exact same scanner instead of re-parsing
// src/routes/**/*.{ts,tsx} + src/index.ts a second time (field guide w31: THE
// ROUTE ENUMERATOR ALREADY EXISTS -- reuse it, never re-parse).
//
// Walks every `x.route("<prefix>", y)` composition (including nested ones,
// e.g. src/routes/review/index.ts folding four sub-apps into reviewRoutes
// before index.ts mounts that) into a prefix map, resolves each back to the
// root ("app" in src/index.ts, whose prefix is ""), and concatenates each
// route's own literal path with its resolved mount prefix. Reports file+line
// for every `.get/.post/.patch/.put/.delete(...)` registration on a real
// Hono sub-app (identifiers that happen to share a method name, like
// `db.delete(...)` or `store.put(...)`, are excluded).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const ROUTES_ROOT = join(REPO_ROOT, "src", "routes");
const INDEX_FILE = join(REPO_ROOT, "src", "index.ts");

export interface RegisteredRoute {
  method: string;
  path: string;
  file: string;
  line: number;
}

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

/** Walks src/routes/**\/*.{ts,tsx} + src/index.ts from source and returns
 * every `.get/.post/.patch/.put/.delete(...)` registration on a real Hono
 * sub-app, resolved to its full mounted path. */
export function enumerateRegisteredRoutes(): RegisteredRoute[] {
  const routeFiles = [...listSourceFiles(ROUTES_ROOT, /\.(ts|tsx)$/), INDEX_FILE];
  const sourcesByFile = new Map<string, string>(routeFiles.map((f) => [f, readFileSync(f, "utf8")]));

  // (childVar -> {prefix, parentVar}) parsed from every `x.route("<prefix>",
  // y)` call across src/routes/** and src/index.ts. The root is the literal
  // identifier "app" in src/index.ts, whose resolved prefix is "".
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
        `enumerateRegisteredRoutes scan: no app.route(...) mount found for "${varName}" -- ` +
          `every route sub-app must be reachable from "app" in src/index.ts (directly or via nested .route() composition).`,
      );
    }
    const parentPrefix = resolvePrefix(mount.parentVar);
    const full = joinPath(parentPrefix || "/", mount.prefix);
    prefixCache.set(varName, full);
    return full;
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

  const registrationRe = /(\w+)\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  const registeredRoutes: RegisteredRoute[] = [];
  for (const [file, source] of sourcesByFile) {
    let m: RegExpExecArray | null;
    registrationRe.lastIndex = 0;
    while ((m = registrationRe.exec(source)) !== null) {
      const [, varName, method, literalPath] = m;
      if (!routeVarNames.has(varName!)) continue; // e.g. db.delete(...), store.put(...)
      const prefix = resolvePrefix(varName!);
      registeredRoutes.push({
        file,
        line: lineNumberAt(source, m.index),
        method: method!.toUpperCase(),
        path: joinPath(prefix, literalPath!),
      });
    }
  }
  return registeredRoutes;
}

// ---------------------------------------------------------------------------
// resolveRegisteredRoute -- DEC-817 (wave-53 amendment). Resolves a client
// method+path against the REAL route table (enumerateRegisteredRoutes()),
// replacing the hand-written ROUTE_MODULE_MAP that DEC-817's own ruling named
// as a hand-listed population. Semantics fixed by the ruling so multiple
// lanes can implement this identically:
//   - upper-case the method
//   - strip a trailing `?...` query string and `#...` fragment from
//     clientPath
//   - replace every `${...}` span in clientPath with a literal `:param`
//     segment (the caller may also pass an already-normalized path -- a
//     `:param` segment on the client side still compares as a wildcard
//     against a registered `:name` segment, and as a literal segment
//     against anything else, which is what callers here want)
//   - compare segment-wise against every same-method registration: a
//     registered `:name` segment matches any one client segment; a
//     registered `*` (or a trailing `/*`) matches all remaining segments;
//     every other segment must match exactly
//   - first match wins; undefined when nothing matches
// ---------------------------------------------------------------------------
function stripQueryAndFragment(path: string): string {
  return path.split("?")[0]!.split("#")[0]!;
}

function normalizeClientPath(path: string): string {
  return stripQueryAndFragment(path).replace(/\$\{[^}]*\}/g, ":param");
}

function segmentsOf(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

function matchesRegistration(clientSegments: string[], registeredPath: string): boolean {
  const regSegments = segmentsOf(registeredPath);
  let ci = 0;
  for (let ri = 0; ri < regSegments.length; ri++) {
    const regSeg = regSegments[ri]!;
    if (regSeg === "*") {
      // A wildcard segment (or the last segment being "*") matches all
      // remaining client segments (including zero).
      return true;
    }
    if (regSeg.startsWith(":")) {
      if (ci >= clientSegments.length) return false;
      ci++;
      continue;
    }
    if (ci >= clientSegments.length) return false;
    if (clientSegments[ci] !== regSeg) return false;
    ci++;
  }
  return ci === clientSegments.length;
}

let cachedRoutes: RegisteredRoute[] | undefined;
function routesForResolve(): RegisteredRoute[] {
  if (!cachedRoutes) cachedRoutes = enumerateRegisteredRoutes();
  return cachedRoutes;
}

export function resolveRegisteredRoute(method: string, clientPath: string): RegisteredRoute | undefined {
  const upperMethod = method.toUpperCase();
  const normalized = normalizeClientPath(clientPath);
  const clientSegments = segmentsOf(normalized);
  for (const route of routesForResolve()) {
    if (route.method !== upperMethod) continue;
    if (matchesRegistration(clientSegments, route.path)) return route;
  }
  return undefined;
}
