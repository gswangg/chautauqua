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

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, "contacts.css");
const CSS_TEXT = readFileSync(CSS_PATH, "utf-8");

const REPO_ROOT = join(HERE, "..", "..", "..", "..");
const FRAME_PATH = join(REPO_ROOT, "docs", "design", "Chautauqua Contacts.dc.html");
const FRAME_TEXT = readFileSync(FRAME_PATH, "utf-8");
const FRAME_LINES = FRAME_TEXT.split("\n");

/** Blanks out /* ... *\/ comments in place, preserving length and newlines. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Finds every top-level (depth-0) `@media (max-width: 700px) { ... }`
 * block in the given CSS text via brace-matching over the comment-stripped
 * text, returning each block's [openIdx, closeIdx] byte range in the RAW
 * text (stripComments preserves length, so offsets transfer directly). */
function findTopLevelPhoneBlocks(rawText: string): Array<{ openIdx: number; closeIdx: number }> {
  const clean = stripComments(rawText);
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

const PHONE_BLOCKS = findTopLevelPhoneBlocks(CSS_TEXT);

describe("contacts.css: single terminal @media(max-width:700px) block, unmodified by this fix", () => {
  it("has exactly one top-level phone block", () => {
    expect(PHONE_BLOCKS.length).toBe(1);
  });

  it("that block is the file's last top-level construct (nothing but whitespace/comments follows its close brace)", () => {
    const block = PHONE_BLOCKS[0]!;
    const after = CSS_TEXT.slice(block.closeIdx + 1);
    const afterNoComments = stripComments(after);
    expect(afterNoComments.trim().length).toBe(0);
  });
});

describe("contacts.css: rule-chip dismiss control's appended width-floor fix", () => {
  const block = PHONE_BLOCKS[0]!;
  const blockText = CSS_TEXT.slice(block.openIdx, block.closeIdx + 1);

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
    const after = CSS_TEXT.slice(block.closeIdx + 1);
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
