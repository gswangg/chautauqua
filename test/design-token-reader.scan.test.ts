import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-180 (wave-5 amendment, sha ee8ceffa): "the design-token reader
// population is every --chq-* declared in the two token sheets, not the
// --chq-type-* prefix". test/type-scale-conformance.test.ts already runs
// the declared-with-no-reader ledger for the --chq-type-* role migration
// (DEC-643/DEC-851 wave-2) and keeps owning that prefix's ledger -- this
// scan is the SAME rule (DEC-851 wave-2: a declared design token with no
// reader is the same lie as a declared knob with no reader) applied to
// every OTHER --chq-* custom property declared in app/src/styles.css or
// src/views/theme.ts (colour, radius, measure, motion tokens etc), so the
// two scans never fight over the same token: this file EXCLUDES the
// --chq-type- prefix by name, citing type-scale-conformance.test.ts.

const REPO_ROOT = join(__dirname, "..");
const STYLES_CSS = join(REPO_ROOT, "app/src/styles.css");
const THEME_TS = join(REPO_ROOT, "src/views/theme.ts");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Recursively collect files under `dir` whose path ends with one of `suffixes`. */
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

const TYPE_PREFIX = "--chq-type-";

/** Every --chq-* custom property DECLARED (`--name:`) in either token
 * sheet, comments stripped, EXCLUDING the --chq-type-* prefix that
 * type-scale-conformance.test.ts owns. */
function declaredTokens(): Set<string> {
  const stylesSrc = stripComments(readFileSync(STYLES_CSS, "utf8"));
  const themeSrc = stripComments(readFileSync(THEME_TS, "utf8"));
  const out = new Set<string>();
  for (const src of [stylesSrc, themeSrc]) {
    for (const m of src.matchAll(/--chq-[a-z0-9-]+(?=\s*:)/g)) {
      const token = m[0]!;
      if (!token.startsWith(TYPE_PREFIX)) out.add(token);
    }
  }
  return out;
}

/** Every var(--chq-*) reference across BOTH src/** and app/src/** (theme
 * tokens are consumed by SSR .css.ts string modules and by the SPA sheets
 * alike -- searching one tree only would produce false positives). */
function referencedTokens(): Set<string> {
  const files = [
    ...glob(join(REPO_ROOT, "app/src"), [".css", ".ts", ".tsx"]),
    ...glob(join(REPO_ROOT, "src"), [".css", ".ts", ".tsx"]),
  ];
  const out = new Set<string>();
  for (const file of files) {
    const clean = stripComments(readFileSync(file, "utf8"));
    for (const m of clean.matchAll(/var\((--chq-[a-z0-9-]+)/g)) {
      const token = m[1]!;
      if (!token.startsWith(TYPE_PREFIX)) out.add(token);
    }
  }
  return out;
}

const DECLARED_TOKENS = declaredTokens();
const REFERENCED_TOKENS = referencedTokens();

// Ledger of declared-but-unreferenced tokens that are NOT dead, because
// either (a) they are reached through string interpolation (grep for
// `var(--chq-${` before trusting this), or (b) they are the documented
// light/dark or hover counterpart of a token that IS read. A row with a
// schedule-shaped reason (wave/branch citation) is rejected below, same
// machine check as type-scale-conformance.test.ts's ledger.
const UNREFERENCED_TOKENS_PENDING: { token: string; reason: string }[] = [];

describe("design-token reader scan (DEC-180 wave-5 amendment, DEC-069)", () => {
  it("excludes the --chq-type- prefix, which type-scale-conformance.test.ts owns", () => {
    for (const token of DECLARED_TOKENS) {
      expect(token.startsWith(TYPE_PREFIX)).toBe(false);
    }
  });

  it("declared a non-trivial population of non-type --chq-* tokens across both token sheets", () => {
    expect(DECLARED_TOKENS.size).toBeGreaterThan(40);
  });

  it("no var(--chq-${...) interpolated token construction exists in either tree (would hide a live reference from the static scan)", () => {
    const files = [
      ...glob(join(REPO_ROOT, "app/src"), [".css", ".ts", ".tsx"]),
      ...glob(join(REPO_ROOT, "src"), [".css", ".ts", ".tsx"]),
    ];
    const interpolated: string[] = [];
    for (const file of files) {
      const clean = stripComments(readFileSync(file, "utf8"));
      if (/var\(--chq-\$\{/.test(clean)) interpolated.push(file);
    }
    expect(interpolated).toEqual([]);
  });

  it("ledger reasons name a product reason, not a schedule", () => {
    for (const { token, reason } of UNREFERENCED_TOKENS_PENDING) {
      expect(reason, `${token}: ledger reason reads like a schedule`).not.toMatch(/task-w\d+-[a-z]/i);
      expect(reason.toLowerCase(), `${token}: ledger reason names a wave instead of a product reason`).not.toMatch(
        /\bwave\b/,
      );
    }
  });

  it("every declared non-type --chq-* token is either referenced (in src/** or app/src/**) or carries a ledger entry -- never both, never neither", () => {
    const ledgered = new Set(UNREFERENCED_TOKENS_PENDING.map((e) => e.token));

    // Direction 1: every declared token is referenced XOR ledgered.
    for (const token of DECLARED_TOKENS) {
      const isReferenced = REFERENCED_TOKENS.has(token);
      const isLedgered = ledgered.has(token);
      expect(
        isReferenced !== isLedgered,
        `${token}: referenced=${isReferenced}, ledgered=${isLedgered} -- must be exactly one of the two`,
      ).toBe(true);
    }

    // Direction 2: every ledger entry names a real declared token (no stale rows).
    for (const token of ledgered) {
      expect(DECLARED_TOKENS.has(token), `${token}: ledgered but not declared in either token sheet`).toBe(true);
    }
  });

  // Negative control: a synthetic declared-and-unreferenced token IS
  // reported by the same XOR check the real assertion above uses.
  it("negative control: a synthetic declared-and-unreferenced token fails the XOR check", () => {
    const declared = new Set(DECLARED_TOKENS);
    declared.add("--chq-synthetic-dead-token");
    const ledgered = new Set(UNREFERENCED_TOKENS_PENDING.map((e) => e.token));
    const token = "--chq-synthetic-dead-token";
    const isReferenced = REFERENCED_TOKENS.has(token);
    const isLedgered = ledgered.has(token);
    expect(isReferenced !== isLedgered).toBe(false);
  });

  // Positive control: a real declared token that IS referenced passes.
  it("positive control: --chq-brand (declared and referenced) passes the XOR check", () => {
    expect(DECLARED_TOKENS.has("--chq-brand")).toBe(true);
    expect(REFERENCED_TOKENS.has("--chq-brand")).toBe(true);
  });
});
