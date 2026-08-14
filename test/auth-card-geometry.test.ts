// DEC-945 (wave 25 amendment): V8 auth card measures. A pure string scan of
// AUTH_CSS -- no browser, no DOM -- asserting:
//  (1) body { align-items: flex-start } so a card hugs its content instead
//      of stretching to full viewport height under justify-content: center.
//  (2) .chq-auth-card draws a 1px --chq-rule border + 8px radius (the V8
//      intake's "a card, not a stretched phone" -- superseding the wave-40
//      no-border ruling).
//  (3) the two card max-widths are 460px (.chq-auth-card) and 520px
//      (.chq-auth-card.chq-auth-card-narrow) -- the V8 intake supersedes the
//      pair-6 box-math ruling that trued the boxes up to 820/888.
//      --chq-measure (820, theme.ts) is still asserted here so a future
//      reading-measure move is caught, even though the auth card no longer
//      reads it at all (the card was never the reading column).
//  (4) the 404/notice block's title->body and body->links rhythm is stated
//      directly (19px / 26px) rather than inheriting the login form's
//      uniform card gap, with the UA <p> margin zeroed.

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

describe("auth card geometry (DEC-945 V8 amendment, wave 25)", () => {
  it("body sets align-items: flex-start so cards hug their content", () => {
    const bodyRule = extractRule(AUTH_CSS, "body");
    expect(bodyRule).toMatch(/align-items:\s*flex-start/);
  });

  it(".chq-auth-card declares a 1px rule border, paper fill and 8px radius", () => {
    const cardRule = extractRule(AUTH_CSS, ".chq-auth-card");
    expect(cardRule).toMatch(/border:\s*1px solid var\(--chq-rule\)/);
    expect(cardRule).toMatch(/background:\s*var\(--chq-paper\)/);
    expect(cardRule).toMatch(/border-radius:\s*8px/);
  });

  // DEC-945 wave-25 amendment: the V8 intake redrew 11-account--00 ("a card,
  // not a stretched phone") and explicitly supersedes the pair-6 box-math
  // ruling that trued the boxes up to 820/888.
  it("declares the two V8 card max-widths: 460px and 520px", () => {
    const cardRule = extractRule(AUTH_CSS, ".chq-auth-card");
    expect(cardRule).toMatch(/max-width:\s*460px/);
    expect(cardRule).toMatch(/padding:\s*36px 34px 32px/);
    expect(cardRule).toMatch(/gap:\s*22px/);

    // extractRule escapes its argument, so pass the selector verbatim.
    const narrowRule = extractRule(AUTH_CSS, ".chq-auth-card.chq-auth-card-narrow");
    expect(narrowRule).toMatch(/max-width:\s*520px/);

    expect(THEME_CSS).toMatch(/--chq-measure:\s*820px/);

    // every stale box-math measure must be fully gone from the card rule.
    expect(AUTH_CSS).not.toContain("max-width: 640px");
    expect(AUTH_CSS).not.toContain("max-width: 732px");
    expect(AUTH_CSS).not.toContain("max-width: 820px");
    expect(AUTH_CSS).not.toContain("max-width: 818px");
    expect(AUTH_CSS).not.toContain("max-width: 888px");
    expect(AUTH_CSS).not.toContain("max-width: 450px");
  });

  it("the submit control is intrinsic-width, not a full-column bar", () => {
    const submitRule = extractRule(AUTH_CSS, ".chq-auth-card button[type=submit]");
    expect(submitRule).toMatch(/width:\s*auto/);
    expect(submitRule).toMatch(/min-height:\s*46px/);
    expect(submitRule).toMatch(/padding:\s*0 22px/);
    expect(submitRule).toMatch(/font-size:\s*14px/);
    expect(submitRule).toMatch(/font-weight:\s*700/);
    expect(submitRule).not.toMatch(/width:\s*100%/);
  });

  it("inputs keep the 44px-family full-width phone-safe field shape", () => {
    const inputRule = extractRule(AUTH_CSS, "input[type=password]");
    expect(inputRule).toMatch(/width:\s*100%/);
    expect(inputRule).toMatch(/min-height:\s*48px/);
  });

  it(".chq-auth-submitrow is a footer row: space-between with a tertiary link, flex-end alone", () => {
    const rowRule = extractRule(AUTH_CSS, ".chq-auth-submitrow");
    expect(rowRule).toMatch(/display:\s*flex/);
    expect(rowRule).toMatch(/justify-content:\s*flex-end/);

    const withTertiary = extractRule(AUTH_CSS, ".chq-auth-submitrow:has(.chq-auth-tertiary)");
    expect(withTertiary).toMatch(/justify-content:\s*space-between/);
  });

  // DEC-945 wave-1 amendment: the 404/notice block's rhythm is tighter than
  // the login form's uniform card gap -- .chq-auth-card-notice turns the
  // card's own gap off and states the title->body and body->links spacing
  // directly, with the UA <p> margin zeroed so it never stacks on top of
  // either. Untouched by the wave-25 box resize.
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
