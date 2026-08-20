// w8-h (DEC-989 wave-90 amendment; DEC-367 wave-90 amendment): TIER 2
// 390-overflow sweep for the four SSR CSS-template modules this lane owns.
// Source-text scan, matching test/portal-phone-fit.test.ts's idiom -- no
// DOM/JSDOM layout engine in this repo, so overflow is verified by asserting
// the declared constraints rather than a measured box.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEC_367, DEC_989 } from "../src/decisions";
import { PORTAL_CSS as PORTAL_CSS_COMPOSED } from "../src/routes/portal/portal.css";

void DEC_367;
void DEC_989;

const CARDS_CSS = readFileSync(
  join(__dirname, "..", "src", "routes", "public", "css", "cards.css.ts"),
  "utf8",
);
const HOME_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "home.css.ts"), "utf8");
const CFP_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "cfp.css.ts"), "utf8");
const PORTAL_CSS = readFileSync(join(__dirname, "..", "src", "routes", "portal", "portal.css.ts"), "utf8");
const RAIL_CSS = readFileSync(
  join(__dirname, "..", "src", "routes", "public", "css", "rail.css.ts"),
  "utf8",
);

/** Extracts the exported template-literal string body: from the first
 * backtick after `export const <NAME> = ` to the LAST backtick in the file.
 * DEC-385 wave-143 split cards.css.ts and rail.css.ts into a `<NAME>_CSS` +
 * `<NAME>_PHONE_CSS` pair, so those two files now hold two literals and this
 * span covers both -- which is what these assertions want, since the phone
 * half is still the tail of the same sheet and the intervening `export
 * const ...` text matches no selector any assertion here looks for. */
function templateBody(src: string): string {
  const firstBacktick = src.indexOf("`");
  const lastBacktick = src.lastIndexOf("`");
  expect(firstBacktick).toBeGreaterThan(-1);
  expect(lastBacktick).toBeGreaterThan(firstBacktick);
  return src.slice(firstBacktick + 1, lastBacktick);
}

/** Balanced-brace extraction of every `@media (max-width: 700px) { ... }`
 * block, identical helper to test/portal-phone-fit.test.ts. Returns the
 * blocks in source order plus each block's start/end offset within `src` so
 * callers can assert ordering (e.g. "this is the LAST block"). */
function extract700Blocks(src: string): { body: string; start: number; end: number }[] {
  const blocks: { body: string; start: number; end: number }[] = [];
  const marker = "@media (max-width: 700px)";
  let searchFrom = 0;
  for (;;) {
    const idx = src.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const openBrace = src.indexOf("{", idx);
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push({ body: src.slice(openBrace + 1, i), start: idx, end: i });
    searchFrom = i + 1;
  }
  return blocks;
}

/** Extracts every top-level `selector-list { ... }` rule inside a block body
 * that itself carries no nested `@media` (i.e. a phone block's own body).
 * Matching braces are tracked by depth so a rule containing no further `{`
 * (true for every rule in these sheets -- no nested at-rules inside a phone
 * block) resolves correctly; the selector list is split on top-level commas
 * so `.a, .b { ... }` is found under either `.a` or `.b`. */
function extractRules(src: string): { selectors: string[]; body: string }[] {
  const rules: { selectors: string[]; body: string }[] = [];
  let cursor = 0;
  for (;;) {
    const openBrace = src.indexOf("{", cursor);
    if (openBrace === -1) break;
    // Strip block comments from the selector text -- a rule's selector list
    // is frequently preceded by a /* ... */ comment with no comma between
    // the comment and the selector, so without this the "selector" the
    // split-on-comma below sees is "comment text\n    .the-real-selector"
    // rather than the bare class.
    const selectorText = src
      .slice(cursor, openBrace)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    rules.push({
      selectors: selectorText.split(",").map((s) => s.trim()),
      body: src.slice(openBrace + 1, i),
    });
    cursor = i + 1;
  }
  return rules;
}

/** Finds the LAST rule (source order) whose selector list contains `selector`
 * as an exact member, and returns its declaration body. Throws if none does
 * -- a selector this test targets must actually have a phone-scoped rule. */
function lastRuleFor(blockBody: string, selector: string): string {
  const rules = extractRules(blockBody).filter((r) => r.selectors.includes(selector));
  if (rules.length === 0) {
    throw new Error(`no phone-scoped rule with selector ${selector} found`);
  }
  return at(rules, -1).body;
}

/** Fail-loud accessor -- an out-of-range index is a broken test fixture,
 * not a case to silently coerce to undefined (Fail Loudly Principle). */
