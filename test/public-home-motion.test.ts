// DEC-383 (wave-8 amendment, sha efb77e4a): the hub's action family
// (.chq-home-action-primary/-secondary/-quiet) gets the same B8 motion
// contract as the SSR button family and the SPA .chq-btn/input family --
// 120ms property-scoped transition (background-color/color/border-color,
// never `all`), with a `prefers-reduced-motion: reduce` override zeroing the
// same family in the same rule-block region.

import { describe, expect, it } from "vitest";
import { HOME_CSS } from "../src/routes/public/home.css";

const ACTION_CLASSES = [
  ".chq-home-action-primary",
  ".chq-home-action-secondary",
  ".chq-home-action-quiet",
];

describe("DEC-383 (wave 8): hub action family gets the B8 motion contract", () => {
  it("declares a property-scoped transition selector covering all three action classes", () => {
    // The three classes are grouped into one selector list ahead of a block
    // that declares `transition:`.
    const selectorList = ACTION_CLASSES.map((c) => c.replace(".", "\\.")).join(",\\s*");
    const re = new RegExp(`${selectorList}\\s*\\{([^}]*)\\}`);
    const m = re.exec(HOME_CSS);
    expect(m, "expected a combined transition rule for the action family").not.toBeNull();
    const block = m![1]!;
    expect(block).toMatch(/transition\s*:/);
  });

  it("names specific properties (background-color, color, border-color) rather than `all`", () => {
    const selectorList = ACTION_CLASSES.map((c) => c.replace(".", "\\.")).join(",\\s*");
    const re = new RegExp(`${selectorList}\\s*\\{([^}]*)\\}`);
    const block = re.exec(HOME_CSS)![1]!;
    expect(block).toMatch(/transition\s*:[^;]*background-color/);
    expect(block).toMatch(/border-color/);
    expect(block).toMatch(/color/);
    expect(block).not.toMatch(/transition\s*:\s*all\b/);
  });

  it("uses the B8 duration/easing tokens from theme.ts rather than a second literal", () => {
    expect(HOME_CSS).toMatch(/transition:[\s\S]*?var\(--chq-motion-color\)[\s\S]*?var\(--chq-ease-state\)/);
    // No bare "120ms" literal minted in this file -- the token is reused.
    expect(HOME_CSS).not.toMatch(/120ms/);
  });

  it("declares a reduced-motion override zeroing the same action family", () => {
    // Capture the @media block by matching balanced braces one level deep
    // (a nested selector block inside the media query), not by scanning to
    // the first bare `}` -- that would stop at the inner rule's close.
    const media = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?\n {2}\})/.exec(HOME_CSS);
    expect(media, "expected a prefers-reduced-motion block in HOME_CSS").not.toBeNull();
    const block = media![1]!;
    for (const cls of ACTION_CLASSES) {
      expect(block).toContain(cls);
    }
    expect(block).toMatch(/0ms/);
  });

  it("keeps the reduced-motion override in the same region as the transition rule (no separation)", () => {
    const transitionIndex = HOME_CSS.indexOf("transition:");
    const mediaIndex = HOME_CSS.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(transitionIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeGreaterThan(-1);
    // The reduced-motion block sits shortly after the transition declaration,
    // both anchored around the action family rather than scattered across
    // the sheet (e.g. inside the unrelated 700px breakpoint further down).
    expect(mediaIndex).toBeGreaterThan(transitionIndex);
    expect(mediaIndex - transitionIndex).toBeLessThan(2000);
  });

  it("leaves .chq-home-action-primary colour/geometry and the hover anchor selector untouched", () => {
    expect(HOME_CSS).toMatch(
      /a\.chq-home-action-primary:hover\s*\{\s*background:\s*var\(--chq-brand-hover\);\s*color:\s*var\(--chq-on-brand\);\s*\}/,
    );
    expect(HOME_CSS).toMatch(
      /\.chq-home-action-primary\s*\{\s*background:\s*var\(--chq-brand\);\s*color:\s*var\(--chq-on-brand\);\s*border-radius:\s*var\(--chq-r-ctl\);\s*min-height:\s*48px;/,
    );
  });
});
