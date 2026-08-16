// DEC-939 amendment (wave 20): a tinted interaction-state band insets its
// content 16px and keeps the surface's column grid; a row action sizes to
// its content. This scan pins the four rules the ruling depends on, all in
// app/src/pages/review/review.css:
//   - .chq-review-plan-row.is-active: background + a left inset the row's
//     unstated sibling already carries, so the row's own
//     grid-template-columns stay pixel-identical to unstated siblings.
//     DEC-745's findings-wave-4 amendment SUPERSEDES the MECHANISM this
//     clause originally pinned (`margin-inline:-16px; padding-inline:16px`):
//     that bought the inset by drawing the band 16px OUTSIDE the reading
//     measure it belongs to. The selected row is now the B8 shared pattern
//     -- `--chq-surface-sunk` fill PLUS a 3px `--chq-brand` left edge that
//     REPLACES 3px of the row's own 16px left padding, inheriting the
//     parent's box instead of escaping it. Wave-20's actual requirement
//     (tint inset, content on the sibling's column positions) is unchanged
//     and is what is asserted below: 3 + 13 == the base row's 16, and no
//     negative margin-inline anywhere. The edge itself is pinned by
//     app/src/b8-selected-row.scan.test.ts.
//   - .chq-review-reviews-detail: background + non-zero padding (this is
//     the colSpan <td>, so real padding is correct -- no negative margin).
//   - the reviews band keeps the surface's columns and never free-floats its
//     cells with justify-content: space-between. DEC-633's wave-25 amendment
//     SUPERSEDES the original form of this clause: .chq-review-reviews-item-head
//     (a colSpan free-float list styled with its own hand-copied grid template)
//     no longer exists -- each evaluation is a real <tr> in the results table,
//     so the browser aligns it to the header columns. The wave-20 requirement
//     is therefore pinned on the real-row band instead of the deleted rule.
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

  it(".chq-review-plan-row.is-active declares a background and keeps the unstated row's 16px left inset without bleeding past it", () => {
    const base = findRule(css, ".chq-review-plan-row");
    // The unstated row owns the inset; the state only re-divides it.
    // User-filed (gate-12 era): the right inset now mirrors the left so the
    // actions cluster never sits flush against the row's fill edge. This
    // scan's concern is the LEFT inset the band re-divides — unchanged.
    expect(base, "the unstated plan row must carry the 16px left inset the band re-divides").toMatch(
      /padding:\s*16px 16px 16px 16px/,
    );

    const body = findRule(css, ".chq-review-plan-row.is-active");
    expect(body).toMatch(/background:/);
    // DEC-745 findings-wave-4: 3px olive edge + 13px padding == the base
    // row's 16px, so selecting a row shifts its content by zero pixels.
    expect(body).toMatch(/border-left:\s*3px solid var\(--chq-brand\)/);
    expect(body).toMatch(/padding-left:\s*13px/);
    expect(body).not.toMatch(/padding-inline:\s*0/);
    expect(body).not.toMatch(/padding-left:\s*0/);
    // The band inherits the parent's box -- it never escapes the measure.
    expect(body, "a state band must not bleed past the reading measure").not.toMatch(/margin-inline:\s*-/);
    expect(body).not.toMatch(/margin-left:\s*-/);
  });

  it(".chq-review-reviews-detail declares a background and non-zero padding", () => {
    const body = findRule(css, ".chq-review-reviews-detail");
    expect(body).toMatch(/background:/);
    expect(body).toMatch(/padding:\s*16px/);
    expect(body).not.toMatch(/padding:\s*0/);
  });

  it("the reviews band is real table rows and never free-floats with justify-content: space-between (DEC-633 wave-25)", () => {
    // The band row carries the fill; its cells take the 16px inset. Both are
    // real <tr>/<td>, so the column grid is the table's own -- nothing to
    // hand-copy and nothing to drift.
    const row = findRule(css, ".chq-review-reviews-row");
    expect(row).toMatch(/background:/);
    const cells = findRule(css, ".chq-review-reviews-row > td");
    expect(cells).toMatch(/padding-top:\s*16px/);
    expect(cells).toMatch(/padding-bottom:\s*16px/);

    // The superseded free-float rule must NOT come back, in any form: no
    // .chq-review-reviews-* rule may lay its cells out with space-between.
    // (Scoped to the band -- unrelated review.css rules use space-between
    // legitimately, and wave-20's clause was only ever about this band.)
    expect(css).not.toMatch(/\.chq-review-reviews-item-head\s*\{/);
    const bandRules = css.match(/\.chq-review-reviews-[\w->. ]*\{[^{}]*\}/g) ?? [];
    expect(bandRules.length).toBeGreaterThan(0); // vacuous-scan tripwire
    expect(bandRules.filter((r) => /justify-content:\s*space-between/.test(r))).toEqual([]);
  });

  it(".chq-review-queue-row-action declares no min-width floor", () => {
    const body = findRule(css, ".chq-review-queue-row-action");
    expect(body).not.toMatch(/min-width/);
    expect(body).toMatch(/max-width:\s*220px/);
  });
});
