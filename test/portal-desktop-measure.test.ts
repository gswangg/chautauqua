// DEC-989 amendment (ruling B6, wave 25 task w25-i): the speaker portal is a
// task list for one person, not a reading surface -- 390 is a device width,
// 820 (the shared --chq-measure reading column) is too wide for a
// single-column task list. A fourth named token, --chq-portal-measure
// (560px), clamps the portal's content column and footer instead, and the
// task-row action buttons right-flush above phone width.
//
// This test source-scans src/views/theme.ts and src/routes/portal/
// portal.css.ts rather than driving a real DOM/JSDOM layout, mirroring the
// existing portal-phone-shell.test.ts idiom in this repo.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const THEME = readFileSync(join(__dirname, "..", "src", "views", "theme.ts"), "utf8");
const PORTAL_CSS = readFileSync(
  join(__dirname, "..", "src", "routes", "portal", "portal.css.ts"),
  "utf8",
);

/** Extracts a top-level (not inside any @media block) rule's declaration
 * body by selector -- mirrors portal-phone-shell.test.ts's helper. */
function topLevelRuleBody(css: string, selector: string): string | undefined {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-boundary the tail so ".chq-portal-footer" never matches the
  // ".chq-portal-footer-band" rule that happens to share its prefix.
  const match = withoutMedia.match(new RegExp(`${escaped}(?![\\w-])\\s*\\{([^}]*)\\}`));
  return match?.[1];
}

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block
 * via balanced-brace scanning -- mirrors portal-phone-shell.test.ts's
 * helper exactly, so this test and that one can never disagree about what
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

describe("portal desktop measure (DEC-989 ruling B6)", () => {
  it("declares --chq-portal-measure: 560px alongside --chq-measure in theme.ts", () => {
    expect(THEME).toMatch(/--chq-portal-measure:\s*560px;/);
  });

  it("leaves --chq-measure at 820px -- shared reading measure is untouched", () => {
    expect(THEME).toMatch(/--chq-measure:\s*820px;/);
  });

  it("clamps the portal content column (.chq-portal-shell > .chq-measure) to the portal token, centred", () => {
    const body = topLevelRuleBody(PORTAL_CSS, ".chq-portal-shell > .chq-measure");
    expect(body, "top-level .chq-portal-shell > .chq-measure rule must exist outside any @media block").toBeDefined();
    expect(body).toMatch(/max-width:\s*var\(--chq-portal-measure\)/);
  });

  it("clamps the portal footer to the same portal token", () => {
    const body = topLevelRuleBody(PORTAL_CSS, ".chq-portal-footer");
    expect(body).toBeDefined();
    expect(body).toMatch(/max-width:\s*var\(--chq-portal-measure\)/);
    // centred: auto side margins alongside the clamp
    expect(body).toMatch(/margin:\s*24px auto 0/);
  });

  it("desktop action-button rule sits OUTSIDE (above) the 700px block", () => {
    const blocks700 = extract700Blocks(PORTAL_CSS).join("\n");
    expect(blocks700).not.toMatch(/justify-content:\s*flex-end/);

    const withoutMedia = PORTAL_CSS.replace(
      /@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g,
      "",
    );
    // The right-flush rule is itself scoped to its own min-width query, so
    // it is absent from the "no @media at all" text too -- assert instead
    // that it exists inside a min-width (not max-width) media block.
    expect(withoutMedia).not.toMatch(/justify-content:\s*flex-end/);

    const minWidthMatch = PORTAL_CSS.match(
      /@media \(min-width: 701px\) \{[^{}]*\.chq-portal-actions[^{}]*\{[^{}]*justify-content:\s*flex-end[^{}]*\}[^{}]*\}/,
    );
    expect(minWidthMatch, "expected a @media (min-width: 701px) block right-flushing .chq-portal-actions").not.toBeNull();
  });

  it("the min-width desktop block appears earlier in source than the max-width 700px block", () => {
    const minWidthIdx = PORTAL_CSS.indexOf("@media (min-width: 701px)");
    const maxWidthIdx = PORTAL_CSS.indexOf("@media (max-width: 700px)");
    expect(minWidthIdx).toBeGreaterThan(-1);
    expect(maxWidthIdx).toBeGreaterThan(-1);
    expect(minWidthIdx).toBeLessThan(maxWidthIdx);
  });

  it("does not modify the phone-only rules inside the existing 700px block", () => {
    const blocks = extract700Blocks(PORTAL_CSS);
    const joined = blocks.join("\n");
    // These are the pre-existing phone rules; they must still read exactly
    // as before this task (additive-reflow scan-lock).
    expect(joined).toMatch(/\.chq-portal-row-head\s*\{\s*align-items:\s*flex-start;\s*\}/);
    expect(joined).toMatch(/\.chq-portal-actions\s*\{\s*flex-direction:\s*column;\s*\}/);
    expect(joined).toMatch(/\.chq-portal-actions \.chq-btn\s*\{\s*width:\s*100%;\s*\}/);
  });
});
