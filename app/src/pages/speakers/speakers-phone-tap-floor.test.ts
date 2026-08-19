// DEC-393 wave-7 amendment (w7-h): flush row-action anchors on the v12
// speakers cluster (speakers.css) and the task-view page (task-view.css)
// evaded the 44px floor because padding alone moves the ink they draw. The
// fix puts all four floor declarations -- min-height:44px, display:flex,
// align-items:center, and an equal-and-opposite padding-inline/margin-inline
// pair -- on the anchor itself, inside a terminal max-width:700px block.
// This is a text scan, not a render test: it pins the CSS source directly so
// a future edit that quietly drops one of the four declarations, or widens
// the technique onto a container or a dense status cell, fails loudly.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert";

const SPEAKERS_CSS = readFileSync(join(__dirname, "speakers.css"), "utf8");
const TASK_VIEW_CSS = readFileSync(join(__dirname, "task-view.css"), "utf8");

// Extract the LAST `@media (max-width: 700px) { ... }` block in a stylesheet
// (matching nested braces one level deep, which is all these files use).
function lastPhoneBlock(css: string): string {
  const blocks: string[] = [];
  const re = /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const captured = m[1];
    assert(captured !== undefined);
    blocks.push(captured);
  }
  expect(blocks.length, "expected at least one phone block").toBeGreaterThan(0);
  const last = blocks[blocks.length - 1];
  assert(last !== undefined);
  return last;
}

const SPEAKERS_PHONE_BLOCK = lastPhoneBlock(SPEAKERS_CSS);
const TASK_VIEW_PHONE_BLOCK = lastPhoneBlock(TASK_VIEW_CSS);

// Pull the declaration body for a given selector out of a block of CSS text
// (selector must appear in a comma-separated selector list terminated by `{`,
// and the body runs to the next `}`).
function ruleBodyFor(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Selector must be its own comma-list entry: preceded by `{`, `,`, or start
  // of string (after whitespace), and followed by `,` or `{` (after whitespace).
  const re = new RegExp(
    `(?:^|[{,])\\s*${escaped}\\s*(?=[,{])[\\s\\S]*?\\{([^}]*)\\}`,
  );
  const m = css.match(re);
  expect(m, `expected to find a rule for ${selector} in the phone block`).not.toBeNull();
  const body = m?.[1];
  assert(body !== undefined);
  return body;
}

function expectFloorDeclarations(body: string, label: string) {
  expect(body, `${label}: min-height:44px`).toMatch(/min-height:\s*44px/);
  expect(body, `${label}: display:flex`).toMatch(/display:\s*flex/);
  expect(body, `${label}: align-items:center`).toMatch(/align-items:\s*center/);

  const paddingMatch = body.match(/padding-inline:\s*(-?\d+)px/);
  expect(paddingMatch, `${label}: padding-inline present`).not.toBeNull();
  const marginMatch = body.match(/margin-inline:\s*(-?\d+)px/);
  expect(marginMatch, `${label}: margin-inline present`).not.toBeNull();

  const padding = Number(paddingMatch![1]);
  const margin = Number(marginMatch![1]);
  expect(padding, `${label}: padding-inline is positive`).toBeGreaterThan(0);
  expect(margin, `${label}: margin-inline equal and opposite to padding-inline`).toBe(-padding);
}

const SPEAKERS_CSS_SELECTORS = [
  ".chq-speakers-name-link",
  ".chq-speaker-detail-back",
  ".chq-speakers-file-link",
  ".chq-speakers-task-title",
  ".chq-speakers-import-link",
  ".chq-speakers-head-actions a",
  ".chq-speakers-pager-actions a",
  ".chq-speaker-detail-actions a",
  ".chq-speaker-detail-logistics-actions a",
  ".chq-speakers-write-failure-actions a",
];

const TASK_VIEW_CSS_SELECTORS = [
  ".chq-taskview-back",
  ".chq-taskview-name",
  ".chq-taskview-actions a",
];

describe("speakers.css phone tap floor (DEC-393 wave-7 amendment)", () => {
  for (const selector of SPEAKERS_CSS_SELECTORS) {
    it(`${selector} carries all four floor declarations inside the terminal max-width:700px block`, () => {
      const body = ruleBodyFor(SPEAKERS_PHONE_BLOCK, selector);
      expectFloorDeclarations(body, selector);
    });
  }

  it("the phone rule lives inside a max-width: 700px media query, not the base rule", () => {
    // The base (desktop) .chq-speakers-name-link rule earlier in the file
    // must NOT already carry min-height -- the floor is phone-only, per
    // DEC-385 single-direction responsive.
    const baseRule = SPEAKERS_CSS.match(/\.chq-speakers-name-link \{([^}]*)\}/);
    expect(baseRule).not.toBeNull();
    expect(baseRule![1]).not.toMatch(/min-height/);
  });

  it("falsifiability control: the dense status-cell selectors carry NO min-height in the phone block (B8's dense/roomy pair must not be collapsed by this sweep)", () => {
    expect(SPEAKERS_PHONE_BLOCK).not.toMatch(/\.chq-speakers-status-dense/);
    expect(SPEAKERS_PHONE_BLOCK).not.toMatch(/\.chq-speakers-status-roomy/);
  });

  it("falsifiability control: .chq-pill is untouched by this sweep (styles.css already floors it globally)", () => {
    expect(SPEAKERS_PHONE_BLOCK).not.toMatch(/\.chq-pill\b/);
  });
});

describe("task-view.css phone tap floor (DEC-393 wave-7 amendment)", () => {
  for (const selector of TASK_VIEW_CSS_SELECTORS) {
    it(`${selector} carries all four floor declarations inside the terminal max-width:700px block`, () => {
      const body = ruleBodyFor(TASK_VIEW_PHONE_BLOCK, selector);
      expectFloorDeclarations(body, selector);
    });
  }

  it("the phone rule lives inside a max-width: 700px media query, not the base rule", () => {
    const baseRule = TASK_VIEW_CSS.match(/\.chq-taskview-back \{([^}]*)\}/);
    expect(baseRule).not.toBeNull();
    expect(baseRule![1]).not.toMatch(/min-height/);
  });
});
