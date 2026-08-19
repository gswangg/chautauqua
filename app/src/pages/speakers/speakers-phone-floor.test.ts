// v12m wave 8 (task w8-a), constrained by DEC-393 and DEC-989's wave-90
// amendments. This is a CSS-text scan over the two page-owned stylesheets
// (speakers.css, task-view.css), same technique as
// speakers-phone-tap-floor.test.ts: it pins source text directly so a
// future edit that quietly drops a declaration, or moves a fix out of the
// terminal block, fails loudly rather than being caught only by eyeballing
// a screenshot.
//
// Tap-floor offenders named by docs/design/audit/tap-floor-v12.md were
// already closed by the DEC-393 wave-7 amendment (both files' existing
// terminal @media block) before this wave started -- verified below rather
// than re-declared, so this file does not touch those selectors again.
// This wave's job is the DEC-989 overflow offenders: four `white-space:
// nowrap` fields with no phone escape, one fixed-width menu panel, and one
// desktop-only matrix whose min-width is confirmed unreachable at phone
// width because the frame re-lines it to cards.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert";

const SPEAKERS_CSS = readFileSync(join(__dirname, "speakers.css"), "utf8");
const TASK_VIEW_CSS = readFileSync(join(__dirname, "task-view.css"), "utf8");

// Every top-level (non-nested) construct in a stylesheet, in source order:
// either a `selector { ... }` rule or an `@media (...) { ... }` block,
// matched one brace-level deep (which is all these two files ever nest).
function topLevelConstructs(css: string): { kind: "rule" | "media"; text: string; start: number }[] {
  const re = /(@media[^{]*\{[\s\S]*?\n\}|[^{}\n][^{}]*\{[^{}]*\})/g;
  const out: { kind: "rule" | "media"; text: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const text = m[0];
    assert(text !== undefined);
    out.push({ kind: text.startsWith("@media") ? "media" : "rule", text, start: m.index });
  }
  return out;
}

// Extract the LAST `@media (max-width: 700px) { ... }` block (matching
// nested braces one level deep, which is all these files use).
function lastPhoneBlock(css: string): { body: string; end: number } {
  const blocks: { body: string; end: number }[] = [];
  const re = /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const captured = m[1];
    assert(captured !== undefined);
    blocks.push({ body: captured, end: m.index + m[0].length });
  }
  expect(blocks.length, "expected at least one phone block").toBeGreaterThan(0);
  const last = blocks[blocks.length - 1];
  assert(last !== undefined);
  return last;
}

// Strip `/* ... */` comments before selector matching -- several selectors
// this wave sit right after a documentation comment inside the terminal
// block, and comments must never count as the "preceded by { , or start"
// anchor a comma-list entry needs.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function ruleBodyFor(css: string, selector: string): string {
  const stripped = stripComments(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Selector must be its own comma-list entry: preceded by the start of a
  // new top-level construct (`{`, `,`, or a closed-off previous rule's `}`)
  // or the start of string, and followed by `,` or `{`.
  const re = new RegExp(
    `(?:^|[{,}])\\s*${escaped}\\s*(?=[,{])[\\s\\S]*?\\{([^}]*)\\}`,
  );
  const m = stripped.match(re);
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
  expect(Number(paddingMatch![1]), `${label}: padding-inline is positive`).toBeGreaterThan(0);
}

const SPEAKERS_PHONE_BLOCK = lastPhoneBlock(SPEAKERS_CSS).body;
const TASK_VIEW_PHONE_BLOCK = lastPhoneBlock(TASK_VIEW_CSS).body;