function at<T>(arr: T[], index: number): T {
  const value = arr.at(index);
  if (value === undefined) {
    throw new Error(`expected an element at index ${index} of a ${arr.length}-length array`);
  }
  return value;
}

describe("cards.css.ts: .chq-pub-speaker-list-row re-lines at phone width", () => {
  const body = templateBody(CARDS_CSS);
  const blocks = extract700Blocks(body);

  it("has an appended phone block re-lining the fixed 356px/two-gap track set", () => {
    const last = at(blocks, -1);
    expect(last.body).toMatch(
      /\.chq-pub-speaker-list-row\s*\{[^}]*grid-template-columns:\s*76px 1fr\s*;/,
    );
    // 76px + 1fr + one 20px gap comfortably clears the 358px budget with
    // room for content -- the old 76px+1fr+280px+2*20px totalled 396px.
  });

  it("moves the sessions column to its own full-width row instead of removing it (DEC-919)", () => {
    const last = at(blocks, -1);
    expect(last.body).toMatch(
      /\.chq-pub-speaker-list-row \.chq-pub-speaker-sessions\s*\{[^}]*grid-column:\s*1 \/ -1\s*;/,
    );
  });

  it("appends the phone block as the LAST top-level construct in the module", () => {
    const last = at(blocks, -1);
    const trailing = body.slice(last.end + 1).trim();
    expect(trailing).toBe("");
  });
});

describe("home.css.ts: .chq-home-footer-link gets a three-property overflow escape", () => {
  const body = templateBody(HOME_CSS);
  const blocks = extract700Blocks(body);

  // Unlike the other three modules, HOME_CSS is pinned by
  // test/public-home-phone.test.ts to declare exactly ONE
  // @media (max-width: 700px) block -- so the w8-h escape is appended as
  // the LAST rule inside that single existing block, not as a second
  // sibling block, and the pre-existing tagline rule stays untouched ahead
  // of it (append-only within the block, nothing reordered).
  it("declares exactly one phone block, and the escape lives inside it", () => {
    expect(blocks.length).toBe(1);
    const only = at(blocks, 0);
    expect(only.body).toMatch(/\.chq-home-footer-link\s*\{[^}]*overflow:\s*hidden\s*;/);
    expect(only.body).toMatch(/\.chq-home-footer-link\s*\{[^}]*text-overflow:\s*ellipsis\s*;/);
    expect(only.body).toMatch(/\.chq-home-footer-link\s*\{[^}]*min-width:\s*0\s*;/);
  });

  it("appended after the pre-existing tagline rule, not before it (append-only, never reordered)", () => {
    const only = at(blocks, 0);
    const taglineIdx = only.body.indexOf(".chq-home-footer-tagline {");
    const escapeIdx = only.body.indexOf(".chq-home-footer-link {");
    expect(taglineIdx).toBeGreaterThan(-1);
    expect(escapeIdx).toBeGreaterThan(-1);
    expect(escapeIdx).toBeGreaterThan(taglineIdx);
  });

  it("the phone block (carrying the appended escape) is the LAST top-level construct in the module", () => {
    const only = at(blocks, 0);
    const trailing = body.slice(only.end + 1).trim();
    expect(trailing).toBe("");
  });
});

describe("home.css.ts: the four .chq-home-action-* nowrap offenders escape (w8-e, DEC-989/DEC-385)", () => {
  // DEC-989(b): fixed-word attendee controls get the ellipsis escape, not a
  // re-wrap -- .chq-home-action-primary/-secondary/-quiet/-tertiary each
  // already carried a phone-scoped rule (HOME_CSS is pinned to exactly one
  // @media (max-width: 700px) block by test/public-home-phone.test.ts), so
  // the fix is appended inside that SAME existing rule for each selector,
  // never a new block, desktop untouched.
  const body = templateBody(HOME_CSS);
  const blocks = extract700Blocks(body);

  it("declares exactly one phone block", () => {
    expect(blocks.length).toBe(1);
  });

  it.each([
    ".chq-home-action-primary",
    ".chq-home-action-secondary",
    ".chq-home-action-quiet",
    ".chq-home-action-tertiary",
  ])("%s's phone rule gets overflow:hidden + text-overflow:ellipsis", (selector) => {
    const only = at(blocks, 0);
    const rule = lastRuleFor(only.body, selector);
    expect(rule).toMatch(/overflow:\s*hidden\s*;/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis\s*;/);
  });

  it("the phone block is still the LAST top-level construct in the module (nothing reordered)", () => {
    const only = at(blocks, 0);
    const trailing = body.slice(only.end + 1).trim();
    expect(trailing).toBe("");
  });
});

