// DEC-433 amendment (wave 44): PUBLIC_CACHE_KEY_PARAMS must be DERIVED from
// the real handler code, not hand-typed — an unkeyed param that affects
// rendering would serve the wrong cached page. This scans every file under
// src/routes/public/** for `c.req.query("<name>")` string literals and
// asserts the collected set equals PUBLIC_CACHE_KEY_PARAMS plus exactly
// the asserted exclusions (`ids`, `draft`).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_CACHE_KEY_PARAMS } from "../src/server/repo/public/bounds";
import { isUncacheableIcsRequest } from "../src/server/pubcache";
import { publicSubmitRoutes } from "../src/routes/public/submit";

const PUBLIC_DIR = join(__dirname, "..", "src", "routes", "public");

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function collectQueryParamNames(): Set<string> {
  const names = new Set<string>();
  const pattern = /c\.req\.query\(\s*["']([^"']+)["']\s*\)/g;
  for (const file of collectFiles(PUBLIC_DIR)) {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content))) {
      names.add(match[1]!);
    }
  }
  return names;
}

describe("PUBLIC_CACHE_KEY_PARAMS derivation", () => {
  it("equals every c.req.query() literal under src/routes/public/** minus the asserted exclusions", () => {
    const found = collectQueryParamNames();
    const exclusions = new Set(["ids", "draft"]);

    const derived = new Set([...found].filter((name) => !exclusions.has(name)));
    const keyed = new Set(PUBLIC_CACHE_KEY_PARAMS);

    const unkeyed = [...derived].filter((name) => !keyed.has(name));
    if (unkeyed.length > 0) {
      throw new Error(
        `pubcache-key-param-derivation: query param(s) [${unkeyed.join(", ")}] are read under ` +
          `src/routes/public/** but are NOT in PUBLIC_CACHE_KEY_PARAMS — an unkeyed param that ` +
          `affects rendering would serve the wrong cached page.`,
      );
    }

    const staleKeyed = [...keyed].filter((name) => !derived.has(name));
    expect(staleKeyed).toEqual([]);
    expect(derived).toEqual(keyed);

    // Every found name is accounted for by either PUBLIC_CACHE_KEY_PARAMS
    // or one of the two asserted exclusions — nothing silently unaccounted.
    for (const name of found) {
      expect(keyed.has(name) || exclusions.has(name)).toBe(true);
    }
  });

  it("`ids` (schedule.ics) still bypasses the cache via isUncacheableIcsRequest, not via keying", () => {
    expect(isUncacheableIcsRequest("https://x.test/e/foo/schedule.ics?ids=a,b")).toBe(true);
    expect(isUncacheableIcsRequest("https://x.test/e/foo/schedule.ics?ids=")).toBe(true);
    // A non-ics /e/* request carrying ?ids= (e.g. a stray param) is NOT
    // exempted by isUncacheableIcsRequest — `ids` genuinely is unkeyed and
    // relies entirely on the schedule.ics-specific bypass, not on general
    // cache-key exclusion.
    expect(isUncacheableIcsRequest("https://x.test/e/foo/sessions?ids=a,b")).toBe(false);
  });

  it("`draft` (submit.tsx) is never mounted under /e/* or /embed/*", () => {
    const registeredPaths = (publicSubmitRoutes.routes ?? []).map((r) => r.path);
    expect(registeredPaths.length).toBeGreaterThan(0);
    for (const path of registeredPaths) {
      expect(path.startsWith("/e/")).toBe(false);
      expect(path.startsWith("/embed/")).toBe(false);
      expect(path.startsWith("/submit/")).toBe(true);
    }
  });
});
