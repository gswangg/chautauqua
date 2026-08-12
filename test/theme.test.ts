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
