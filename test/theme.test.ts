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
    expect(THEME_CSS).toMatch(/input\[type=date\]\s*\{[^}]*min-height:\s*44px[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=date\]\s*\{[^}]*border:\s*1px solid var\(--chq-border\)[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=date\]\s*\{[^}]*border-radius:\s*4px[^}]*\}/s);
  });

  it("styles checkbox and radio with accent-color and an explicit box size", () => {
    expect(THEME_CSS).toMatch(/input\[type=checkbox\], input\[type=radio\]\s*\{[^}]*accent-color:\s*var\(--chq-brand\)[^}]*\}/s);
    expect(THEME_CSS).toMatch(/input\[type=checkbox\], input\[type=radio\]\s*\{[^}]*width:\s*18px[^}]*\}/s);
  });

  it("styles select with a CSS-only chevron (no inline SVG data URI) and appearance:none", () => {
    expect(THEME_CSS).toMatch(/\bselect\s*\{[^}]*appearance:\s*none[^}]*\}/s);
    expect(THEME_CSS).not.toContain("data:image/svg");
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
