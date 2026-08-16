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

  // Reverse direction, over EVERY declared --chq-type-* token (DEC-851 w2
  // amendment: the declared-with-no-reader rule now runs on CSS custom
  // properties too, same as it runs on settings/query knobs). A token that
  // is not yet referenced anywhere in app/src must be named in the ledger
  // below with a real product reason -- "not migrated yet" is not a
  // product reason, it is a schedule, so ledger reasons may not cite a
  // wave or a branch (checked below). The ledger is asserted in BOTH
  // directions: an entry whose token IS now referenced is exactly as
  // wrong as a referenced-nowhere token missing from the ledger, so a
  // migration that lands must delete its ledger row in the same change.
  const UNREFERENCED_TOKENS_PENDING: { token: string; reason: string }[] = [
    {
      token: "--chq-type-body-size",
      reason:
        "Body copy (15-16px, README typography table) is spelled as a bare literal at dozens of paragraph/description sites across every page's CSS; migrating the role means touching every one of those sites, not this token's declaration.",
    },
    {
      token: "--chq-type-body-weight",
      reason:
        "Same body role as --chq-type-body-size: body text's 400 weight is implicit (the CSS default) at almost every call site rather than spelled, so there is no single rule to point the token at yet.",
    },
    {
      token: "--chq-type-micro-size",
      reason:
        "Micro labels (10-11px uppercase tags: status pills, badges, the 'no red' lateness/clash indicators) are a distinct literal at each component that draws one; no shared .chq-* class exists yet to hold this token's reference.",
    },
    {
      token: "--chq-type-micro-tracking",
      reason: "Same micro-label role as --chq-type-micro-size: no shared rule exists yet to carry the reference.",
    },
    {
      token: "--chq-type-micro-weight",
      reason: "Same micro-label role as --chq-type-micro-size: no shared rule exists yet to carry the reference.",
    },
  ];

  it("ledger reasons name a product reason, not a schedule", () => {
    for (const { token, reason } of UNREFERENCED_TOKENS_PENDING) {
      expect(reason, `${token}: ledger reason reads like a schedule`).not.toMatch(/task-w\d+-[a-z]/i);
      expect(reason.toLowerCase(), `${token}: ledger reason names a wave instead of a product reason`).not.toMatch(
        /\bwave\b/,
      );
    }
  });

  it("every declared --chq-type-* token is either referenced in app/src or carries a ledger entry -- never both, never neither", () => {
    const appFiles = glob(join(REPO_ROOT, "app/src"), [".css", ".ts", ".tsx"]);
    const referenced = new Set<string>();
    for (const file of appFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      for (const m of clean.matchAll(/var\((--chq-type-[a-z0-9-]+)/g)) {
        referenced.add(m[1]!);
      }
    }
    const ledgered = new Set(UNREFERENCED_TOKENS_PENDING.map((e) => e.token));

    // Direction 1: every declared token is referenced XOR ledgered.
    for (const token of DECLARED_TYPE_TOKENS) {
      const isReferenced = referenced.has(token);
      const isLedgered = ledgered.has(token);
      expect(
        isReferenced !== isLedgered,
        `${token}: referenced=${isReferenced}, ledgered=${isLedgered} -- must be exactly one of the two`,
      ).toBe(true);
    }

    // Direction 2: every ledger entry names a real declared token (no stale rows).
    for (const token of ledgered) {
      expect(DECLARED_TYPE_TOKENS.has(token), `${token}: ledgered but not declared in styles.css`).toBe(true);
    }
  });
});
