// DEC-957 (amendment, wave 56): capitalize-first gets ONE home --
// src/domain/count-copy.ts's capitalizeFirst. Five modules (src/routes/
// root.tsx twice, src/routes/public/submit-views.tsx,
// src/routes/public/sessions.tsx, app/src/pages/agenda/ConflictChip.tsx,
// app/src/components/ErrorSummary.tsx, app/src/pages/settings/
// PeopleRolesPanel.tsx) had hand-copied or re-derived the same
// `charAt(0).toUpperCase() + slice(1)` capitalization idiom before this
// task. This scan bans that idiom anywhere outside src/domain/
// count-copy.ts (the ONE legitimate declaration) so a future copy can't
// silently re-drift.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const APP_SRC_ROOT = join(ROOT, "app", "src");

// The ONE legitimate home for the capitalize-first idiom.
const OWNER = "src/domain/count-copy.ts";

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

// A capitalize-first expression: `.charAt(0).toUpperCase()` co-occurring
// with `.slice(1)` anywhere in the file. Checking the two fragments'
// co-occurrence (rather than requiring them adjacent in one expression)
// catches both the inline-template form (`${s.charAt(0).toUpperCase()}
// ${s.slice(1)}`) and the concatenation form (`s.charAt(0).toUpperCase() +
// s.slice(1)`) without over-fitting to one spelling.
const CHAR_AT_UPPER = /\.charAt\(0\)\.toUpperCase\(\)/;
const SLICE_ONE = /\.slice\(1\)/;

function hasCapitalizeFirstIdiom(contents: string): boolean {
  return CHAR_AT_UPPER.test(contents) && SLICE_ONE.test(contents);
}

export function findCapitalizeFirstOffenders(root: string, repoRoot: string): string[] {
  const offenders: string[] = [];
  for (const file of walk(root)) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    if (rel === OWNER) continue;
    const contents = readFileSync(file, "utf8");
    if (hasCapitalizeFirstIdiom(contents)) offenders.push(rel);
  }
  return offenders.sort();
}

describe("text-vocabulary.scan (DEC-957 amendment, wave 56): one capitalize-first helper", () => {
  it("scanned at least 1 file under src/ and app/src/ (vacuous-scan tripwire)", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
    expect(walk(APP_SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("src/domain/count-copy.ts genuinely declares the idiom (proves the pattern isn't vacuous)", () => {
    const src = readFileSync(join(ROOT, OWNER), "utf8");
    expect(hasCapitalizeFirstIdiom(src)).toBe(true);
  });

  it("no module other than count-copy.ts declares the charAt(0).toUpperCase()/slice(1) idiom", () => {
    const offenders = [...findCapitalizeFirstOffenders(SRC_ROOT, ROOT), ...findCapitalizeFirstOffenders(APP_SRC_ROOT, ROOT)];
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("negative control: app/src/lib/identity.ts's initials form (charAt(0).toUpperCase() with NO slice(1)) stays green", () => {
    const src = readFileSync(join(APP_SRC_ROOT, "lib", "identity.ts"), "utf8");
    expect(CHAR_AT_UPPER.test(src)).toBe(true);
    expect(SLICE_ONE.test(src)).toBe(false);
    expect(hasCapitalizeFirstIdiom(src)).toBe(false);
  });

  it("negative control: a synthetic co-occurring idiom IS detected", () => {
    const synthetic = "function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }";
    expect(hasCapitalizeFirstIdiom(synthetic)).toBe(true);
  });

  it("negative control: charAt(0).toUpperCase() alone (no slice(1) anywhere) is NOT detected", () => {
    const synthetic = "function shout(s) { return s.charAt(0).toUpperCase(); }";
    expect(hasCapitalizeFirstIdiom(synthetic)).toBe(false);
  });
});
