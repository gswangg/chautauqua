// DEC-253 wave-25 amendment: /portal/tasks measured 560px scrollWidth at
// 390x844 (docs/verification-log/task-w17-d-render-sweep.md:73-74), 170px of
// horizontal overflow off the phone-app-shell's own --chq-portal-measure
// token (560px, src/views/theme.ts:112) applied unconditionally by the
// unmediated .chq-portal-shell > .chq-measure rule (portal.css.ts:291-293).
// This is a source scan, mirroring portal-phone-shell.test.ts's and
// portal-desktop-measure.test.ts's idiom: no DOM/JSDOM layout engine in this
// repo, so overflow is verified by asserting the phone media block's
// declared constraints rather than a measured box.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(join(__dirname, "..", "src", "routes", "portal", "portal.css.ts"), "utf8");

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block
 * via balanced-brace scanning -- identical helper to portal-phone-shell.test.ts
 * and portal-desktop-measure.test.ts, so all three tests agree on what
 * "inside the 700px block" means. */
function extract700Blocks(src: string): string[] {
  const blocks: string[] = [];
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
    blocks.push(src.slice(openBrace + 1, i));
    searchFrom = i + 1;
  }
  return blocks;
}

/** Splits a block of CSS text into individual `selector { body }` rules,
 * expanding comma-separated grouped selectors into one entry per selector so
 * a lookup by a single class name finds a rule declared as part of a group. */
function parseRules(block: string): Array<{ selector: string; body: string }> {
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutComments))) {
    const body = m[2] ?? "";
    for (const rawSelector of (m[1] ?? "").split(",")) {
      const selector = rawSelector.trim();
      if (selector) rules.push({ selector, body });
    }
  }
  return rules;
}

describe("portal phone fit (DEC-253 wave-25 amendment)", () => {
  const blocks700 = extract700Blocks(CSS);
  const joined700 = blocks700.join("\n");

  it("has at least one @media (max-width: 700px) block", () => {
    expect(blocks700.length).toBeGreaterThan(0);
  });

  it("constrains .chq-portal-shell > .chq-measure's inline size inside the phone block", () => {
    const rules = parseRules(joined700).filter(
      (r) => r.selector === ".chq-portal-shell > .chq-measure",
    );
    expect(rules.length).toBeGreaterThan(0);
    const body = rules.map((r) => r.body).join("\n");
    // must cap the flex item's inline size to the viewport, and stop the
    // flex-item auto-minimum from re-establishing the desktop 560px measure
    expect(body).toMatch(/max-width:\s*100%/);
    expect(body).toMatch(/min-width:\s*0/);
  });

  it("does not move a single desktop pixel: the top-level (unmediated) rule keeps its DEC-989 560px clamp untouched", () => {
    const withoutMedia = CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, "");
    expect(withoutMedia).toMatch(
      /\.chq-portal-shell\s*>\s*\.chq-measure\s*\{\s*max-width:\s*var\(--chq-portal-measure\);\s*\}/,
    );
  });

  it("no rule inside the phone block declares a fixed width/min-width greater than 390px", () => {
    const rules = parseRules(joined700);
    for (const { selector, body } of rules) {
      const widthMatches = [...body.matchAll(/\b(?:width|min-width)\s*:\s*(\d+(?:\.\d+)?)px/g)];
      for (const wm of widthMatches) {
        const px = Number(wm[1]);
        expect(px, `${selector} declares ${wm[0]} inside the phone block`).toBeLessThanOrEqual(390);
      }
    }
  });

  it("gives the descendant containers that could impose an intrinsic 560px a min-width: 0 inside the phone block", () => {
    for (const selector of [".chq-portal-row", ".chq-portal-row-head", ".chq-portal-field", ".chq-field"]) {
      const rules = parseRules(joined700).filter((r) => r.selector === selector);
      expect(rules.length, `${selector} has no rule inside the phone block`).toBeGreaterThan(0);
      const body = rules.map((r) => r.body).join("\n");
      expect(body, `${selector} inside the phone block lacks min-width: 0`).toMatch(/min-width:\s*0/);
    }
  });

  it("a table/pre/code block gets its own scroll container, not the page (no bare overflow-x: hidden anywhere)", () => {
    expect(CSS).not.toMatch(/overflow-x:\s*hidden/);
    for (const selector of ["table", "pre"]) {
      const rules = parseRules(joined700).filter((r) => r.selector === selector);
      expect(rules.length, `${selector} has no rule inside the phone block`).toBeGreaterThan(0);
      const body = rules.map((r) => r.body).join("\n");
      expect(body).toMatch(/overflow-x:\s*auto/);
    }
  });
});
