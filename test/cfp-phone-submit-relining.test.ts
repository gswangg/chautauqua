// DEC-919 wave-118 (w7-a): the step-1 phone `[data-chq-cfp-step="1"]
// .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft)`
// display:none is a RE-LINING, not a removal -- the primary submit is
// reachable one tap away on the same phone surface via
// .chq-cfp-step-next, which advances data-chq-cfp-step to "2", where the
// rule no longer matches. This pins the cascade (no hide under step "2"
// or the markup default "all"), not just the stylesheet literal
// (wave-116's sign-in lesson: a substring receipt proves someone typed
// the fix, never that it reaches the screen).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CFP_CSS } from "../src/routes/public/cfp.css";

const CSS_FILE_PATH = fileURLToPath(
  new URL("../src/routes/public/cfp.css.ts", import.meta.url),
);
const CSS_SOURCE = readFileSync(CSS_FILE_PATH, "utf8");

const SUBMIT_SELECTOR =
  '[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft)';

describe("cfp phone step-1 submit re-lining (DEC-919 wave-118)", () => {
  it("CFP_CSS actually contains the step-1 hide rule (sanity: the population is real)", () => {
    expect(CFP_CSS).toContain(SUBMIT_SELECTOR);
  });

  it('no rule hides .chq-cfp-actions button[type="submit"] under data-chq-cfp-step="2"', () => {
    const step2SubmitHide = new RegExp(
      String.raw`\[data-chq-cfp-step="2"\][^{}]*\.chq-cfp-actions[^{}]*button\[type="submit"\][^{}]*\{[^{}]*display:\s*none`,
    );
    expect(step2SubmitHide.test(CSS_SOURCE)).toBe(false);
  });

  it('no top-level or data-chq-cfp-step="all" rule hides .chq-cfp-actions button[type="submit"]', () => {
    // The "all" block explicitly enumerates the rules it hides
    // (.chq-cfp-steps, .chq-cfp-step-next, .chq-cfp-step-back) -- confirm
    // the submit button is not among them, and that no bare (unscoped by
    // any [data-chq-cfp-step] attribute) rule hides it either.
    const allBlockMatch = CSS_SOURCE.match(
      /(?:\[data-chq-cfp-step="all"\][^,{}]*,?\s*)+\{[^{}]*display:\s*none[^{}]*\}/,
    );
    expect(allBlockMatch).not.toBeNull();
    expect(allBlockMatch![0]).not.toMatch(/button\[type="submit"\]/);

    // Every occurrence of the selector text in the whole sheet must be the
    // single step-1-scoped one -- collect all matches of the bare
    // `.chq-cfp-actions button[type="submit"]...` selector fragment and
    // assert each is preceded by the step-1 attribute selector.
    const occurrences = [
      ...CSS_SOURCE.matchAll(
        /\.chq-cfp-actions\s+button\[type="submit"\]:not\(\.chq-cfp-save-draft\)\s*\{[^{}]*display:\s*none/g,
      ),
    ];
    expect(occurrences.length).toBe(1);
    const idx = occurrences[0]!.index!;
    const precedingText = CSS_SOURCE.slice(Math.max(0, idx - 60), idx);
    expect(precedingText).toContain('[data-chq-cfp-step="1"]');
  });

  it(".chq-cfp-step-next is the only step-1-to-step-2 advance control (the re-lining path exists)", () => {
    expect(CSS_SOURCE).toContain(".chq-cfp-step-next");
    expect(CSS_SOURCE).toMatch(
      /\.chq-cfp-step-next,\s*\n\s*\.chq-cfp-step-back \{ display: inline-flex/,
    );
  });

  it("a phone-hidden receipt comment sits immediately above the step-1 submit rule", () => {
    const ruleIndex = CSS_SOURCE.indexOf(
      `[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft) { display: none; }`,
    );
    expect(ruleIndex).toBeGreaterThan(-1);

    const before = CSS_SOURCE.slice(0, ruleIndex);
    const commentClose = before.lastIndexOf("*/");
    expect(commentClose).toBeGreaterThan(-1);

    // Nothing but whitespace between the comment's closer and the rule's
    // selector opener.
    const gap = before.slice(commentClose + 2);
    expect(gap.trim()).toBe("");

    const commentOpen = before.lastIndexOf("/*", commentClose);
    const commentText = before.slice(commentOpen, commentClose + 2);
    const receiptMatch = /\/\*\s*phone-hidden:\s*([^*]*)\*\//.exec(commentText);
    expect(receiptMatch).not.toBeNull();
    const reason = (receiptMatch![1] ?? "").trim();
    expect(reason.length).toBeGreaterThan(0);

    // The reason names the same-surface re-lining path by file:line, not a
    // branch or a wave.
    expect(reason).toMatch(/cfp\.css\.ts:268/);
    expect(reason).toMatch(/cfp\.css\.ts:308-310|"all"/);
    expect(reason).not.toMatch(/\bv12m-w\d+-[a-z]\b/i);
    expect(reason).not.toMatch(/\btask-w\d+-[a-z]\b/i);
    expect(reason).not.toMatch(/\bwave-\d+\b/i);
  });
});
