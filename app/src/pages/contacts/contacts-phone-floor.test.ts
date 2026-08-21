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
import { stripCssComments } from "../../../../test/helpers/strip-css-comments";

const CONTACTS_CSS = readFileSync(join(__dirname, "contacts.css"), "utf8");
const PANELS_CSS = readFileSync(join(__dirname, "contacts-panels.css"), "utf8");

// Extract every top-level (not inside any @media block) rule, in source
// order, as { selector, body } pairs.
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, "");
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

// DEC-937 (task v12m-w12-q, supersedes the w10-n DRAIN): `.chq-contacts-
// title-actions a` resolves to exactly one control -- the Export CSV `<a
// className="chq-btn chq-btn-secondary">` (ContactsApp.tsx) -- PAINTED via
// .chq-btn (padding: 10px 16px) + .chq-btn-secondary (border + background).
// The cancelled-padding idiom narrows that face and bleeds the bordered box
// past its layout edge, so PAINTED_CANCELLED_PADDING_CEILING's fix removes
// `.chq-contacts-title-actions a` from the shared wave-90 cancelled-padding
// rule ENTIRELY (rather than the w10-n DRAIN's two-rule override shape) --
// it now gets its own single rule with no padding-inline/margin-inline
// cancellation at all, restating the face's own desktop `padding-inline:
// 16px` verbatim (not cancelled) so the anchor-floor scan still has a
// non-zero horizontal padding declaration to read.
// `.chq-contacts-rail-duplicate-actions a` (`.chq-link-button`, borderless)
// keeps the cancelled-padding idiom untouched. These assertions resolve the
// CASCADE (last-declared-value-wins for a given property, same selector,
// same specificity) across every rule in the terminal phone block.
describe("DEC-937 DRAIN (task w10-n): painted `.chq-contacts-title-actions a` de-cancelled, borderless rail link untouched", () => {
  function rulesForSelector(block: string, target: string): string[] {
    const clean = stripCssComments(block);
    const re = /([^{}]+)\{([^{}]*)\}/g;
    const bodies: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      const selectorList = (m[1] ?? "").split(",").map((s) => s.trim());
      if (selectorList.includes(target)) bodies.push(m[2] ?? "");
    }
    return bodies;
  }

  function cascadeValue(bodies: string[], prop: string): string | undefined {
    let value: string | undefined;
    const re = new RegExp(`${prop}\\s*:\\s*([^;]+);`);
    for (const body of bodies) {
      const m = body.match(re);
      if (m?.[1] !== undefined) value = m[1].trim();
    }
    return value;
  }

  it(".chq-contacts-title-actions a: exactly one rule declares it now (DEC-937: no longer combined with the wave-90 cancelled-padding rule)", () => {
    const bodies = rulesForSelector(CONTACTS_PHONE_BLOCK, ".chq-contacts-title-actions a");
    expect(bodies.length).toBe(1);
  });

  it(".chq-contacts-title-actions a: cascade-resolved min-height is 44px", () => {
    const bodies = rulesForSelector(CONTACTS_PHONE_BLOCK, ".chq-contacts-title-actions a");
    expect(cascadeValue(bodies, "min-height")).toBe("44px");
  });

  it(".chq-contacts-title-actions a: margin-inline is never declared (no cancelled-padding pair at all, not merely a non-negative override)", () => {
    const bodies = rulesForSelector(CONTACTS_PHONE_BLOCK, ".chq-contacts-title-actions a");
    expect(cascadeValue(bodies, "margin-inline")).toBeUndefined();
  });

  it(".chq-contacts-rail-duplicate-actions a (borderless) keeps its cascade-resolved margin-inline at -10px, untouched by the drain", () => {
    const bodies = rulesForSelector(CONTACTS_PHONE_BLOCK, ".chq-contacts-rail-duplicate-actions a");
    expect(cascadeValue(bodies, "margin-inline")).toBe("-10px");
  });

  it(".chq-contacts-title-actions: no phone gap override (Export CSV was its only cancelled-padding child; Import CSV / New contact are <button>s the wave-90 rule never selects)", () => {
    const bodies = rulesForSelector(CONTACTS_PHONE_BLOCK, ".chq-contacts-title-actions");
    expect(cascadeValue(bodies, "gap")).toBeUndefined();
  });

  it("falsifiability control: a synthetic single-rule selector with only the wave-90 shape is correctly read as still negative (the drain rule must exist to flip this)", () => {
    const badBlock = `
      .chq-x-fake a {
        min-height: 44px;
        padding-inline: 10px;
        margin-inline: -10px;
      }
    `;
    const bodies = rulesForSelector(badBlock, ".chq-x-fake a");
    expect(cascadeValue(bodies, "margin-inline")).toBe("-10px");
  });
});
