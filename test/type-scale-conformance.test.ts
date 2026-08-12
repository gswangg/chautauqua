import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-643 type-scale conformance: the five key-role rules named in this
// task's mandate (overview headline; section label; deadline strip label;
// deadline value + its nearest-weight override; row title) must reference
// the --chq-type-<role>-size|-weight|-tracking tokens declared in
// app/src/styles.css rather than the bare px/weight literals they used to
// carry -- a token migration, same style as palette-conformance.test.ts's
// source-scanning approach (no computed-style/browser instrument needed for
// a static "does the source still say `700` or `18px`" check).

const REPO_ROOT = join(__dirname, "..");
const STYLES_CSS = join(REPO_ROOT, "app/src/styles.css");
const OVERVIEW_CSS = join(REPO_ROOT, "app/src/pages/overview/overview.css");

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

/** Extracts the declaration block body for a single top-level selector (the
 * text between its `{` and matching `}`), assuming no nested braces -- true
 * for every plain CSS rule in overview.css. */
function ruleBody(clean: string, selector: string): string {
  const escaped = selector.replace(/[.[\]]/g, (c) => `\\${c}`);
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const m = re.exec(clean);
  if (!m) throw new Error(`type-scale-conformance: selector not found in overview.css: ${selector}`);
  return m[1]!;
}

const stylesSrc = readFileSync(STYLES_CSS, "utf8");
const overviewSrc = stripComments(readFileSync(OVERVIEW_CSS, "utf8"));

// Every --chq-type-* custom property declared in styles.css's :root.
const DECLARED_TYPE_TOKENS = new Set(
  Array.from(stripComments(stylesSrc).matchAll(/--chq-type-[a-z0-9-]+/g)).map((m) => m[0]),
);

describe("type-scale conformance (DEC-643)", () => {
  it("declared at least one --chq-type-* token in app/src/styles.css", () => {
    expect(DECLARED_TYPE_TOKENS.size).toBeGreaterThan(0);
  });

  const namedRoles: { label: string; selector: string; checkSize: boolean }[] = [
    { label: "overview headline", selector: ".chq-overview-headline", checkSize: true },
    { label: "section label", selector: ".chq-overview-section-label", checkSize: true },
    { label: "deadline strip label", selector: ".chq-overview-deadline-label", checkSize: true },
    { label: "deadline value", selector: ".chq-overview-deadline-value", checkSize: true },
    {
      label: "deadline value nearest-weight override",
      selector: ".chq-overview-deadline-value.chq-overview-deadline-nearest",
      checkSize: false,
    },
    // Row title's font-size is a deliberate 15-21px range across
    // .chq-overview-row-title-{sm,md,lg} modifiers (docs/design/README.md's
    // typography table lists "Row title | 15-21px / 600 / -0.015..-0.02em"
    // as a range, not a fixed value) -- DEC-643's token list names only
    // --chq-type-row-title-weight/-tracking for this role, so only those two
    // properties are asserted bare-literal-free here.
    { label: "row title", selector: ".chq-overview-row-title", checkSize: false },
  ];

  for (const { label, selector, checkSize } of namedRoles) {
    it(`${label} (${selector}) carries no bare numeric font-weight`, () => {
      const body = ruleBody(overviewSrc, selector);
      const weightMatch = /font-weight\s*:\s*([^;]+);/.exec(body);
      expect(weightMatch, `${selector} has no font-weight declaration`).not.toBeNull();
      const value = weightMatch![1]!.trim();
      expect(value.startsWith("var(")).toBe(true);
    });

    if (checkSize) {
      it(`${label} (${selector}) carries no bare px font-size`, () => {
        const body = ruleBody(overviewSrc, selector);
        const sizeMatch = /font-size\s*:\s*([^;]+);/.exec(body);
        expect(sizeMatch, `${selector} has no font-size declaration`).not.toBeNull();
        const value = sizeMatch![1]!.trim();
        expect(value.startsWith("var(")).toBe(true);
      });
    }
  }

  it("every var(--chq-type-*) referenced anywhere in app/src resolves to a token declared in app/src/styles.css", () => {
    const appFiles = glob(join(REPO_ROOT, "app/src"), [".css", ".ts", ".tsx"]);
    const referenced = new Set<string>();
    for (const file of appFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      for (const m of clean.matchAll(/var\((--chq-type-[a-z0-9-]+)/g)) {
        referenced.add(m[1]!);
      }
    }
    expect(referenced.size).toBeGreaterThan(0);
    const undeclared = Array.from(referenced).filter((t) => !DECLARED_TYPE_TOKENS.has(t));
    expect(undeclared).toEqual([]);
  });

  // Reverse direction, scoped to the roles this wave actually migrates (step 2
  // of the mandate: "replace the literals in the five key-role rules"). The
  // full typography table also seeds page-title/page-title-phone/body/meta/
  // micro tokens for pages this wave deliberately does not touch (task's
  // FILES YOU OWN excludes every other page CSS) -- those stay declared but
  // legitimately unreferenced until a later wave migrates their pages, so
  // they are not asserted against here.
  const MIGRATED_ROLE_TOKEN_PREFIXES = [
    "--chq-type-overview-headline",
    "--chq-type-section-label",
    "--chq-type-deadline-label",
    "--chq-type-deadline-value",
    "--chq-type-row-title",
  ];

  it("every --chq-type-* token for a role migrated this wave is referenced somewhere in app/src", () => {
    const appFiles = glob(join(REPO_ROOT, "app/src"), [".css", ".ts", ".tsx"]);
    const referenced = new Set<string>();
    for (const file of appFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      for (const m of clean.matchAll(/var\((--chq-type-[a-z0-9-]+)/g)) {
        referenced.add(m[1]!);
      }
    }
    const migratedTokens = Array.from(DECLARED_TYPE_TOKENS).filter((t) =>
      MIGRATED_ROLE_TOKEN_PREFIXES.some((prefix) => t.startsWith(prefix)),
    );
    expect(migratedTokens.length).toBeGreaterThan(0);
    const unreferenced = migratedTokens.filter((t) => !referenced.has(t));
    expect(unreferenced).toEqual([]);
  });
});
