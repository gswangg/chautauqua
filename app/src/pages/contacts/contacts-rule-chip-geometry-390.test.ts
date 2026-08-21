// v12m-w16-ui-r4-a (DEC-393 wave-16 r4 amendment,
// src/decisions-data/DEC-393.md): the Contacts 390 rule chip's two inner
// controls (`.chq-contacts-filter-rule-chip-edit`,
// `.chq-contacts-filter-rule-chip-dismiss`) violated BOTH the 44px width
// floor and the cancelled-padding companion-gap rider
// (docs/design/DEVIATIONS.md:591, "wherever such a family renders as
// ADJACENT SIBLINGS, the rule owning their separation adds the cancelled
// padding back"). The Contacts frame draws the chip container's own
// `gap:9px; padding:0 12px` (see the per-assertion citations below for the
// exact line reference); the two children faced each other across that
// 9px gap with
// opposing negative margins (`-edit`'s trailing `margin-inline: -4px` and
// `-dismiss`'s leading `margin-inline-start: -4px`), leaving 1px of real
// separation between two adjacent 44px-tall tap targets.
// app/src/cancelled-padding-gap.scan.test.ts cannot see this defect: its
// population is selector-derived (a comma-branch's container is its
// combinator-joined ancestor compound) and both rules use a single-compound
// selector on purpose, so neither ever enters that scan's population --
// the rider binds by rendered-tree ADJACENCY, not by selector shape.
//
// This is a CSS-TEXT scan, not a jsdom/computed-style test: jsdom performs
// no layout, so a computed-style assertion would pass regardless of what
// the stylesheet actually says. The fix is verified by parsing the raw CSS
// text of app/src/pages/contacts/contacts.css, mirroring
// app/src/pages/contacts/contacts-rule-chip-dismiss-floor.test.ts's shape.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// DEC-374/DEC-613: the ONE string-aware comment stripper. A private naive
// `/\*...\*/` regex has no notion of quoting, so a `/*` inside a CSS string
// literal silently eats real product text -- the delay fuse DEC-613 names.
import { stripCssComments } from "../../../../test/helpers/strip-css-comments";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, "contacts.css");
const CSS_TEXT = readFileSync(CSS_PATH, "utf-8");

const REPO_ROOT = join(HERE, "..", "..", "..", "..");
const FRAME_PATH = join(REPO_ROOT, "docs", "design", "Chautauqua Contacts.dc.html");
const FRAME_TEXT = readFileSync(FRAME_PATH, "utf-8");
const FRAME_LINES = FRAME_TEXT.split("\n");

/** The whole sheet, comments removed once by the shared string-aware helper.
 * Every offset below is an index into THIS text, never into the raw source
 * (the shared stripper preserves line numbers but not byte length). */
const CSS_STRIPPED = stripCssComments(CSS_TEXT);

/** Finds every top-level (depth-0) `@media (max-width: 700px) { ... }`
 * block via brace-matching, mirroring
 * contacts-rule-chip-dismiss-floor.test.ts's `findTopLevelPhoneBlocks`. */
function findTopLevelPhoneBlocks(clean: string): Array<{ openIdx: number; closeIdx: number }> {
  const blocks: Array<{ openIdx: number; closeIdx: number }> = [];
  let depth = 0;
  let headerStart = 0;
  const stackHeaderStarts: number[] = [];
  const stackOpenIdx: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === "{") {
      const header = clean.slice(headerStart, i).trim().replace(/\s+/g, " ");
      stackHeaderStarts.push(headerStart);
      stackOpenIdx.push(i);
      if (depth === 0 && header === "@media (max-width: 700px)") {
        // mark this as a candidate; we'll pair it on close
      }
      depth += 1;
      headerStart = i + 1;
    } else if (c === "}") {
      depth -= 1;
      const hStart = stackHeaderStarts.pop()!;
      const oIdx = stackOpenIdx.pop()!;
      if (depth === 0) {
        const header = clean.slice(hStart, oIdx).trim().replace(/\s+/g, " ");
        if (header === "@media (max-width: 700px)") {
          blocks.push({ openIdx: oIdx, closeIdx: i });
        }
      }
      headerStart = i + 1;
    }
  }
  return blocks;
}

const PHONE_BLOCKS = findTopLevelPhoneBlocks(CSS_STRIPPED);
const PHONE_BLOCK = PHONE_BLOCKS[0]!;
const PHONE_BODY = CSS_STRIPPED.slice(PHONE_BLOCK.openIdx, PHONE_BLOCK.closeIdx + 1);

/** Every `selector { body }` rule at this text's own top level (the phone
 * block body is already "one level in", so this finds the block's direct
 * rules -- there is no nested `@media` inside the terminal block). */
interface Rule {
  selector: string;
  body: string;
  start: number;
}
function parseRules(text: string): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const selector = (m[1] ?? "").trim();
    if (!selector) continue;
    out.push({ selector, body: m[2] ?? "", start: m.index });
  }
  return out;
}
const PHONE_RULES = parseRules(PHONE_BODY);

/** Last-wins effective value of `prop` across every rule in `rules` whose
 * selector matches `selector` exactly, in source order (later declarations
 * win, mirroring the cascade within one specificity/media tier). */
function effectiveValue(rules: Rule[], selector: string, prop: string): string | null {
  let value: string | null = null;
  const propRe = new RegExp(`(?:^|[;{])\\s*${prop}\\s*:\\s*([^;]+?)\\s*(?:;|$)`, "g");
  for (const rule of rules) {
    if (rule.selector !== selector) continue;
    let m: RegExpExecArray | null;
    propRe.lastIndex = 0;
    while ((m = propRe.exec(rule.body)) !== null) {
      value = (m[1] ?? "").trim();
    }
  }
  return value;
}

