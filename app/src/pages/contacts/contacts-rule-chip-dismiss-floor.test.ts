// v12m-w16-ui-r2-b (DEC-393/src/decisions-data/DEC-393.md,
// src/decisions-data/DEC-919.md): CONTACTS 390 -- the rule chip's `✕`
// dismiss control cleared the 44px floor's HEIGHT half
// (`min-height: 44px`) but not its WIDTH half. The earlier landed
// `.chq-contacts-filter-rule-chip-dismiss` rule gave only 4px of padding on
// each side of a bare `✕` glyph -- a ~17px-wide hit box. docs/design/
// DESIGN-RULINGS.md:189 rules horizontal padding is required in addition
// to min-height for the floor to be met.
//
// This is a CSS-TEXT scan, not a jsdom/computed-style test: jsdom performs
// no layout, so a computed-style assertion would pass regardless of what
// the stylesheet actually says. The fix is verified by parsing the raw CSS
// text of app/src/pages/contacts/contacts.css.

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
 * Every offset below is an index into THIS text, never into the raw source:
 * the shared stripper preserves line numbers but not byte length (it drops a
 * comment's characters, keeping only its newlines), so raw offsets would no
 * longer transfer the way the previous private length-preserving blanker let
 * them. Slicing the stripped text throughout is what keeps that honest. */
const CSS_STRIPPED = stripCssComments(CSS_TEXT);

/** Finds every top-level (depth-0) `@media (max-width: 700px) { ... }`
 * block via brace-matching, returning each block's [openIdx, closeIdx] byte
 * range in the ALREADY-STRIPPED text it is handed. */
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

describe("contacts.css: single terminal @media(max-width:700px) block, unmodified by this fix", () => {
  it("has exactly one top-level phone block", () => {
    expect(PHONE_BLOCKS.length).toBe(1);
  });

  it("that block is the file's last top-level construct (nothing but whitespace/comments follows its close brace)", () => {
    const block = PHONE_BLOCKS[0]!;
    const after = CSS_STRIPPED.slice(block.closeIdx + 1);
    expect(after.trim().length).toBe(0);
  });
});

describe("contacts.css: rule-chip dismiss control's appended width-floor fix", () => {
  const block = PHONE_BLOCKS[0]!;
  const blockText = CSS_STRIPPED.slice(block.openIdx, block.closeIdx + 1);

  // Locate every `.chq-contacts-filter-rule-chip-dismiss { ... }` rule
  // inside the phone block (there must be exactly two: the earlier landed
  // rule, and this task's appended rule).
  function findDismissRules(text: string): Array<{ start: number; end: number; body: string }> {
    const selectorRe = /\.chq-contacts-filter-rule-chip-dismiss\s*\{/g;
    const out: Array<{ start: number; end: number; body: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = selectorRe.exec(text))) {
      const openBraceIdx = m.index + m[0].length - 1;
      let depth = 1;
      let i = openBraceIdx + 1;
      while (i < text.length && depth > 0) {
        if (text[i] === "{") depth += 1;
        else if (text[i] === "}") depth -= 1;
        i += 1;
      }
      out.push({ start: m.index, end: i, body: text.slice(openBraceIdx + 1, i - 1) });
    }
    return out;
  }

  const dismissRules = findDismissRules(blockText);

  it("declares the selector exactly twice inside the phone block: the earlier rule and this task's appended rule", () => {
    expect(dismissRules.length).toBe(2);
  });

  it("no `chq-contacts-filter-rule-chip-dismiss` declaration appears anywhere after the phone block closes", () => {
    const after = CSS_STRIPPED.slice(block.closeIdx + 1);
    expect(after).not.toMatch(/chq-contacts-filter-rule-chip-dismiss/);
  });

  it("the appended rule is positioned AFTER the earlier landed rule in source order", () => {
    const [earlier, appended] = dismissRules;
    expect(earlier!.start).toBeLessThan(appended!.start);
  });

  it("the appended rule declares min-width: 44px (the width half of the 44px floor)", () => {
    const appended = dismissRules[1]!;
    expect(appended.body).toMatch(/min-width:\s*44px/);
  });

  it("the resolved trailing inset is frame-exact: the appended rule's padding-inline-end equals the chip's own padding-inline, both 12px, re-derived rather than hardcoded", () => {
    const appended = dismissRules[1]!;
    const paddingEndMatch = /padding-inline-end:\s*([0-9.]+px)/.exec(appended.body);
    expect(paddingEndMatch).not.toBeNull();
    const appendedPaddingEnd = paddingEndMatch![1];

    // Find the sibling `.chq-contacts-filter-rule-chip { ... }` rule (the
    // chip container, NOT `-dismiss`) in the same phone block, and read its
    // padding-inline.
    const chipSelectorRe = /(?<!-dismiss)\.chq-contacts-filter-rule-chip\s*\{/g;
    let chipMatch: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = chipSelectorRe.exec(blockText))) {
      chipMatch = m;
    }
    expect(chipMatch, "expected to find .chq-contacts-filter-rule-chip rule").not.toBeNull();
    const openBraceIdx = chipMatch!.index + chipMatch![0].length - 1;
    let depth = 1;
    let i = openBraceIdx + 1;
    while (i < blockText.length && depth > 0) {
      if (blockText[i] === "{") depth += 1;
      else if (blockText[i] === "}") depth -= 1;
      i += 1;
    }
    const chipBody = blockText.slice(openBraceIdx + 1, i - 1);
    const chipPaddingMatch = /padding-inline:\s*([0-9.]+px)/.exec(chipBody);
    expect(chipPaddingMatch).not.toBeNull();
    const chipPaddingInline = chipPaddingMatch![1];

    expect(appendedPaddingEnd).toBe("12px");
    expect(chipPaddingInline).toBe("12px");
    expect(appendedPaddingEnd).toBe(chipPaddingInline);
  });
});

