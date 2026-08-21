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

  // DEC-403: the manifest must also carry the no-login surfaces the mobile
  // pass (scripts/render-sweep.ts's MOBILE_ROUTE_MANIFEST) visits, so the
  // desktop sweep covers everything the mobile sweep covers. Pinned as
  // literal paths so a later edit can't quietly drop one.
  it("carries every DEC-403 no-login surface the mobile pass visits", () => {
    const manifestPaths = ROUTE_MANIFEST.map((e) => e.path);
    const required = [
      "/e/devflow-conf-2027/sessions/seed_submission_0001",
      "/e/devflow-conf-2027/speakers/seed_contact_0001",
      "/embed/devflow-conf-2027/sessions",
      "/embed/devflow-conf-2027/agenda",
      "/embed/devflow-conf-2027/speakers",
      "/login",
      "/docs/api",
      "/dev/mailbox",
    ];
    for (const path of required) {
      expect(manifestPaths, `missing DEC-403 entry: ${path}`).toContain(path);
    }
  });
});

// DEC-144 (wave-154 amendment): every tab/panel sub-state a page declares
// for itself must have a matching ROUTE_MANIFEST row -- source-scanned from
// each page's OWN tab/panel union so a new tab landing with no manifest row
// fails HERE, by name, instead of the render sweep silently never visiting
// it (the /admin/contacts?tab=pipeline gap DEC-144's ruling names). A
// hand-listed population is not a population (DEC-180): these arrays are
// extracted from the page source text on every run, never typed by hand.
describe("routeManifest tab/panel sub-state parity (DEC-144)", () => {
  /** Every quoted string literal inside a `type <name> = 'a' | 'b' | ...;`
   * declaration in `source`. */
  function extractTypeUnion(source: string, typeName: string): string[] {
    const re = new RegExp(`type ${typeName}\\s*=\\s*([^;]+);`);
    const m = re.exec(source);
    if (!m) throw new Error(`type ${typeName} not found in source`);
    return [...m[1]!.matchAll(/'([a-zA-Z0-9_-]+)'/g)].map((x) => x[1]!);
  }

  /** Every quoted string literal inside an `export const <name> = [...] as
   * const;` array declaration in `source`. */
  function extractConstArray(source: string, constName: string): string[] {
    const re = new RegExp(`export const ${constName}\\s*=\\s*\\[([^\\]]+)\\]`);
    const m = re.exec(source);
    if (!m) throw new Error(`export const ${constName} not found in source`);
    return [...m[1]!.matchAll(/'([a-zA-Z0-9_-]+)'/g)].map((x) => x[1]!);
  }

  /** The single captured group of the first match of `re` against `source`,
   * throwing (not silently defaulting) if `re` doesn't match -- this test's
   * job is to notice when the page's own shape moved. */
  function extractOne(source: string, re: RegExp, label: string): string {
    const m = re.exec(source);
    if (!m) throw new Error(`${label} not found in source`);
    return m[1]!;
  }

  const commsSource = readFileSync(join(APP_SRC, "pages", "Comms.tsx"), "utf-8");
  const contactsSource = readFileSync(join(APP_SRC, "pages", "contacts", "ContactsApp.tsx"), "utf-8");
  const settingsSource = readFileSync(join(APP_SRC, "pages", "Settings.tsx"), "utf-8");
  const contentAppSource = readFileSync(join(APP_SRC, "pages", "content", "ContentApp.tsx"), "utf-8");
  const worklistSource = readFileSync(join(APP_SRC, "pages", "content", "worklist.ts"), "utf-8");

  interface SubStateGroup {
    /** Human label for failure messages. */
    label: string;
    /** The manifest row path this sub-state's query string is appended to. */
    basePath: string;
    /** The query param name (`tab`, `section`, `view`, ...). */
    param: string;
    /** Every value the page's own union/array declares. */
    values: string[];
    /** The value that needs NO extra row because the bare `basePath` row
     * already renders it (the param's own fallback-when-absent). `null`
     * when the bare row renders neither this param's default NOR any
     * single value (Settings: absent `?section=` renders the phone index,
     * not any one section) -- every value then needs its own row. */
    defaultValue: string | null;
  }

  const groups: SubStateGroup[] = [
    {
      label: "Comms.tsx `type Tab`",
      basePath: "/admin/comms",
      param: "tab",
      values: extractTypeUnion(commsSource, "Tab"),
      defaultValue: extractOne(
        commsSource,
        /isTab\(rawTab\) \? rawTab : '([a-zA-Z0-9_-]+)'/,
        "Comms.tsx default tab fallback",
      ),
    },
    {
      label: "ContactsApp.tsx `type Panel`",
      basePath: "/admin/contacts",
      param: "tab",
      values: extractTypeUnion(contactsSource, "Panel"),
      defaultValue: extractOne(
        contactsSource,
        /const panel: Panel = [^\n]*: '([a-zA-Z0-9_-]+)';/,
        "ContactsApp.tsx default panel fallback",
      ),
    },
    {
      label: "Settings.tsx `SECTIONS` panel keys",
      basePath: "/admin/settings",
      param: "section",
      // SECTIONS is the only `key: '...'`-shaped array in this file (see
      // routeManifest.ts's own DEC-144 comment); source-scanned rather than
      // imported so this test needs no jsdom/React module graph.
      values: [...settingsSource.matchAll(/\bkey: '([a-zA-Z0-9_-]+)'/g)].map((x) => x[1]!),
      // Absent `?section=` seeds `active` to null (the phone index/hub),
      // not any one section -- every key needs its own row.
      defaultValue: null,
    },
    {
      label: "ContentApp.tsx worklist.ts `WORKLIST_TABS`",
      basePath: "/admin/content",
      param: "tab",
      values: extractConstArray(worklistSource, "WORKLIST_TABS"),
      defaultValue: extractOne(
        contentAppSource,
        /DEFAULT_WORKLIST_TAB: WorklistTab = '([a-zA-Z0-9_-]+)'/,
        "ContentApp.tsx default worklist tab",
      ),
    },
    {
      label: "ContentApp.tsx `type ContentView`",
      basePath: "/admin/content",
      param: "view",
      values: extractTypeUnion(contentAppSource, "ContentView"),
      defaultValue: extractOne(
        contentAppSource,
        /ContentView \| null\) \?\? '([a-zA-Z0-9_-]+)'/,
        "ContentApp.tsx default view fallback",
      ),
    },
  ];

  it("every group's own source extraction found at least one value (sanity check the regexes aren't silently matching nothing)", () => {
    for (const group of groups) {
      expect(group.values.length, `${group.label}: extracted zero values`).toBeGreaterThan(0);
    }
  });

  it("every declared tab/panel key not covered by the bare route's default has its own ROUTE_MANIFEST row", () => {
    const manifestPaths = new Set(ROUTE_MANIFEST.map((e) => e.path));
    const missing: string[] = [];
    for (const group of groups) {
      for (const value of group.values) {
        if (value === group.defaultValue) continue;
        const expectedPath = `${group.basePath}?${group.param}=${value}`;
        if (!manifestPaths.has(expectedPath)) {
          missing.push(`${group.label}: "${value}" -- expected ROUTE_MANIFEST row { path: "${expectedPath}" }`);
        }
      }
    }
    expect(missing, `tab/panel keys with no ROUTE_MANIFEST row:\n${missing.join("\n")}`).toEqual([]);
  });
});