describe("rail.css.ts: .chq-pub-save/.chq-pub-schedule-remove/.chq-pub-lastyear-link escape (w8-e)", () => {
  // Same DEC-989(b)/DEC-385 shape as the home.css.ts block above, applied to
  // rail.css.ts's own single terminal @media (max-width: 700px) block
  // (phone-terminal-block.scan.test.ts pins exactly one there too).
  const body = templateBody(RAIL_CSS);
  const blocks = extract700Blocks(body);

  it("declares exactly one phone block", () => {
    expect(blocks.length).toBe(1);
  });

  it.each([".chq-pub-save", ".chq-pub-schedule-remove", ".chq-pub-lastyear-link"])(
    "%s's phone rule gets overflow:hidden + text-overflow:ellipsis",
    (selector) => {
      const last = at(blocks, -1);
      const rule = lastRuleFor(last.body, selector);
      expect(rule).toMatch(/overflow:\s*hidden\s*;/);
      expect(rule).toMatch(/text-overflow:\s*ellipsis\s*;/);
    },
  );

  it("the phone block is still the LAST top-level construct in the module (nothing reordered)", () => {
    const last = at(blocks, -1);
    const trailing = body.slice(last.end + 1).trim();
    expect(trailing).toBe("");
  });
});

describe("cfp.css.ts: .chq-field-counter escapes with ellipsis (DEC-989 wave-111 amendment)", () => {
  // w7-f (DEC-989 wave-111 amendment): the wave-90 exemption comment this
  // block used to pin never actually sat directly above the
  // .chq-field-counter rule it described (it was appended at the true end
  // of the module, after the rule it meant to exempt), so
  // phone-horizontal-overflow.scan.test.ts's EXEMPT_COMMENT_RE -- which
  // requires the marker directly precede the rule's `{` -- never honoured
  // it and the rule stayed a live, uncounted-as-exempt offender under the
  // OVERFLOW_OFFENDERS_CEILING ratchet. Fixed per the scan's own repair
  // shape instead: white-space: nowrap kept (no mid-phrase wrap), plus
  // overflow: hidden; text-overflow: ellipsis added in the same rule. This
  // block now pins that shape rather than the old (never-functional)
  // exemption. portal.css.ts's own .chq-field-counter is a different sheet
  // owned by a different lane and keeps its wave-90 exemption unchanged --
  // see the next describe block.
  const body = templateBody(CFP_CSS);

  it("does not carry the superseded wave-90 exemption comment", () => {
    expect(body).not.toMatch(/overflow-exempt:\s*a counter truncated states a wrong count/);
  });

  it("adds overflow:hidden/text-overflow/min-width:0 to .chq-field-counter alongside white-space:nowrap", () => {
    const idx = body.indexOf(".chq-field-counter {");
    expect(idx).toBeGreaterThan(-1);
    const close = body.indexOf("}", idx);
    const rule = body.slice(idx, close + 1);
    expect(rule).toMatch(/white-space:\s*nowrap/);
    expect(rule).toMatch(/overflow:\s*hidden/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).toMatch(/min-width:\s*0/);
  });
});

describe("portal.css.ts: .chq-portal-done-when escapes, .chq-field-counter is exempt", () => {
  const body = templateBody(PORTAL_CSS);
  const blocks = extract700Blocks(body);

  it("has an appended phone block with the three-property escape on .chq-portal-done-when", () => {
    const last = at(blocks, -1);
    expect(last.body).toMatch(/\.chq-portal-done-when\s*\{[^}]*overflow:\s*hidden\s*;/);
    expect(last.body).toMatch(/\.chq-portal-done-when\s*\{[^}]*text-overflow:\s*ellipsis\s*;/);
    expect(last.body).toMatch(/\.chq-portal-done-when\s*\{[^}]*min-width:\s*0\s*;/);
  });

  it("carries the same named overflow-exempt comment for .chq-field-counter", () => {
    expect(body).toMatch(/overflow-exempt,\s+same\s+rationale as src\/routes\/public\/cfp\.css\.ts/);
  });

  it("does not add overflow:hidden/text-overflow to .chq-field-counter", () => {
    const idx = body.indexOf(".chq-field-counter {");
    expect(idx).toBeGreaterThan(-1);
    const close = body.indexOf("}", idx);
    const rule = body.slice(idx, close + 1);
    expect(rule).not.toMatch(/text-overflow/);
  });

  // DEC-385 wave-143 amendment (task w18-f): this pin used to slice the raw
  // FILE text's trailing bytes, which broke the moment portal.css.ts
  // started composing ERROR_STATES_PHONE_CSS at its tail (w16-bb) -- the
  // raw text after this sheet's own last `{...}` block is the literal,
  // unresolved "${ERROR_STATES_PHONE_CSS}" interpolation placeholder, not
  // whitespace, even though the RUNTIME/composed PORTAL_CSS string is
  // fully conformant (ERROR_STATES_PHONE_CSS is itself a phone block,
  // composed immediately after this sheet's own terminal block -- see
  // test/phone-terminal-block.scan.test.ts's composed-output grading).
  // Re-pointed at the composed-export invariant instead of the file's
  // trailing bytes, per this task: the emitted PORTAL_CSS runtime string
  // has exactly one contiguous trailing phone region, i.e. nothing but
  // whitespace/comments follows its LAST @media (max-width: 700px) block.
  it("the composed PORTAL_CSS runtime export has exactly one contiguous trailing phone region (nothing but whitespace/comments after the last phone block)", () => {
    const composedBlocks = extract700Blocks(PORTAL_CSS_COMPOSED);
    expect(composedBlocks.length).toBeGreaterThan(0);
    const last = at(composedBlocks, -1);
    const trailing = PORTAL_CSS_COMPOSED.slice(last.end + 1).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    expect(trailing).toBe("");
  });
});

