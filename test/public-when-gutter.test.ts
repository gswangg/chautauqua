// task-w4-g (DEC-534 amendment): one public time/room gutter, one token,
// two consumers. .chq-pub-session-row (cards.css.ts) and
// .chq-pub-schedule-row (rail.css.ts) render the SAME time-over-room stack
// and must share --chq-pub-when-gutter instead of each hand-copying a
// pixel literal -- otherwise the two renderings of one stack drift apart
// (as they did: 268px vs 126px) with nothing to catch it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CARDS_CSS } from "../src/routes/public/css/cards.css";
import { RAIL_CSS } from "../src/routes/public/css/rail.css";

const ROOT = join(__dirname, "..");
const stylesCss = readFileSync(join(ROOT, "app/src/styles.css"), "utf8");
const themeTs = readFileSync(join(ROOT, "src/views/theme.ts"), "utf8");

// The hand-copied-literal guard below polices DECLARATIONS, not prose: under
// DEC-976's wave-23 amendment a `docs/design/*.dc.html:<line>` citation must
// quote the cited line's literal declaration in backticks, so the frame's own
// `grid-template-columns:126px 1fr auto` legitimately appears inside a comment
// in cards.css.ts. Strip comments first (the standing idiom across this repo's
// CSS scans) so the guard still fails on a real hand-copied rule and never on
// the receipt that proves where the token's value came from.
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
const CARDS_RULES = stripComments(CARDS_CSS);
const RAIL_RULES = stripComments(RAIL_CSS);

describe("task-w4-g: --chq-pub-when-gutter is the ONE public time/room gutter measure", () => {
  it("declares the 126px literal exactly once in each of the SPA :root and the mirrored SSR THEME_CSS", () => {
    const spaMatches = stylesCss.match(/--chq-pub-when-gutter:\s*126px/g) ?? [];
    const ssrMatches = themeTs.match(/--chq-pub-when-gutter:\s*126px/g) ?? [];
    expect(spaMatches.length).toBe(1);
    expect(ssrMatches.length).toBe(1);
  });

  it("never hand-copies a 126px or 268px gutter literal into either css module -- both consume the token", () => {
    expect(CARDS_RULES).not.toMatch(/grid-template-columns:\s*126px/);
    expect(CARDS_RULES).not.toMatch(/grid-template-columns:\s*268px/);
    expect(RAIL_RULES).not.toMatch(/grid-template-columns:\s*126px/);
    expect(RAIL_RULES).not.toMatch(/grid-template-columns:\s*268px/);
  });

  it(".chq-pub-session-row (cards.css.ts) consumes var(--chq-pub-when-gutter) for its time/room gutter", () => {
    const rule = CARDS_CSS.match(/\.chq-pub-session-row\s*\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toContain("grid-template-columns: var(--chq-pub-when-gutter) 1fr auto;");
  });

  it(".chq-pub-schedule-row (rail.css.ts) consumes var(--chq-pub-when-gutter) for its time/room gutter -- the SAME token as .chq-pub-session-row", () => {
    const rule = RAIL_CSS.match(/\.chq-pub-schedule-row\s*\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toContain("grid-template-columns: var(--chq-pub-when-gutter) 1fr auto;");
  });

  it("leaves .chq-pub-session-row-notime un-touched (no gutter column at all, per DEC-698)", () => {
    const rule = CARDS_CSS.match(/\.chq-pub-session-row-notime\s*\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toContain("grid-template-columns: 1fr auto;");
  });
});
