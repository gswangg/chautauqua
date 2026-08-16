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

  it(".chq-auth-card declares a 1px rule border, surface fill and 8px radius", () => {
    const cardRule = extractRule(AUTH_CSS, ".chq-auth-card");
    expect(cardRule).toMatch(/border:\s*1px solid var\(--chq-rule\)/);
    // G13 fix (frame 11-account--00): the card paints one surface step
    // LIGHTER than the page -- frame samples #FAF8F2 (--chq-surface) on the
    // #F4F1E8 page, so paper fill on paper page was no contrast at all.
    expect(cardRule).toMatch(/background:\s*var\(--chq-surface\)/);
    expect(cardRule).toMatch(/border-radius:\s*8px/);
  });

  // DEC-945 wave-25 amendment: the V8 intake redrew 11-account--00 ("a card,
  // not a stretched phone") and explicitly supersedes the pair-6 box-math
  // ruling that trued the boxes up to 820/888.
  it("declares the V8 credential-card max-width (460px) plus the bare-page shell (820px, DEC-945 wave-48 amendment)", () => {
    const cardRule = extractRule(AUTH_CSS, ".chq-auth-card");
    expect(cardRule).toMatch(/max-width:\s*460px/);
    expect(cardRule).toMatch(/padding:\s*36px 34px 32px/);
    expect(cardRule).toMatch(/gap:\s*22px/);

    // DEC-945 wave-48 amendment: .chq-auth-card-narrow is deleted; the
    // three non-credential dead-ends compose .chq-bare-page (820px, no
    // border/background/radius) instead.
    expect(AUTH_CSS).not.toContain("chq-auth-card-narrow");
    const bareRule = extractRule(AUTH_CSS, ".chq-bare-page");
    expect(bareRule).toMatch(/max-width:\s*820px/);
    // w3-b: .chq-bare-page is a flex item of `body` (display:flex); with
    // only max-width and no width it shrink-wraps to its content instead of
    // filling the 820px reading column, which is why /account/password
    // rendered its fields at ~188px wide.
    expect(bareRule).toMatch(/width:\s*100%/);
    expect(bareRule).not.toMatch(/border/);
    expect(bareRule).not.toMatch(/background/);
    expect(bareRule).not.toMatch(/border-radius/);

    expect(THEME_CSS).toMatch(/--chq-measure:\s*820px/);

    // every stale box-math measure must be fully gone from the credential
    // card rule itself.
    expect(cardRule).not.toMatch(/max-width:\s*640px/);
    expect(cardRule).not.toMatch(/max-width:\s*732px/);
    expect(cardRule).not.toMatch(/max-width:\s*818px/);
    expect(cardRule).not.toMatch(/max-width:\s*888px/);
    expect(cardRule).not.toMatch(/max-width:\s*450px/);
  });

  it("the submit control is intrinsic-width, not a full-column bar", () => {
    // w3-b: the auth-card and bare-page (.chq-auth-actions) submit controls
    // now share one selector list / one box definition rather than two
    // rules that disagreed about which container implies a control height.
    const match = AUTH_CSS.match(
      /\.chq-auth-card button\[type=submit\],\s*\.chq-auth-actions button\[type=submit\]\s*\{([^}]*)\}/,
    );
    expect(match, "expected to find the shared .chq-auth-card / .chq-auth-actions submit rule").not.toBeNull();
    const submitRule = match![1]!;
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
    // DEC-945 wave-48 amendment: the notice card now sits in
    // .chq-bare-page rather than .chq-auth-card.
    const noticeCardRule = extractRule(AUTH_CSS, ".chq-bare-page.chq-auth-card-notice");
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