/** Resolves a shorthand-or-longhand inline-margin/padding side, honouring
 * last-wins between the shorthand (`margin-inline`/`padding-inline`, which
 * sets BOTH sides) and the longhand start/end forms, in true source order. */
function effectiveInlineSide(
  rules: Rule[],
  selector: string,
  shorthandProp: string,
  longhandProp: string,
): string | null {
  interface Hit {
    start: number;
    value: string;
  }
  const hits: Hit[] = [];
  const shorthandRe = new RegExp(`(?:^|[;{])\\s*${shorthandProp}\\s*:\\s*([^;]+?)\\s*(?:;|$)`, "g");
  const longhandRe = new RegExp(`(?:^|[;{])\\s*${longhandProp}\\s*:\\s*([^;]+?)\\s*(?:;|$)`, "g");
  for (const rule of rules) {
    if (rule.selector !== selector) continue;
    let m: RegExpExecArray | null;
    shorthandRe.lastIndex = 0;
    while ((m = shorthandRe.exec(rule.body)) !== null) {
      hits.push({ start: rule.start + m.index, value: (m[1] ?? "").trim() });
    }
    longhandRe.lastIndex = 0;
    while ((m = longhandRe.exec(rule.body)) !== null) {
      hits.push({ start: rule.start + m.index, value: (m[1] ?? "").trim() });
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.start - b.start);
  return hits[hits.length - 1]!.value;
}

describe("Contacts 390 rule chip: inner controls' facing sides carry no negative margin (docs/design/Chautauqua Contacts.dc.html:190 `gap:9px; padding:0 12px`)", () => {
  it("`.chq-contacts-filter-rule-chip-edit`'s FACING (trailing) side, margin-inline-end, resolves to 0", () => {
    const value = effectiveInlineSide(PHONE_RULES, ".chq-contacts-filter-rule-chip-edit", "margin-inline", "margin-inline-end");
    expect(value).not.toBeNull();
    expect(value).toBe("0");
  });

  it("`.chq-contacts-filter-rule-chip-dismiss`'s FACING (leading) side, margin-inline-start, resolves to 0", () => {
    const value = effectiveInlineSide(PHONE_RULES, ".chq-contacts-filter-rule-chip-dismiss", "margin-inline", "margin-inline-start");
    expect(value).not.toBeNull();
    expect(value).toBe("0");
  });
});

describe("Contacts 390 rule chip: effective separation meets the frame's drawn gap (docs/design/Chautauqua Contacts.dc.html:190 `gap:9px; padding:0 12px`)", () => {
  it("the chip's declared gap minus the two facing cancels is >= 9px (0 facing cancel on each side here, so the full declared gap holds)", () => {
    const gapValue = effectiveValue(PHONE_RULES, ".chq-contacts-filter-rule-chip", "gap");
    expect(gapValue).not.toBeNull();
    const gapPx = Number(/^([0-9.]+)px$/.exec(gapValue!)?.[1]);
    expect(Number.isFinite(gapPx)).toBe(true);

    const editEndMargin = effectiveInlineSide(PHONE_RULES, ".chq-contacts-filter-rule-chip-edit", "margin-inline", "margin-inline-end");
    const dismissStartMargin = effectiveInlineSide(PHONE_RULES, ".chq-contacts-filter-rule-chip-dismiss", "margin-inline", "margin-inline-start");
    const parseCancelPx = (v: string | null): number => {
      if (v === null) return 0;
      const m = /^-([0-9.]+)px$/.exec(v);
      return m ? Number(m[1]) : 0;
    };
    const facingCancelPx = parseCancelPx(editEndMargin) + parseCancelPx(dismissStartMargin);
    const effectiveSeparationPx = gapPx - facingCancelPx;

    expect(effectiveSeparationPx).toBeGreaterThanOrEqual(9);
  });
});

describe("Contacts 390 rule chip: both inner controls meet the 44px WIDTH floor (docs/design/DESIGN-RULINGS.md:189)", () => {
  it("`.chq-contacts-filter-rule-chip-edit` declares min-width: 44px", () => {
    const value = effectiveValue(PHONE_RULES, ".chq-contacts-filter-rule-chip-edit", "min-width");
    expect(value).toBe("44px");
  });

  it("`.chq-contacts-filter-rule-chip-dismiss` declares min-width: 44px", () => {
    const value = effectiveValue(PHONE_RULES, ".chq-contacts-filter-rule-chip-dismiss", "min-width");
    expect(value).toBe("44px");
  });
});

describe("Contacts 390 rule chip: the chip container's own gap is still the frame's 9px (docs/design/Chautauqua Contacts.dc.html:190 `gap:9px; padding:0 12px`)", () => {
  it("`.chq-contacts-filter-rule-chip` declares gap: 9px", () => {
    const value = effectiveValue(PHONE_RULES, ".chq-contacts-filter-rule-chip", "gap");
    expect(value).toBe("9px");
  });
});

describe("frame citation discipline: docs/design/Chautauqua Contacts.dc.html:190 quote is verbatim", () => {
  it("line 190 still contains the exact `gap:9px; padding:0 12px` span quoted throughout this file", () => {
    const line190 = FRAME_LINES[189]; // 0-indexed array, 1-indexed frame line numbers
    expect(line190).toBeDefined();
    expect(line190).toContain("gap:9px; padding:0 12px");
  });
});
