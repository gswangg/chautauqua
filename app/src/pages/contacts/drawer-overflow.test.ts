// Gate-4 BROKEN (three-gate survivor): the contact drawer's headshot file
// input overflowed the drawer and the 1440 viewport because the record-row
// value column was a bare `1fr` — its auto min-content floor is the native
// file input's intrinsic ~284px, so the column could never shrink to the
// 418px drawer. These assertions pin the two-part fix: minmax(0,1fr) on the
// grid column and width:100% on the file input inside the upload field.
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

  it("headshot upload's file input fills its granted column", () => {
    expect(css).toMatch(/\.chq-contacts-headshot-upload \.chq-file \{[^}]*width: 100%/);
    const upload = css.match(/\.chq-contacts-headshot-upload \{[\s\S]*?\}/)?.[0] ?? "";
    expect(upload).toContain("min-width: 0");
  });
});