describe("contacts.css: rule-chip edit control's 44px WIDTH floor survives the full cascade (task w5-cf)", () => {
  // Regression pin for DEC-393: an earlier `.chq-contacts-filter-rule-chip-edit`
  // rule declares `min-width: 44px` (the width half of the 44px floor), and a
  // LATER same-specificity rule in the same terminal phone block once
  // re-declared `min-width: 0`, silently winning the cascade and reopening the
  // floor. Asserting on ONE declaration in ONE block is exactly the shape of
  // check that let that regression through -- this walks EVERY top-level
  // `.chq-contacts-filter-rule-chip-edit { ... }` rule inside the terminal
  // phone block, in source order, and asserts on the CASCADE-FINAL resolved
  // `min-width`, not on any single rule in isolation.
  const block = PHONE_BLOCKS[0]!;
  const blockText = CSS_STRIPPED.slice(block.openIdx, block.closeIdx + 1);

  function findEditRules(text: string): Array<{ start: number; end: number; body: string }> {
    const selectorRe = /\.chq-contacts-filter-rule-chip-edit\s*\{/g;
    const out: Array<{ start: number; end: number; body: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = selectorRe.exec(text))) {
      const openBraceIdx = m.index + m[0].length - 1;
      let depth = 1;
      let i = openBraceIdx + 1;
      while (i < text.length && depth > 0) {
        if (text[i] === "{") depth += 1;
        else if (text[i] === "}") depth -= 1;
        i += 1;
      }
      out.push({ start: m.index, end: i, body: text.slice(openBraceIdx + 1, i - 1) });
    }
    return out;
  }

  const editRules = findEditRules(blockText);

  it("declares the selector at least twice inside the phone block (the floor rule and the sizing/overflow rule)", () => {
    expect(editRules.length).toBeGreaterThanOrEqual(2);
  });

  it("exactly one rule declares min-width, and it is 44px -- no later same-specificity rule re-opens it below the floor", () => {
    const minWidthDecls = editRules
      .map((r) => /min-width:\s*([^;]+);/.exec(r.body)?.[1]?.trim())
      .filter((v): v is string => v !== undefined);

    // The cascade-final value for a repeated property, same specificity, is
    // whichever declaration comes LAST in source order.
    expect(minWidthDecls.length).toBeGreaterThan(0);
    const cascadeFinal = minWidthDecls[minWidthDecls.length - 1];
    expect(cascadeFinal).toBe("44px");

    // And no declaration anywhere in the matching rules sets a value below
    // the 44px floor (covers any future third rule too, not just two).
    for (const decl of minWidthDecls) {
      const px = /^([0-9.]+)px$/.exec(decl);
      if (px) {
        expect(Number(px[1])).toBeGreaterThanOrEqual(44);
      } else {
        // A non-`Npx` value (e.g. `0` unitless) is never a legal floor value.
        expect(decl).not.toBe("0");
      }
    }
  });

  // DEC-393 "Amendment (wave 6)" supersedes this file's original wave-5/36
  // pin. That earlier ruling said the sizing/overflow rule should DELETE
  // `min-width` outright (letting the earlier :1578 rule own the floor
  // alone); the wave-6 amendment re-ruled that "the later rule takes
  // `min-width: 44px`" and named this very assertion as one of the two
  // "stale receipts [that] move to the newer shape while still proving the
  // same property". The property was never "the string `min-width` is
  // absent" -- it was "this rule does not cancel the 44px width floor",
  // which `min-width: 44px` satisfies just as surely as omitting it. So the
  // clause below pins the property, not the shape: if the sizing rule
  // declares min-width at all, it must be AT the floor. (The sibling
  // assertion above independently proves the cascade-final value is 44px
  // across every matching rule, so a regression to `min-width: 0` here is
  // caught twice over.) Reverting the CSS instead would only move the red:
  // contacts-rule-chip-label-bound-390.test.ts:61 pins this rule verbatim,
  // `min-width:\s*44px` included.
  it("the sizing/overflow rule still declares max-width: 46vw and never re-opens min-width below the 44px floor", () => {
    const sizingRule = editRules.find((r) => /max-width/.test(r.body));
    expect(sizingRule).toBeDefined();
    expect(sizingRule!.body).toMatch(/max-width:\s*46vw/);

    const minWidth = /min-width:\s*([^;]+);/.exec(sizingRule!.body)?.[1]?.trim();
    if (minWidth !== undefined) {
      expect(minWidth).toBe("44px");
    }
  });
});

describe("frame citation discipline: docs/design/Chautauqua Contacts.dc.html:190 quote is verbatim", () => {
  it("line 190 still contains the exact `gap:9px; padding:0 12px` span quoted in the appended rule's comment", () => {
    const line190 = FRAME_LINES[189]; // 0-indexed array, 1-indexed frame line numbers
    expect(line190).toBeDefined();
    expect(line190).toContain("gap:9px; padding:0 12px");
  });

  it("the appended fix comment in contacts.css contains that same verbatim quote", () => {
    expect(CSS_TEXT).toContain("docs/design/Chautauqua Contacts.dc.html:190 `gap:9px; padding:0\n     12px`");
  });
});
