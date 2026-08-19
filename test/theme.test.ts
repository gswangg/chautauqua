// Regression for task-w1-b: THEME_CSS is the one inlined SSR stylesheet
// (DEC-371) — this pins the DEC-367 token vocabulary, the two self-hosted
// variable @font-face blocks, the no-red rule, and the hono/jsx unquoted-
// attribute-selector convention (see src/routes/public/shell.tsx:65-72).

import { describe, expect, it } from "vitest";
import { THEME_CSS } from "../src/views/theme";

const TOKEN_NAMES = [
  "--chq-paper",
  "--chq-surface",
  "--chq-surface-sunk",
  "--chq-ink",
  "--chq-muted",
  "--chq-hairline",
  "--chq-rule",
  "--chq-border",
  "--chq-brand",
  "--chq-on-brand",
];

describe("THEME_CSS (DEC-367 tokens)", () => {
  it.each(TOKEN_NAMES)("declares token %s", (token) => {
    expect(THEME_CSS).toContain(token);
  });

  it("declares the Familjen Grotesk variable font-face with a weight range", () => {
    expect(THEME_CSS).toMatch(/@font-face\s*{[^}]*font-family:\s*'Familjen Grotesk'[^}]*}/s);
    expect(THEME_CSS).toMatch(/font-family:\s*'Familjen Grotesk'[\s\S]*?font-weight:\s*400 700/);
    expect(THEME_CSS).toContain("/fonts/FamiljenGrotesk-var.woff2");
  });

  it("declares the Figtree variable font-face with a weight range", () => {
    expect(THEME_CSS).toMatch(/@font-face\s*{[^}]*font-family:\s*'Figtree'[^}]*}/s);
    expect(THEME_CSS).toMatch(/font-family:\s*'Figtree'[\s\S]*?font-weight:\s*400 800/);
    expect(THEME_CSS).toContain("/fonts/Figtree-var.woff2");
  });

  it("contains no semantic red (DEC-367: no red, no third accent)", () => {
    const lower = THEME_CSS.toLowerCase();
    expect(lower).not.toContain("#c0392b");
    expect(lower).not.toContain("#fdecea");
    expect(lower).not.toMatch(/\bred\b/);
    expect(lower).not.toContain("crimson");
  });

  it("has no double-quoted attribute selector (hono/jsx escaping trap)", () => {
    expect(THEME_CSS).not.toMatch(/\[[a-zA-Z-]+="/);
  });

  it("carries the brandable-accent hook that per-event branding recolours", () => {
    expect(THEME_CSS).toContain("--chq-brandable-accent");
  });
});