describe("speakers cluster: 44px floor already closed (DEC-393 wave-7 amendment, verified not re-broken)", () => {
  const FLOOR_SELECTORS = [
    ".chq-speaker-detail-actions a",
    ".chq-speaker-detail-back",
    ".chq-speaker-detail-logistics-actions a",
    ".chq-speakers-file-link",
    ".chq-speakers-head-actions a",
    ".chq-speakers-import-link",
    ".chq-speakers-name-link",
    ".chq-speakers-pager-actions a",
    ".chq-speakers-task-title",
    ".chq-speakers-write-failure-actions a",
  ];

  for (const selector of FLOOR_SELECTORS) {
    it(`${selector} carries the floor inside speakers.css's terminal phone block`, () => {
      expectFloorDeclarations(ruleBodyFor(SPEAKERS_PHONE_BLOCK, selector), selector);
    });
  }

  const TASKVIEW_FLOOR_SELECTORS = [".chq-taskview-actions a", ".chq-taskview-back", ".chq-taskview-name"];
  for (const selector of TASKVIEW_FLOOR_SELECTORS) {
    it(`${selector} carries the floor inside task-view.css's terminal phone block`, () => {
      expectFloorDeclarations(ruleBodyFor(TASK_VIEW_PHONE_BLOCK, selector), selector);
    });
  }

  it("falsifiability control: .chq-speakers-status-dense carries no min-height >= 44px anywhere in the file (B8 dense/roomy pair, never grown)", () => {
    const re = /\.chq-speakers-status-dense[^{]*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    let sawAny = false;
    while ((m = re.exec(SPEAKERS_CSS)) !== null) {
      sawAny = true;
      const body = m[1] ?? "";
      const heightMatch = body.match(/min-height:\s*(\d+)px/);
      if (heightMatch) {
        expect(Number(heightMatch[1]), "dense cell min-height must stay under 44px").toBeLessThan(44);
      }
    }
    expect(sawAny, "expected .chq-speakers-status-dense to appear at least once").toBe(true);
  });

  it("negative control: the extraction helpers actually fail on a selector missing the floor (proves the scan can fail, not just pass)", () => {
    const fabricatedBlock = `
  .chq-fabricated-offender {
    color: red;
  }
`;
    expect(() => {
      const body = ruleBodyFor(fabricatedBlock, ".chq-fabricated-offender");
      expectFloorDeclarations(body, ".chq-fabricated-offender");
    }).toThrow();
  });
});

describe("speakers cluster: 358px overflow offenders (DEC-989 wave-90 amendment)", () => {
  const ELLIPSIS_SELECTORS = [
    ".chq-speaker-detail-task-remind",
    ".chq-speaker-detail-tasks-row > :nth-child(2)",
    ".chq-speakers-task-edit",
    ".chq-speakers-task-remove",
  ];

  for (const selector of ELLIPSIS_SELECTORS) {
    it(`${selector} gets an ellipsis escape inside the terminal phone block`, () => {
      const body = ruleBodyFor(SPEAKERS_PHONE_BLOCK, selector);
      expect(body, `${selector}: overflow:hidden`).toMatch(/overflow:\s*hidden/);
      expect(body, `${selector}: text-overflow:ellipsis`).toMatch(/text-overflow:\s*ellipsis/);
      expect(body, `${selector}: min-width:0`).toMatch(/min-width:\s*0/);
    });

    it(`${selector}: the base (desktop) rule still declares white-space:nowrap unmodified (desktop frozen)`, () => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const baseOnly = SPEAKERS_CSS.slice(0, SPEAKERS_CSS.indexOf(SPEAKERS_PHONE_BLOCK));
      const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
      const m = baseOnly.match(re);
      expect(m, `expected a base rule for ${selector}`).not.toBeNull();
      expect(m![1]).toMatch(/white-space:\s*nowrap/);
    });
  }

  it(".chq-participation-menu-panel: width becomes 100% and min-width:0 inside the terminal phone block", () => {
    const body = ruleBodyFor(SPEAKERS_PHONE_BLOCK, ".chq-participation-menu-panel");
    expect(body).toMatch(/width:\s*100%/);
    expect(body).toMatch(/min-width:\s*0/);
  });

  it(".chq-participation-menu-panel: the base (desktop) rule still declares width:420px unmodified (desktop frozen)", () => {
    const baseOnly = SPEAKERS_CSS.slice(0, SPEAKERS_CSS.indexOf(SPEAKERS_PHONE_BLOCK));
    const m = baseOnly.match(/\.chq-participation-menu-panel\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/width:\s*420px/);
  });

  it(".chq-speakers-grid: min-width:1060px is exempted with a citation, never wrapped in a phone overflow rule, because .chq-speakers-grid-wrap is display:none under 700px", () => {
    expect(SPEAKERS_CSS).toMatch(/overflow-exempt:.*Chautauqua Speakers\.dc\.html:130/);
    // The grid's own wrapper is hidden at phone width -- verified directly
    // rather than assumed.
    const wrapPhoneBody = (() => {
      const re = /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(SPEAKERS_CSS)) !== null) {
        const body = m[1] ?? "";
        if (/\.chq-speakers-grid-wrap\s*\{[^}]*display:\s*none/.test(body)) {
          return body;
        }
      }
      return null;
    })();
    expect(wrapPhoneBody, "expected some phone block to set .chq-speakers-grid-wrap to display:none").not.toBeNull();
  });

  it("negative control: a fabricated fixed-width selector with no phone override is correctly detected as unfixed", () => {
    const fabricatedCss = `
.chq-fabricated-panel {
  width: 500px;
}
`;
    const fabricatedPhoneBlock = ""; // no phone override at all
    expect(() => ruleBodyFor(fabricatedPhoneBlock, ".chq-fabricated-panel")).toThrow();
    // sanity: the base rule itself is found fine, proving the failure above
    // is specific to the missing phone override, not a broken regex.
    const m = fabricatedCss.match(/\.chq-fabricated-panel\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
  });
});

describe("speakers.css: the terminal phone block is the LAST top-level construct in the file", () => {
  it("no top-level rule or @media block appears after the terminal max-width:700px block", () => {
    const constructs = topLevelConstructs(SPEAKERS_CSS);
    expect(constructs.length).toBeGreaterThan(0);
    const lastConstruct = constructs[constructs.length - 1];
    assert(lastConstruct !== undefined);
    expect(lastConstruct.kind, "the last top-level construct must be an @media block").toBe("media");
    expect(lastConstruct.text).toContain("max-width: 700px");
    expect(lastConstruct.text).toContain(".chq-participation-menu-panel");
    // The tail of the file, after the last construct, must be whitespace
    // only -- nothing was appended after our fix, and nothing was appended
    // in a second, later block.
    const tail = SPEAKERS_CSS.slice(lastConstruct.start + lastConstruct.text.length);
    expect(tail.trim(), "expected nothing but trailing whitespace after the terminal block").toBe("");
  });
});

describe("task-view.css: the terminal phone block is the LAST top-level construct in the file", () => {
  it("no top-level rule or @media block appears after the terminal max-width:700px block (unchanged this wave)", () => {
    const constructs = topLevelConstructs(TASK_VIEW_CSS);
    expect(constructs.length).toBeGreaterThan(0);
    const lastConstruct = constructs[constructs.length - 1];
    assert(lastConstruct !== undefined);
    expect(lastConstruct.kind).toBe("media");
    expect(lastConstruct.text).toContain("max-width: 700px");
    expect(lastConstruct.text).toContain(".chq-taskview-back");
    const tail = TASK_VIEW_CSS.slice(lastConstruct.start + lastConstruct.text.length);
    expect(tail.trim(), "expected nothing but trailing whitespace after the terminal block").toBe("");
  });
});