describe("DEC-367 wave-90 receipt: portal.css.ts's shadowed pairs resolve >= 44px at phone width", () => {
  // Falsifiability control (half 1): the two selectors DEC-367's wave-90
  // amendment names as shadowed -- a base-scope declaration (applies at
  // every width) later re-declared inside the phone @media block, equal
  // specificity, later-in-source wins per normal cascade rules. This
  // executable check reads BOTH declarations and computes the resolved
  // phone-width value, so if a future edit lowers either side below the
  // DEC-367 floor, this test fails instead of the claim aging into a lie.
  const SHADOWED_SELECTORS = [".chq-portal-actions .chq-btn", ".chq-portal-copresenter-submit .chq-btn"];

  function findMinHeightPx(ruleBody: string): number {
    const m = ruleBody.match(/min-height:\s*(\d+)px/);
    expect(m).not.toBeNull();
    return Number(m![1]);
  }

  function firstTopLevelRule(src: string, selector: string): string {
    // The FIRST occurrence outside any @media block -- i.e. before the
    // first "@media" marker in source order, since both shadowed selectors'
    // base declarations sit above every phone block in this module.
    const firstMedia = src.indexOf("@media");
    const idx = src.indexOf(`${selector} {`);
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(firstMedia === -1 ? src.length : firstMedia);
    const close = src.indexOf("}", idx);
    return src.slice(idx, close + 1);
  }

  function lastRuleInBlocks(blocks: { body: string }[], selector: string): string {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = at(blocks, i);
      const idx = block.body.indexOf(`${selector} {`);
      if (idx !== -1) {
        const close = block.body.indexOf("}", idx);
        return block.body.slice(idx, close + 1);
      }
    }
    throw new Error(`no phone-scoped rule found for ${selector}`);
  }

  const body = templateBody(PORTAL_CSS);
  const blocks = extract700Blocks(body);

  it.each(SHADOWED_SELECTORS)(
    "%s: the base rule is a real desktop value ABOVE the phone override (a genuine shadow, not a stub)",
    (selector) => {
      const base = findMinHeightPx(firstTopLevelRule(body, selector));
      const phone = findMinHeightPx(lastRuleInBlocks(blocks, selector));
      expect(base).toBeGreaterThan(phone);
    },
  );

  it.each(SHADOWED_SELECTORS)(
    "%s: the RESOLVED phone-width value (the later, winning declaration) is >= the DEC-367 44px floor",
    (selector) => {
      // The later declaration in source order is the one the cascade
      // actually applies at <=700px for equal-specificity selectors -- so
      // the phone-block value IS the resolved value here, not the base one.
      const resolved = findMinHeightPx(lastRuleInBlocks(blocks, selector));
      expect(resolved).toBeGreaterThanOrEqual(44);
    },
  );

  // Falsifiability control (half 2): prove this test can actually fail --
  // a synthetic pair where the later declaration drops BELOW the floor
  // must be caught by the same assertion shape used above.
  it("the assertion shape catches a synthetic below-floor shadow (falsifiability control)", () => {
    const synthetic = `
      .chq-fake-btn { min-height: 46px; }
      @media (max-width: 700px) {
        .chq-fake-btn { min-height: 40px; }
      }
    `;
    const syntheticBlocks = extract700Blocks(synthetic);
    const resolved = findMinHeightPx(lastRuleInBlocks(syntheticBlocks, ".chq-fake-btn"));
    expect(resolved).toBeLessThan(44);
  });
});
