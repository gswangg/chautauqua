// DEC-945 amendment (task-w40-c): v6 measures for the auth surface family.
// A pure string scan of AUTH_CSS -- no browser, no DOM -- asserting:
//  (1) body { align-items: flex-start } so a card hugs its content instead
//      of stretching to full viewport height under justify-content: center.
//  (2) .chq-auth-card draws no border/border-radius (v6 draws no card
//      border on any 11-account frame).
//  (3) the two card BOX max-widths are 820px (.chq-auth-card) and 888px
//      (.chq-auth-card.chq-auth-card-narrow) -- DEC-945's wave-1 amendment:
//      the box is content column + 2x padding, so the CONTENT lands on 732
//      / 818, not the box width itself. --chq-measure (820, theme.ts) is
//      still asserted here so a future reading-measure move is caught, even
//      though the auth card boxes are no longer spelt with the token.
//  (4) the 404/notice block's title->body and body->links rhythm is stated
//      directly (19px / 26px) rather than inheriting the login form's
//      uniform 26px card gap, with the UA <p> margin zeroed.

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

  // DEC-945 wave-1 amendment: the box is the CONTENT column + 2x padding,
  // not the column value applied straight to the box -- so the plain card
  // is 820px (732 + 2*44) and the narrow variant is 888px (818 + 2*35),
  // both literal (neither box IS the --chq-measure reading column itself,
  // so DEC-989 wave-37's "no hand-copied 800px+ clamp" token rule does not
  // apply to a box whose own width is not the column).
  it("declares the two v6 box max-widths: 820px and 888px", () => {
    expect(AUTH_CSS).toContain("max-width: 820px");

    // extractRule escapes its argument, so pass the selector verbatim.
    const narrowRule = extractRule(AUTH_CSS, ".chq-auth-card.chq-auth-card-narrow");
    expect(narrowRule).toMatch(/max-width:\s*888px/);

    expect(THEME_CSS).toMatch(/--chq-measure:\s*820px/);

    // stale v6-predecessor measures must be fully gone
    expect(AUTH_CSS).not.toContain("max-width: 640px");
    expect(AUTH_CSS).not.toContain("max-width: 520px");
    expect(AUTH_CSS).not.toContain("max-width: 450px");
    expect(AUTH_CSS).not.toContain("max-width: 732px");
  });

  // DEC-945 wave-1 amendment: the box is stated as CONTENT column + 2x
  // padding, never the column value applied directly to the box (which
  // pulls every left edge inboard by the padding amount). Content column =
  // box max-width - 2 * the card's own horizontal padding.
  it("states the box as content column + 2x padding, landing content on 732/818", () => {
    const cardRule = extractRule(AUTH_CSS, ".chq-auth-card");
    const cardMaxWidth = Number(cardRule.match(/max-width:\s*(\d+)px/)?.[1]);
    const cardPadding = Number(cardRule.match(/padding:\s*(\d+)px/)?.[1]);
    expect(cardMaxWidth).toBe(820);
    expect(cardPadding).toBe(44);
    expect(cardMaxWidth - 2 * cardPadding).toBe(732);

    const narrowRule = extractRule(AUTH_CSS, ".chq-auth-card.chq-auth-card-narrow");
    const narrowMaxWidth = Number(narrowRule.match(/max-width:\s*(\d+)px/)?.[1]);
    const narrowPadding = Number(narrowRule.match(/padding:\s*(\d+)px/)?.[1]);
    expect(narrowMaxWidth).toBe(888);
    expect(narrowPadding).toBe(35);
    expect(narrowMaxWidth - 2 * narrowPadding).toBe(818);
  });

  // DEC-945 wave-1 amendment: the 404/notice block's rhythm is tighter than
  // the login form's uniform 26px card gap -- .chq-auth-card-notice turns
  // the card's own gap off and states the title->body and body->links
  // spacing directly, with the UA <p> margin zeroed so it never stacks on
  // top of either.
  it("the notice card (404) states its own tighter title/body/links rhythm", () => {
    const noticeCardRule = extractRule(AUTH_CSS, ".chq-auth-card.chq-auth-card-notice");
    expect(noticeCardRule).toMatch(/gap:\s*0/);

    const bodyRule = extractRule(AUTH_CSS, ".chq-auth-body");
    expect(bodyRule).toMatch(/margin:\s*0/);

    const titlerowGapRule = extractRule(AUTH_CSS, ".chq-auth-card-notice .chq-auth-titlerow");
    expect(titlerowGapRule).toMatch(/margin-bottom:\s*19px/);

    const noticeBodyRule = extractRule(AUTH_CSS, ".chq-auth-card-notice .chq-auth-body");
    expect(noticeBodyRule).toMatch(/margin-bottom:\s*26px/);
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
