// DEC-550 (Amendment, wave 18): test/anonymous-route-probe.test.ts claimed to
// "compose every sub-app src/index.ts mounts" but actually hand-copied the
// mount list into buildAnonymousApp() -- that list drifted from
// src/index.ts and silently missed six real mounts (importRoutes,
// publicSurfacesRoutes, embedsRoutes, breaksRoutes, contentNoteRoutes,
// mailStatusRoutes). This helper is the shared, non-hand-typed technique
// test/ssr-link-targets-scan.test.ts already uses to derive src/index.ts's
// route table (DEC-518): parse every literal `app.route("<prefix>",
// <identifier>)` call out of src/index.ts's own source, resolve each
// identifier through that file's own `import { ... } from "..."` bindings,
// dynamically import the real module, and pick the exported sub-app. Any
// caller that needs "the mounts src/index.ts registers, in order" should use
// parseIndexMounts() rather than hand-listing them again.
//
// Throws loudly (never skips) when an identifier has no import binding or
// the module has no such export -- a mount this helper can't resolve is a
// mount no caller built on top of it can vouch for either.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import type { AppEnv } from "../../src/server/env";

const INDEX_PATH = resolve(fileURLToPath(import.meta.url), "../../../src/index.ts");
const INDEX_DIR = dirname(INDEX_PATH);

interface ImportBinding {
  exportedName: string;
  modulePath: string;
}

function parseImportBindings(source: string): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source))) {
    const namesGroup = m[1];
    const modulePath = m[2];
    if (namesGroup === undefined || modulePath === undefined) continue;
    const names = namesGroup
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const raw of names) {
      const parts = raw.split(/\s+as\s+/).map((s) => s.trim());
      const exportedName = parts[0];
      if (!exportedName) continue;
      const localName = parts[1] ?? exportedName;
      bindings.set(localName, { exportedName, modulePath });
    }
  }
  return bindings;
}

interface RouteCall {
  prefix: string;
  identifier: string;
}

function parseRouteCalls(source: string): RouteCall[] {
  const calls: RouteCall[] = [];
  const routeCallRegex = /app\.route\(\s*(["'])((?:(?!\1).)*)\1\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = routeCallRegex.exec(source))) {
    const prefix = m[2];
    const identifier = m[3];
    if (prefix === undefined || identifier === undefined) continue;
    calls.push({ prefix, identifier });
  }
  return calls;
}

export interface IndexMount {
  prefix: string;
  identifier: string;
  subApp: Hono<AppEnv>;
}

/** Parses src/index.ts's own source and returns every `app.route(...)` mount
 * it registers, in source order, with each identifier resolved to its real
 * imported sub-app instance. */
export async function parseIndexMounts(): Promise<IndexMount[]> {
  const source = readFileSync(INDEX_PATH, "utf-8");
  const bindings = parseImportBindings(source);
  const routeCalls = parseRouteCalls(source);

  const moduleCache = new Map<string, Record<string, unknown>>();
  async function loadModule(modulePath: string): Promise<Record<string, unknown>> {
    let mod = moduleCache.get(modulePath);
    if (!mod) {
      const resolved = resolve(INDEX_DIR, modulePath);
      mod = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
      moduleCache.set(modulePath, mod);
    }
    return mod;
  }

  const mounts: IndexMount[] = [];
  for (const { prefix, identifier } of routeCalls) {
    const binding = bindings.get(identifier);
    if (!binding) {
      throw new Error(
        `src/index.ts calls app.route("${prefix}", ${identifier}) but ${identifier} is not bound by any ` +
          `import statement in that file -- parseIndexMounts can't resolve it and refuses to silently skip it (DEC-518).`,
      );
    }
    const mod = await loadModule(binding.modulePath);
    const subApp = mod[binding.exportedName];
    if (!subApp) {
      throw new Error(
        `src/index.ts imports ${identifier} (as ${binding.exportedName}) from "${binding.modulePath}", but that ` +
          `module has no such export.`,
      );
    }
    mounts.push({ prefix, identifier, subApp: subApp as Hono<AppEnv> });
  }
  return mounts;
}
