// Gate-4 BROKEN (three-gate survivor): the contact drawer's headshot file
// input (since removed per ruling A20/fidelity item 4 — PROFILE is bio +
// links only) overflowed the drawer and the 1440 viewport because the
// record-row value column was a bare `1fr` — its auto min-content floor
// exceeded the 418px drawer at the time. The grid-column fix stands on its
// own merits (any wide row value could hit the same floor) so this
// assertion is kept; the file-input-specific assertion was removed with the
// headshot field itself.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "contacts.css"), "utf8");

describe("contact drawer cannot overflow horizontally (gate-4 BROKEN fix)", () => {
  it("record-row value column uses minmax(0, 1fr), never bare 1fr", () => {
    const rule = css.match(/\.chq-contacts-record-row \{[\s\S]*?\}/)?.[0] ?? "";
    expect(rule).toContain("grid-template-columns: 130px minmax(0, 1fr)");
    expect(rule).not.toMatch(/grid-template-columns: 130px 1fr;/);
  });
});

// User-filed (gate-6 cycle): the sticky action bar is a flex item of the
// column-flex drawer scroll container — without flex-shrink:0 it compressed
// below its own buttons' height (37px vs 44px buttons), the buttons
// overflowed the painted band, and scrolled rows showed through around
// them. The sticky mechanics live in app/src/styles.css.
describe("drawer sticky action bar cannot be flex-squeezed", () => {
  it("the styles.css sticky rule declares flex-shrink: 0", () => {
    const shared = readFileSync(join(__dirname, "..", "..", "styles.css"), "utf8");
    const rule = shared.match(/\.chq-contacts-drawer-actions \{[\s\S]*?\}/)?.[0] ?? "";
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("flex-shrink: 0");
    expect(rule).toContain("background: var(--chq-paper)");
    // Sticky pins the margin box: a negative bottom margin leaves a
    // see-through strip below the pinned bar. The drawer zeroes its own
    // bottom padding instead (contacts.css), and the bar's margin ends 0.
    expect(rule).toContain("margin: 0 -26px 0;");
    const drawer = css.match(/\.chq-contacts-drawer \{[\s\S]*?\}/)?.[0] ?? "";
    expect(drawer).toContain("padding-bottom: 0");
  });
});
