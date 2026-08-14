// DEC-939 amendment (wave 20): a tinted interaction-state band insets its
// content 16px and keeps the surface's column grid; a row action sizes to
// its content. This scan pins the four rules the ruling depends on, all in
// app/src/pages/review/review.css:
//   - .chq-review-plan-row.is-active: background + non-zero inline padding
//     (an equal negative margin cancels the padding, so the row's own
//     grid-template-columns stay pixel-identical to unstated siblings).
//   - .chq-review-reviews-detail: background + non-zero padding (this is
//     the colSpan <td>, so real padding is correct -- no negative margin).
//   - .chq-review-reviews-item-head: declares grid-template-columns and no
//     longer free-floats its cells with justify-content: space-between.
//   - .chq-review-queue-row-action: keeps max-width, drops the min-width
//     floor that invented width the frame does not have.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const CSS_PATH = join(REPO_ROOT, "app/src/pages/review/review.css");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findRule(css: string, selector: string): string {
  // Selector text may contain regex-special characters (., -) -- escape them.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`);
  const match = css.match(re);
  expect(match, `selector "${selector}" not found in review.css`).not.toBeNull();
  return match![1] as string;
}

describe("review.css state-band inset (DEC-939 wave-20 amendment)", () => {
  const raw = readFileSync(CSS_PATH, "utf8");
  const css = stripComments(raw);

  it("is a non-empty file (vacuous-scan tripwire)", () => {
    expect(css.trim().length).toBeGreaterThan(0);
  });

  it(".chq-review-plan-row.is-active declares a background and non-zero inline padding", () => {
    const body = findRule(css, ".chq-review-plan-row.is-active");
    expect(body).toMatch(/background:/);
    expect(body).toMatch(/padding-inline:\s*16px/);
    expect(body).not.toMatch(/padding-inline:\s*0/);
  });

  it(".chq-review-reviews-detail declares a background and non-zero padding", () => {
    const body = findRule(css, ".chq-review-reviews-detail");
    expect(body).toMatch(/background:/);
    expect(body).toMatch(/padding:\s*16px/);
    expect(body).not.toMatch(/padding:\s*0/);
  });

  it(".chq-review-reviews-item-head declares grid-template-columns and never justify-content: space-between", () => {
    const body = findRule(css, ".chq-review-reviews-item-head");
    expect(body).toMatch(/grid-template-columns:/);
    expect(body).not.toMatch(/justify-content:\s*space-between/);
  });

  it(".chq-review-queue-row-action declares no min-width floor", () => {
    const body = findRule(css, ".chq-review-queue-row-action");
    expect(body).not.toMatch(/min-width/);
    expect(body).toMatch(/max-width:\s*220px/);
  });
});
