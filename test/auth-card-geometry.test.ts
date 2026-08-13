// DEC-945 amendment (task-w40-c): v6 measures for the auth surface family.
// A pure string scan of AUTH_CSS -- no browser, no DOM -- asserting:
//  (1) body { align-items: flex-start } so a card hugs its content instead
//      of stretching to full viewport height under justify-content: center.
//  (2) .chq-auth-card draws no border/border-radius (v6 draws no card
//      border on any 11-account frame).
//  (3) the two card max-widths are exactly 732px (.chq-auth-card) and the
//      full reading measure (.chq-auth-card.chq-auth-card-narrow). DEC-945
//      calls that second one "the full 820", and --chq-measure IS 820, so
//      it is spelt var(--chq-measure): DEC-989's wave-37 amendment forbids
//      hand-copied 800px+ clamps in src/**. Asserted here as the token,
//      plus a check that theme.ts still defines it as 820px -- so if the
//      reading measure ever moves, this test names the auth card as one of
//      the surfaces that moves with it.

import { describe, expect, it } from "vitest";
import { AUTH_CSS } from "../src/routes/auth.css";
import { THEME_CSS } from "../src/views/theme";

function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = css.match(re);
  expect(match, `expected to find rule for selector: ${selector}`).not.toBeNull();
  return match![1]!;
}

describe("auth card geometry (DEC-945 v6 amendment)", () => {
  it("body sets align-items: flex-start so cards hug their content", () => {
    const bodyRule = extractRule(AUTH_CSS, "body");
    expect(bodyRule).toMatch(/align-items:\s*flex-start/);
  });

  it(".chq-auth-card declares no border and no border-radius", () => {
    const cardRule = extractRule(AUTH_CSS, ".chq-auth-card");
    expect(cardRule).not.toMatch(/border\s*:/);
    expect(cardRule).not.toMatch(/border-radius\s*:/);
  });

  it("declares the two v6 max-widths: 732px and the reading measure", () => {
    expect(AUTH_CSS).toContain("max-width: 732px");

    // extractRule escapes its argument, so pass the selector verbatim.
    const narrowRule = extractRule(AUTH_CSS, ".chq-auth-card.chq-auth-card-narrow");
    expect(narrowRule).toMatch(/max-width:\s*var\(--chq-measure\)/);

    // DEC-989 (wave 37): no hand-copied 800px+ page clamp in src/**.
    expect(AUTH_CSS).not.toContain("max-width: 820px");
    expect(THEME_CSS).toMatch(/--chq-measure:\s*820px/);

    // stale v6-predecessor measures must be fully gone
    expect(AUTH_CSS).not.toContain("max-width: 640px");
    expect(AUTH_CSS).not.toContain("max-width: 520px");
    expect(AUTH_CSS).not.toContain("max-width: 450px");
  });

  it("keeps the phone (<=700px) block's border reset behaviourally unchanged", () => {
    const mediaIdx = AUTH_CSS.indexOf("@media (max-width: 700px)");
    expect(mediaIdx, "expected the 700px media block").toBeGreaterThan(-1);
    const phoneBlock = AUTH_CSS.slice(mediaIdx);
    expect(phoneBlock).toMatch(/border:\s*none/);
    expect(phoneBlock).toMatch(/border-radius:\s*0/);
  });

  it("drops the 36px title indent so back link and h1 share one x", () => {
    expect(AUTH_CSS).not.toMatch(/\.chq-auth-titlerow \.chq-auth-title\s*\{[^}]*margin-left/);
  });
});
