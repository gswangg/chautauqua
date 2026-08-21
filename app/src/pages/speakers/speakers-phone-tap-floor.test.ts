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
import { stripComments, parseAllRules } from "../../cancelled-padding-gap.scan.test";

// Does this rule's SELECTOR LIST name `className` as one of its (possibly
// compound) selector entries -- same boundary rule as
// speakers-phone-floor.test.ts's helper of the same name: matches a bare or
// compound occurrence, never a longer unrelated class name, and never a
// comment (comments are stripped before parseAllRules ever sees the text).
function ruleNamesClass(selector: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}(?![\\w-])`);
  return re.test(selector);
}

// Asserts no rule (comment-stripped, top-level within the given CSS text)
// whose selector list names `className` declares min-height -- used to
// scan the terminal phone block for a collapsed density pair.
function assertNoMinHeightForClass(cssBlock: string, className: string): void {
  const rules = parseAllRules(stripComments(cssBlock));
  for (const r of rules) {
    if (ruleNamesClass(r.selector, className)) {
      expect(
        r.body,
        `${className}: selector "${r.selector}" must not declare min-height inside the terminal phone block`,
      ).not.toMatch(/min-height:/);
    }
  }
}

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
  // Selector must be its own comma-list entry: preceded by `{`, `,`, `}`
  // (the previous rule's close -- DEC-385 wave-102 consolidated five
  // former blocks into one, so most selectors now follow a sibling rule's
  // closing brace rather than sitting first-after-`{` or mid comma-list),
  // or start of string (after whitespace), and followed by `,` or `{`
  // (after whitespace).
  const re = new RegExp(
    `(?:^|[{,}])\\s*${escaped}\\s*(?=[,{])[\\s\\S]*?\\{([^}]*)\\}`,
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

// w12-p correction: ".chq-speaker-detail-actions a" was removed from this
// list. It used to live in the shared cancelled-padding comma-group this
// loop checks (equal-and-opposite positive padding-inline / negative
// margin-inline), but DEC-937's painted-face treatment (task w10-m,
// completed by w12-p removing the now-stale group-membership) gives it its
// OWN rule instead, with NO cancelled margin -- checking it against
// `expectFloorDeclarations`'s equal-and-opposite assertion here would
// assert the wrong shape. It is already covered correctly by the
// "v12m-w10-m: painted anchors get the floor without cancelled padding"
// describe block below.
const SPEAKERS_CSS_SELECTORS = [
  ".chq-speakers-name-link",
  ".chq-speaker-detail-back",
  ".chq-speakers-file-link",
  ".chq-speakers-task-title",
  ".chq-speakers-import-link",
  ".chq-speakers-head-actions a",
  ".chq-speakers-pager-actions a",
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

  it("falsifiability control: no rule whose selector list names .chq-speakers-status-dense or -roomy declares min-height inside the terminal phone block (B8's dense/roomy pair must not be collapsed by this sweep)", () => {
    assertNoMinHeightForClass(SPEAKERS_PHONE_BLOCK, ".chq-speakers-status-dense");
    assertNoMinHeightForClass(SPEAKERS_PHONE_BLOCK, ".chq-speakers-status-roomy");
  });

  it("positive control: a fabricated phone block with a genuine .chq-speakers-status-dense min-height:44px rule IS flagged (proves the control still catches the real thing)", () => {
    const fabricatedBlock = `\n  .chq-speakers-status-dense {\n    min-height: 44px;\n  }\n`;
    expect(() => assertNoMinHeightForClass(fabricatedBlock, ".chq-speakers-status-dense")).toThrow();
  });

  it("negative control: a comment merely NAMING .chq-speakers-status-dense next to an unrelated min-height rule is NOT flagged", () => {
    const fabricatedBlock = `
  /* DEC-833 amendment: the participation trigger carrying the dense
     status-cell class (.chq-participation-menu-trigger.chq-speakers-status-dense)
     measures short at 390 -- fixed below, on the CONTAINER-SCOPED trigger
     selector, never on the dense class itself. */
  .chq-speaker-detail-sessions-row .chq-participation-menu-trigger {
    min-height: 44px;
  }
`;
    expect(() => assertNoMinHeightForClass(fabricatedBlock, ".chq-speakers-status-dense")).not.toThrow();
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

  it("floors .chq-taskview-actions .chq-btn (the real anchor -- .chq-taskview-actions a matches nothing) with no cancelled padding", () => {
    const matches = [...TASK_VIEW_PHONE_BLOCK.matchAll(/\.chq-taskview-actions \.chq-btn\s*\{([^}]*)\}/g)];
    expect(matches.length, "expected an appended .chq-taskview-actions .chq-btn rule").toBeGreaterThan(0);
    const body = matches[matches.length - 1]![1];
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*inline-flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).not.toMatch(/margin-inline:\s*-/);
    expect(body).not.toMatch(/padding-inline:/);
  });
});

// DEC-937 + DEC-393-amendment drain (task w10-m): the cancelled-padding shape
// (padding-inline positive / margin-inline equal-and-opposite negative) is
// safe only for a BORDERLESS anchor -- a painted one (a .chq-btn face) bleeds
// its drawn box past its container edge via the outward margin. These pins
// assert the LAST (i.e. winning, same-specificity/later-source) declaration
// body for each painted selector carries the 44px floor with NO cancelled
// padding, restoring the anchor's own inline padding instead.
describe("v12m-w10-m: painted anchors get the floor without cancelled padding", () => {
  function lastRuleBody(block: string, selectorPattern: RegExp): string {
    const matches = [...block.matchAll(selectorPattern)];
    expect(matches.length, `expected at least one match for ${selectorPattern}`).toBeGreaterThan(0);
    const body = matches[matches.length - 1]![1];
    assert(body !== undefined);
    return body;
  }

  it(".chq-speaker-detail-actions a (the Email <a class=\"chq-btn chq-btn-secondary\"> link) carries min-height:44px and no negative margin-inline", () => {
    const body = lastRuleBody(SPEAKERS_PHONE_BLOCK, /\.chq-speaker-detail-actions a\s*\{([^}]*)\}/g);
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).not.toMatch(/margin-inline:\s*-/);
  });

  it("falsifiability control: a synthetic block whose only rule keeps the cancelled margin fails the pin", () => {
    const badBlock = ".chq-speaker-detail-actions a { min-height: 44px; margin-inline: -10px; }";
    const matches = [...badBlock.matchAll(/\.chq-speaker-detail-actions a\s*\{([^}]*)\}/g)];
    const body = matches[matches.length - 1]![1];
    expect(body).toMatch(/margin-inline:\s*-/);
  });
});

// DEC-393 wave-120 three-receipt ruling (v12m-w9-j): .chq-taskview-open is
// the real row-action anchor (TaskView.tsx's file-download <a>, no chq-btn)
// in the shared .chq-taskview-tab/-open/-clear comma-list rule; the min-
// height-only rule the wave-7 sweep left behind now also carries centred
// flex and horizontal padding.
describe("v12m-w9-j: DEC-393 wave-120 tap-floor receipt (task-view.css)", () => {
  it(".chq-taskview-open (the real bare anchor) carries min-height + centred flex + horizontal padding in the terminal phone block", () => {
    const body = ruleBodyFor(TASK_VIEW_PHONE_BLOCK, ".chq-taskview-open");
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/padding-inline:\s*[1-9]/);
  });

  it("the shared rule's other two selectors (.chq-taskview-tab, .chq-taskview-clear) are real <button>s, never <a>/<Link>, in TaskView.tsx", () => {
    const src = readFileSync(join(__dirname, "TaskView.tsx"), "utf8");
    expect(src).toMatch(/<button[\s\S]{0,80}chq-taskview-tab/);
    expect(src).toMatch(/<button[\s\S]{0,80}chq-taskview-clear/);
    expect(src).not.toMatch(/<(a|Link)\b[^>]*chq-taskview-tab\b/);
    expect(src).not.toMatch(/<(a|Link)\b[^>]*chq-taskview-clear\b/);
  });
});
