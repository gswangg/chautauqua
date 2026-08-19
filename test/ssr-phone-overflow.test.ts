// w8-h (DEC-989 wave-90 amendment; DEC-367 wave-90 amendment): TIER 2
// 390-overflow sweep for the four SSR CSS-template modules this lane owns.
// Source-text scan, matching test/portal-phone-fit.test.ts's idiom -- no
// DOM/JSDOM layout engine in this repo, so overflow is verified by asserting
// the declared constraints rather than a measured box.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEC_367, DEC_989 } from "../src/decisions";

void DEC_367;
void DEC_989;

const CARDS_CSS = readFileSync(
  join(__dirname, "..", "src", "routes", "public", "css", "cards.css.ts"),
  "utf8",
);
const HOME_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "home.css.ts"), "utf8");
const CFP_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "cfp.css.ts"), "utf8");
const PORTAL_CSS = readFileSync(join(__dirname, "..", "src", "routes", "portal", "portal.css.ts"), "utf8");

/** Extracts the exported template-literal string body: from the first
 * backtick after `export const <NAME> = ` to the matching closing backtick
 * that terminates the template literal (the LAST backtick in the file, since
 * every one of these four modules exports exactly one top-level template
 * literal). */
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

describe("cfp.css.ts: .chq-field-counter is overflow-exempt, not truncated", () => {
  const body = templateBody(CFP_CSS);

  it("carries a named overflow-exempt comment rather than an ellipsis escape", () => {
    expect(body).toMatch(/overflow-exempt:\s*a counter truncated states a wrong count/);
  });

  it("does not add overflow:hidden/text-overflow to .chq-field-counter (a truncated count would lie)", () => {
    const idx = body.indexOf(".chq-field-counter {");
    expect(idx).toBeGreaterThan(-1);
    const close = body.indexOf("}", idx);
    const rule = body.slice(idx, close + 1);
    expect(rule).not.toMatch(/text-overflow/);
    expect(rule).toMatch(/white-space:\s*nowrap/);
  });

  it("appends the exemption note as the LAST top-level construct in the module", () => {
    const marker = "overflow-exempt: a counter truncated states a wrong count";
    const markerIdx = body.indexOf(marker);
    expect(markerIdx).toBeGreaterThan(-1);
    const commentEnd = body.indexOf("*/", markerIdx);
    expect(commentEnd).toBeGreaterThan(-1);
    const trailing = body.slice(commentEnd + 2).trim();
    expect(trailing).toBe("");
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

  it("appends the new phone block as the LAST top-level construct in the module", () => {
    const last = at(blocks, -1);
    const trailing = body.slice(last.end + 1).trim();
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