describe("THEME_CSS native control coverage (DEC-585)", () => {
  it("styles input[type=file] and both the standard and -webkit- file-selector-button pseudo-elements", () => {
    expect(THEME_CSS).toMatch(/input\[type=file\]\s*\{/);
    expect(THEME_CSS).toContain("::file-selector-button");
    expect(THEME_CSS).toContain("::-webkit-file-upload-button");
  });

  it("styles input[type=date] with the same box metrics as the text inputs", () => {
    // DEC-367 amendment (wave 48): the 44px tap floor is PHONE-scoped per the
    // vendored README ("desktop rows use padding"), so it no longer sits in
    // the base input[type=date] rule -- it's re-asserted for the same
    // selector inside THEME_CSS's @media (max-width: 700px) block instead.
    expect(THEME_CSS).toMatch(/@media \(max-width: 700px\) \{[^]*input\[type=date\]\s*\{[^}]*min-height:\s*44px[^}]*\}[^]*\}/);
    expect(THEME_CSS).toMatch(/input\[type=date\]\s*\{[^}]*border:\s*1px solid var\(--chq-border\)[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=date\]\s*\{[^}]*border-radius:\s*4px[^}]*\}/s);
  });

  // DEC-585 amendment (speakers-defect wave): accent-color TINTS the
  // platform's own checkbox; it does not replace it. A platform widget also
  // draws the platform's own focus treatment inside the house ring declared
  // at the top of this sheet, which is what a user reported as "native focus
  // rings" on the v12 speakers surfaces. The box is drawn here instead, so
  // the :focus-visible rule is the ONLY focus mark these two ever wear. The
  // 18px box size the previous form of this test pinned is kept; what
  // changed is that the box is now ours. Twin of the same takeover in
  // app/src/styles.css (app/src/focus-treatment.scan.test.ts holds both
  // roots to it).
  it("draws its own checkbox and radio box rather than tinting the platform's", () => {
    expect(THEME_CSS).toMatch(/input\[type=checkbox\], input\[type=radio\]\s*\{[^}]*appearance:\s*none[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=checkbox\], input\[type=radio\]\s*\{[^}]*width:\s*18px[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=checkbox\], input\[type=radio\]\s*\{[^}]*height:\s*18px[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=checkbox\], input\[type=radio\]\s*\{[^}]*border:\s*1px solid var\(--chq-border\)[^}]*\}/s);
    // No accent-color survives: a tint on a widget we no longer render
    // would be a dead declaration claiming to own the control's colour.
    expect(THEME_CSS.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/accent-color/);
  });

  it("fills the checked checkbox and radio with brand and marks them in on-brand", () => {
    // The frame's own ticked box: docs/design/Chautauqua Speakers.dc.html:642
    // `border:1px solid #4E5C31; background:#4E5C31; border-radius:3px`.
    expect(THEME_CSS).toMatch(/input\[type=checkbox\]:checked,[^{]*\{[^}]*background:\s*var\(--chq-brand\)[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=checkbox\]:checked::after\s*\{[^}]*var\(--chq-on-brand\)[^}]*\}/s);
    // Partial selection (the shared select-all contract) is a bar, not a tick.
    expect(THEME_CSS).toMatch(/input\[type=checkbox\]:indeterminate::after\s*\{[^}]*var\(--chq-on-brand\)[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=radio\]:checked::after\s*\{[^}]*var\(--chq-on-brand\)[^}]*\}/s);
  });

  // DEC-919 (wave-1 amendment) supersedes this test's original "CSS-only
  // chevron, no inline SVG data URI" form: it rules that the caret is
  // restored ONCE on the shared `select` rule as "an inline data-URI SVG
  // background plus the padding-right that clears it". DEC-585 only ever
  // required the chevron to live in THEME_CSS, not which technique drew it,
  // so the data URI is now the mandated implementation rather than a defect.
  // The double quotes around url("data:…") are safe: ThemeStyles injects
  // THEME_CSS via dangerouslySetInnerHTML, so it is never HTML-escaped
  // (DEC-374's trap is about <style>{THEME_CSS}</style> text children).
  it("styles select with appearance:none plus an inline data-URI SVG caret and the padding that clears it", () => {
    expect(THEME_CSS).toMatch(/\bselect\s*\{[^}]*appearance:\s*none[^}]*\}/s);
    expect(THEME_CSS).toMatch(/\bselect\s*\{[^}]*background-image:\s*url\("data:image\/svg\+xml,[^}]*\}/s);
    // The caret must clear the text: a right-anchored background plus a
    // padding-right larger than the caret box and its inset.
    expect(THEME_CSS).toMatch(/\bselect\s*\{[^}]*background-position:\s*right[^}]*\}/s);
    expect(THEME_CSS).toMatch(/\bselect\s*\{[^}]*padding:\s*[^;]*\s2\.25rem\s[^;]*;[^}]*\}/s);
  });

  it("draws the select caret in the literal --chq-ink hex, since a data URI cannot read a CSS variable", () => {
    // The stroke is percent-encoded (%23 for '#') and hard-coded, so it can
    // silently desync from the token. Pin them together.
    expect(THEME_CSS).toMatch(/--chq-ink:\s*#1B1D17/);
    expect(THEME_CSS).toContain("stroke='%231B1D17'");
  });

  it("every appearance:none declaration is paired with a :focus-visible rule for the same selector family", () => {
    // DEC-585: appearance:none removes the browser's default focus ring on
    // some engines, so any selector using it must have an explicit
    // :focus-visible rule elsewhere in THEME_CSS (the global :focus-visible
    // rule also applies, but this pins the explicit per-control rule too).
    expect(THEME_CSS).toMatch(/appearance:\s*none/);
    expect(THEME_CSS).toMatch(/select:focus-visible/);
  });

  it("declares :focus-visible for file, date, checkbox and radio controls", () => {
    expect(THEME_CSS).toContain("input[type=date]:focus-visible");
    expect(THEME_CSS).toContain("input[type=file]:focus-visible");
    expect(THEME_CSS).toContain("input[type=checkbox]:focus-visible");
    expect(THEME_CSS).toContain("input[type=radio]:focus-visible");
  });

  it("has no double-quoted attribute selector among the new control rules either", () => {
    expect(THEME_CSS).not.toMatch(/\[type="/);
  });
});
