// DEC-988 (wave-77 amendment): DEFAULT_PORTAL_SETTINGS
// (src/domain/portal-settings.ts) is the ONE author for "what does an event
// with no portal_settings row look like?" This scan guards against a ninth
// site inventing its own answer: no file outside the declaring module (and
// its one documented app/ -> src/ crossing, app/src/lib/portal-defaults.ts)
// may write a bare `showResources: true` literal or a `showResources ??
// true` / `showResources ... : true` guess. Every real consumer spends
// DEFAULT_PORTAL_SETTINGS.showResources instead (see
// src/routes/api/portal-config.ts, src/server/repo/portal-config.ts,
// src/routes/portal/{preview,index}.tsx, src/routes/portal/tasks/
// resources.tsx, src/server/repo/portal/data.ts, src/db/schema/content.ts,
// app/src/pages/settings/PortalSettingsPanel.tsx).
//
// Test files are exempt: seeding a mock record with `showResources: true`
// is asserting against a KNOWN fixture value, not guessing the absent-row
// default, and this population is already excluded by DEC-180's same-file
// exclusion convention for fixture data.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_SETTINGS } from "../src/domain/portal-settings";
import { portalSettings } from "../src/db/schema/content";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

const DECLARING_MODULE = join(REPO_ROOT, "src", "domain", "portal-settings.ts");
const CROSSING_MODULE = join(REPO_ROOT, "app", "src", "lib", "portal-defaults.ts");

/** Every .ts/.tsx file under `root`, excluding test files. */
function allNonTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// A bare `showResources: true` property literal, or a `showResources ??
// true`-shaped guess reconstructing the absent-row default inline.
const BARE_TRUE_RE = /showResources\s*:\s*true\b/;
const GUESS_RE = /showResources[^\n;]{0,80}\?\?\s*true\b/;

function findViolations(src: string): string[] {
  const found: string[] = [];
  if (BARE_TRUE_RE.test(src)) found.push("bare `showResources: true`");
  if (GUESS_RE.test(src)) found.push("`showResources ?? true` guess");
  return found;
}

describe("The absent portal_settings row has one author (DEC-988 wave-77 amendment)", () => {
  const files = [...allNonTestFiles(join(REPO_ROOT, "src")), ...allNonTestFiles(join(REPO_ROOT, "app", "src"))];

  it("scanned more than one file", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no file outside the declaring module and its one SPA crossing restates the default", () => {
    const offenders: string[] = [];
    for (const path of files) {
      if (path === DECLARING_MODULE || path === CROSSING_MODULE) continue;
      const src = readFileSync(path, "utf-8");
      const found = findViolations(src);
      if (found.length > 0) offenders.push(`${relative(REPO_ROOT, path)}: ${found.join(", ")}`);
    }
    expect(offenders, `files restating the absent-row default:\n${offenders.join("\n")}`).toEqual([]);
  });

  // Positive control: the detector DOES flag the exact shape this scan bans.
  it("positive control: the detector flags a bare literal and a `?? true` guess", () => {
    expect(findViolations("const x = { showResources: true };")).toContain("bare `showResources: true`");
    expect(findViolations("settings?.showResources ?? true")).toContain("`showResources ?? true` guess");
    expect(findViolations("showResources: input.showResources ?? DEFAULT_PORTAL_SETTINGS.showResources")).toEqual([]);
  });

  it("DEFAULT_PORTAL_SETTINGS.showResources agrees with the schema column's declared default", () => {
    expect(DEFAULT_PORTAL_SETTINGS.showResources).toBe(true);
    expect((portalSettings as unknown as { showResources: { default: boolean } }).showResources.default).toBe(
      DEFAULT_PORTAL_SETTINGS.showResources,
    );
  });
});
