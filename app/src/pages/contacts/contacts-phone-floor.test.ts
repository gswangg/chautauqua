// DEC-393 / DEC-989 wave-90 amendment (w8-d): closes the Contacts
// cluster's measured 44px-floor and 390-overflow offenders.
//
// Tap-floor: `.chq-contacts-drawer-actions`, `.chq-contacts-drawer-actions-right`
// (contacts.css) and `.chq-contacts-import-actions` (contacts-panels.css)
// were flagged by the row-action-anchor scan, but every child they render
// is a `.chq-btn`-classed <button>/<Link> -- never a bare anchor -- so
// there is nothing for the anchor-floor technique to reach; `.chq-btn`
// already carries the shared 44px phone floor in app/src/styles.css. The
// fix is a `tap-floor-exempt` comment naming that, the same idiom already
// used in app/src/pages/submissions/detail.css.
//
// Overflow (DEC-989 wave-90 amendment, 358px budget): four nowrap-with-
// no-escape selectors in contacts.css get `overflow:hidden;
// text-overflow:ellipsis; min-width:0` inside a terminal
// `@media (max-width: 700px)` block, appended at the true end of the
// file, never editing or reordering the blocks already there.
//
// This is a text scan, not a render test: it pins the CSS source directly
// so a future edit that quietly drops one of the three escape
// declarations, or re-shadows the terminal block with a later top-level
// rule, fails loudly.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert";

const CONTACTS_CSS = readFileSync(join(__dirname, "contacts.css"), "utf8");
const PANELS_CSS = readFileSync(join(__dirname, "contacts-panels.css"), "utf8");

// Extract every top-level (not inside any @media block) rule, in source
// order, as { selector, body } pairs.
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, "");
  const withoutComments = withoutMedia.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutComments)) !== null) {
    const selector = m[1];
    const body = m[2];
    assert(selector !== undefined && body !== undefined);
    out.push({ selector: selector.trim(), body });
  }
  return out;
}

// Extract the LAST `@media (max-width: 700px) { ... }` block in a
// stylesheet (matching nested braces one level deep, which is all these
// files use).
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

// Pull the declaration body for a given selector out of a block of CSS
// text (selector must appear in a comma-separated selector list
// terminated by `{`, and the body runs to the next `}`).
function ruleBodyFor(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Anchor on start-of-block, a preceding comma (same rule's selector
  // list) or a preceding `}` (the previous rule's own close) -- this file
  // appends each fixed selector as its own standalone rule, not one
  // shared comma list.
  const re = new RegExp(`(?:^|[{,}])\\s*${escaped}\\s*(?=[,{])[\\s\\S]*?\\{([^}]*)\\}`);
  const m = css.match(re);
  expect(m, `expected to find a rule for ${selector} in the phone block`).not.toBeNull();
  const body = m?.[1];
  assert(body !== undefined);
  return body;
}

function expectOverflowEscape(body: string, label: string) {
  expect(body, `${label}: overflow:hidden`).toMatch(/overflow:\s*hidden/);
  expect(body, `${label}: text-overflow:ellipsis`).toMatch(/text-overflow:\s*ellipsis/);
  expect(body, `${label}: min-width:0`).toMatch(/min-width:\s*0/);
}

const CONTACTS_PHONE_BLOCK = lastPhoneBlock(CONTACTS_CSS);

const OVERFLOW_SELECTORS = [
  ".chq-contacts-drawer-actions .chq-btn,\n  .chq-contacts-drawer-actions .chq-btn-tertiary",
  ".chq-contacts-filter-match-count",
  ".chq-contacts-filter-rules-cap",
  ".chq-contacts-filter-rules-caption",
];

describe("contacts.css / contacts-panels.css phone floor + overflow (DEC-393 / DEC-989 wave-90 amendment)", () => {
  describe("tap-floor: containers rendering only .chq-btn children are exempt, not force-fixed", () => {
    const exemptSelectors: Array<[string, string]> = [
      [CONTACTS_CSS, ".chq-contacts-drawer-actions"],
      [CONTACTS_CSS, ".chq-contacts-drawer-actions-right"],
      [PANELS_CSS, ".chq-contacts-import-actions"],
    ];

    for (const [css, selector] of exemptSelectors) {
      it(`${selector} carries a tap-floor-exempt comment immediately above its rule`, () => {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(
          `\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*${escaped}\\s*\\{`,
        );
        expect(css, `${selector}: exemption comment immediately above its rule`).toMatch(re);
      });
    }

    it("falsifiability control: a selector with no exemption comment is NOT matched by the same pattern", () => {
      const fabricated = `
.chq-fake-actions {
  display: flex;
}
`;
      const re = /\/\*\s*tap-floor-exempt:[^*]*\*\/\s*\.chq-fake-actions\s*\{/;
      expect(fabricated).not.toMatch(re);
    });
  });

  describe("overflow: nowrap-with-no-escape offenders get the phone-scoped escape", () => {
    for (const selector of OVERFLOW_SELECTORS) {
      it(`${selector.split(",")[0]}: carries the three-property escape inside the terminal max-width:700px block`, () => {
        const body = ruleBodyFor(CONTACTS_PHONE_BLOCK, selector);
        expectOverflowEscape(body, selector);
      });
    }

    it("the base (desktop) rules keep their unconditional white-space:nowrap, untouched", () => {
      const rules = topLevelRules(CONTACTS_CSS);
      const targets = [
        ".chq-contacts-filter-match-count",
        ".chq-contacts-filter-rules-cap",
        ".chq-contacts-filter-rules-caption",
      ];
      for (const target of targets) {
        const rule = rules.find((r) => r.selector === target);
        expect(rule, `expected a base top-level rule for ${target}`).toBeDefined();
        expect(rule!.body, `${target}: base rule keeps white-space:nowrap`).toMatch(
          /white-space:\s*nowrap/,
        );
        expect(rule!.body, `${target}: base rule carries no overflow escape`).not.toMatch(
          /overflow:\s*hidden/,
        );
      }
    });
  });

  describe("the appended block is the LAST top-level construct in the file", () => {
    it("contacts.css: no top-level rule for the overflow selectors follows the terminal phone block", () => {
      const idx = CONTACTS_CSS.lastIndexOf("@media (max-width: 700px)");
      expect(idx).toBeGreaterThan(-1);
      const after = CONTACTS_CSS.slice(idx);
      // Everything after the start of the terminal block must itself be
      // that one media block (plus trailing whitespace) -- nothing
      // top-level follows it.
      const closeIdx = after.indexOf("\n}\n");
      const tail = after.slice(closeIdx + 3).trim();
      expect(tail, "no content should follow the terminal @media block").toBe("");
    });

    it("falsifiability control: a fabricated stylesheet whose phone block is followed by a top-level rule for the same selector is caught by this technique", () => {
      const fabricated = `
.chq-fake-thing {
  white-space: nowrap;
}

@media (max-width: 700px) {
  .chq-fake-thing {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
}

.chq-fake-thing {
  opacity: 1;
}
`;
      const idx = fabricated.lastIndexOf("@media (max-width: 700px)");
      expect(idx).toBeGreaterThan(-1);
      const after = fabricated.slice(idx);
      const closeIdx = after.indexOf("\n}\n");
      const tail = after.slice(closeIdx + 3).trim();
      expect(tail).not.toBe("");
    });
  });
});
