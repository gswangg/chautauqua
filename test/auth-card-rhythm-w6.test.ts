// DEC-945 (wave-6, 11-account gate-4 STILL-PRESENT): auth-card rhythm
// fixes -- a pure string scan of AUTH_CSS, same style as
// test/auth-card-geometry.test.ts.
//  (1) .chq-auth-fields (a <form>) zeroes the UA form margin.
//  (2) .chq-auth-footer's own footer-links keep the 44px hit area via
//      align-items: flex-start (not the 404 card's shared selector).
//  (3) demo prefill buttons take the card's link vocabulary: 14px/700,
//      brand olive via var(--chq-brand), no underline at rest; the
//      landed :focus-visible ring is
//      untouched.
//  (4) /account/password's head rhythm: .chq-auth-back's own 44px hit
//      area via align-items: flex-start + a negative margin-bottom; the
//      titlerow->fields gap and .chq-auth-actions' own gap are each
//      tightened/loosened without moving the 14px field pitch.

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

  it(".chq-auth-footer's own footer-links row keeps the 44px hit area top-aligned, scoped away from the 404 card", () => {
    const scoped = extractRule(AUTH_CSS, ".chq-auth-footer .chq-auth-footer-links a");
    expect(scoped).toMatch(/align-items:\s*flex-start/);
    // the shared base rule (used by the 404 card too) still declares the
    // 44px min-height tap target.
    const base = extractRule(AUTH_CSS, ".chq-auth-footer-links a");
    expect(base).toMatch(/min-height:\s*44px/);
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

  it(".chq-auth-back keeps its 44px hit area top-aligned and pulls the following h1 up", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-back");
    expect(rule).toMatch(/min-height:\s*44px/);
    expect(rule).toMatch(/align-items:\s*flex-start/);
    expect(rule).toMatch(/margin-bottom:\s*-13px/);
  });

  it("a titlerow immediately followed by the fields form tightens its own gap without touching the notice card's", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-titlerow:has(+ .chq-auth-fields)");
    expect(rule).toMatch(/margin-bottom:\s*-8\.5px/);

    // the 404 notice card's own override is untouched.
    const noticeRule = extractRule(AUTH_CSS, ".chq-auth-card-notice .chq-auth-titlerow");
    expect(noticeRule).toMatch(/margin-bottom:\s*19px/);
  });

  it(".chq-auth-actions adds the remaining gap to its divider without moving the field pitch", () => {
    const rule = extractRule(AUTH_CSS, ".chq-auth-actions");
    expect(rule).toMatch(/margin-top:\s*6\.5px/);
    expect(rule).toMatch(/gap:\s*14px/); // its own internal button/hint gap, unrelated to the field pitch above
  });
});
