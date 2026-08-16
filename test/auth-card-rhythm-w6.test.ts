// DEC-945 (wave-6, 11-account gate-4 STILL-PRESENT): auth-card rhythm
// fixes -- a pure string scan of AUTH_CSS, same style as
// test/auth-card-geometry.test.ts.
//  (1) .chq-auth-fields (a <form>) zeroes the UA form margin.
//  (2) DEC-367 amendment (wave 57): the >=44px tap floor is phone-only now
//      (docs/design/README.md:92) -- .chq-auth-footer's own former
//      align-items:flex-start override on .chq-auth-footer-links a is
//      GONE (nothing left to compensate for once the box is phone-scoped),
//      and so is the base rule's unconditional min-height:44px; the 44px
//      box only appears inside AUTH_CSS's tail @media (max-width: 700px)
//      block now, shared unscoped by both the /login footer and the 404
//      card.
//  (3) demo prefill buttons take the card's link vocabulary: 14px/700,
//      brand olive via var(--chq-brand), no underline at rest; the
//      landed :focus-visible ring is
//      untouched.
//  (4) /account/password's head rhythm: DEC-367 amendment (wave 57):
//      .chq-auth-back's former always-on 44px hit area (align-items:
//      flex-start + a negative margin-bottom compensating for it) is gone
//      from the base rule too -- the titlerow->fields gap and
//      .chq-auth-actions' own gap are each tightened/loosened without
//      moving the 14px field pitch.

import { describe, expect, it } from "vitest";
import { AUTH_CSS } from "../src/routes/auth.css";

function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = css.match(re);
  expect(match, `expected to find rule for selector: ${selector}`).not.toBeNull();
  return match![1]!;
}

describe("auth card rhythm (DEC-945 wave-6 amendment)", () => {
  it(".chq-auth-fields zeroes the UA form margin, keeping its 14px field gap", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-fields");
    expect(rule).toMatch(/gap:\s*14px/);
    expect(rule).toMatch(/margin:\s*0/);
  });

  it("DEC-367 amendment (wave 57): the .chq-auth-footer-scoped align-items:flex-start override is gone, and the shared base rule no longer carries an unconditional 44px floor", () => {
    expect(AUTH_CSS).not.toMatch(/\.chq-auth-footer\s+\.chq-auth-footer-links\s+a\s*\{/);
    const base = extractRule(AUTH_CSS, ".chq-auth-footer-links a");
    expect(base).not.toMatch(/min-height/);
    expect(base).toMatch(/align-items:\s*center/);
  });

  it("demo prefill buttons take the card's link vocabulary and keep the landed focus ring", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-demo-buttons .chq-auth-demo-btn");
    expect(rule).toMatch(/font-size:\s*14px/);
    expect(rule).toMatch(/font-weight:\s*700/);
    // DEC-383 (merge repair): the brand olive arrives through the token,
    // never a literal hex -- var(--chq-brand) resolves to the same ink.
    expect(rule).toMatch(/color:\s*var\(--chq-brand\)/);
    expect(rule).toMatch(/text-decoration:\s*none/);

    const focusRule = extractRule(AUTH_CSS, ".chq-auth-demo-buttons .chq-auth-demo-btn:focus-visible");
    expect(focusRule).toMatch(/outline:\s*2px solid var\(--chq-brand\)/);
    expect(focusRule).toMatch(/outline-offset:\s*2px/);
  });

  it("DEC-367 amendment (wave 57): .chq-auth-back's base rule has no 44px floor / centering compensation left; the floor is phone-scoped", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-back");
    expect(rule).not.toMatch(/min-height/);
    expect(rule).not.toMatch(/align-items:\s*flex-start/);
    expect(rule).not.toMatch(/margin-bottom:\s*-13px/);
    expect(rule).toMatch(/align-self:\s*flex-start/);
  });

  it("DEC-369 amendment (wave 22): the titlerow->fields override is gone, the card's shared 26px gap governs", () => {
    expect(AUTH_CSS).not.toMatch(/\.chq-auth-titlerow:has\(\+ \.chq-auth-fields\)/);

    // the 404 notice card's own override is untouched.
    const noticeRule = extractRule(AUTH_CSS, ".chq-auth-card-notice .chq-auth-titlerow");
    expect(noticeRule).toMatch(/margin-bottom:\s*19px/);
  });

  it(".chq-auth-actions adds the remaining gap to its divider without moving the field pitch (DEC-369 amendment: 6.5px rounded to 6px)", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-actions");
    expect(rule).toMatch(/margin-top:\s*6px/);
    expect(rule).toMatch(/gap:\s*14px/); // its own internal button/hint gap, unrelated to the field pitch above
  });
});
