// Coverage test for the DEC-144 render-sweep manifest (scripts/render-sweep.ts
// reads app/src/routeManifest.ts): regex-extracts every literal `path="..."`
// on a JSX <Route> element from app/src/App.tsx and app/src/pages/**/*.tsx,
// and fails if any extracted route pattern isn't represented (as a
// structurally-matching suffix, with dynamic segments normalized to
// `:param`) by at least one ROUTE_MANIFEST entry. This is a vitest test
// (not pure-core), so node:fs/node:path are fine here — same convention as
// scripts/*.test.ts elsewhere in the repo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_MANIFEST } from "./routeManifest";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

function walkTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTsxFiles(full));
    } else if (name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Extracts literal `path="..."` values from `<Route ...>` elements in a file's source. */
export function extractRoutePaths(source: string): string[] {
  const matches: string[] = [];
  // Match a <Route ...> opening tag (possibly spanning attributes across the
  // tag, non-greedy up to the closing `>`), then pull the `path="..."`
  // attribute out of it.
  const routeTagRe = /<Route\b[^>]*?\/?>/gs;
  for (const tagMatch of source.matchAll(routeTagRe)) {
    const tag = tagMatch[0];
    const pathMatch = /\bpath="([^"]+)"/.exec(tag);
    if (pathMatch) matches.push(pathMatch[1]!);
  }
  return matches;
}

/** Normalizes a raw route pattern (relative or absolute, `:param` segments) to a leading-slash, `:param`-normalized form. */
export function normalizePattern(raw: string): string {
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const collapsed = withSlash.replace(/\/:[^/]+/g, "/:param").replace(/\/$/, "");
  return collapsed === "" ? "/" : collapsed;
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/** Normalizes a manifest entry's literal path by replacing its param literal values with `:param`. */
export function normalizeManifestPath(path: string, params?: Record<string, string>): string {
  let out = path;
  if (params) {
    for (const value of Object.values(params)) {
      out = out.split(value).join(":param");
    }
  }
  return out;
}

/** True if `pattern` (already normalized) matches as a trailing segment run of some manifest path. */
export function patternCoveredByManifest(pattern: string, manifestPaths: readonly string[]): boolean {
  const patSegs = segments(pattern);
  if (patSegs.length === 0) return true; // bare "/" patterns are covered by the nav-root baseline entries
  return manifestPaths.some((mp) => {
    const mSegs = segments(mp);
    if (mSegs.length < patSegs.length) return false;
    const tail = mSegs.slice(mSegs.length - patSegs.length);
    return tail.every((seg, i) => seg === patSegs[i]);
  });
}

describe("routeManifest coverage", () => {
  const normalizedManifestPaths = ROUTE_MANIFEST.map((e) => normalizeManifestPath(e.path, e.params));

  it("covers every literal <Route path=\"...\"> found in App.tsx and pages/**/*.tsx", () => {
    const files = [join(APP_SRC, "App.tsx"), ...walkTsxFiles(join(APP_SRC, "pages"))];
    const uncovered: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      for (const raw of extractRoutePaths(source)) {
        const pattern = normalizePattern(raw);
        if (!patternCoveredByManifest(pattern, normalizedManifestPaths)) {
          uncovered.push(`${file}: path="${raw}" (normalized ${pattern})`);
        }
      }
    }
    expect(uncovered, `route patterns missing from ROUTE_MANIFEST:\n${uncovered.join("\n")}`).toEqual([]);
  });

  it("extracted at least one route pattern from App.tsx and Review.tsx (sanity check the regex isn't silently matching nothing)", () => {
    const appSource = readFileSync(join(APP_SRC, "App.tsx"), "utf-8");
    const reviewSource = readFileSync(join(APP_SRC, "pages", "Review.tsx"), "utf-8");
    expect(extractRoutePaths(appSource).length).toBeGreaterThan(0);
    expect(extractRoutePaths(reviewSource).length).toBeGreaterThan(0);
  });
});
