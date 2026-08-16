import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// DEC-902 (w60, gate-10 MAJOR): the People list header row's column widths
// must always match the data row's column widths. Both consume a single
// custom property (--chq-people-grid) declared once on the shared list
// container (.chq-settings-people-list), so the two rules can never
// literally diverge again. This asserts against the stylesheet source text
// (jsdom does not lay out CSS grid tracks), resolving each rule's
// grid-template-columns declaration to its effective track list.

const cssPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "settings.css",
);
const css = readFileSync(cssPath, "utf8");

function ruleBodyFor(source: string, selector: string): string {
  const idx = source.indexOf(selector);
  expect(idx, `selector ${selector} not found`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", idx);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

// Resolves a `grid-template-columns` declaration's value, following a single
// `var(--token)` indirection back to the custom property that defines it.
// A literal track list is returned unchanged.
function resolvedTrackList(source: string, selector: string): string {
  const body = ruleBodyFor(source, selector);
  const match = body.match(/grid-template-columns:\s*([^;]+);/);
  expect(match, `no grid-template-columns in ${selector}`).not.toBeNull();
  const raw = match![1]!.trim();
  const varMatch = raw.match(/^var\((--[\w-]+)\)$/);
  if (!varMatch) return raw;
  const token = varMatch[1]!;
  const tokenMatch = source.match(new RegExp(`${token}:\\s*([^;]+);`));
  expect(tokenMatch, `custom property ${token} not defined`).not.toBeNull();
  return tokenMatch![1]!.trim();
}

describe("settings.css people list header/row grid parity (DEC-902)", () => {
  it("resolves the header row and data row grid-template-columns to the same track list", () => {
    const headerTracks = resolvedTrackList(css, ".chq-settings-people-header-row {");
    const rowTracks = resolvedTrackList(css, ".chq-settings-people-row {");
    expect(headerTracks).toBe(rowTracks);
    expect(headerTracks).toBe("minmax(0, 1fr) 170px 190px 200px");
  });

  it("both rules consume the shared --chq-people-grid custom property rather than a literal track list", () => {
    const headerBody = ruleBodyFor(css, ".chq-settings-people-header-row {");
    const rowBody = ruleBodyFor(css, ".chq-settings-people-row {");
    expect(headerBody).toMatch(/grid-template-columns:\s*var\(--chq-people-grid\)/);
    expect(rowBody).toMatch(/grid-template-columns:\s*var\(--chq-people-grid\)/);
  });

  it("negative control: the parser flags two literal divergent track lists as a mismatch", () => {
    const fakeCss = `
      .fake-header-row {
        grid-template-columns: 1fr 170px 190px auto;
      }
      .fake-data-row {
        grid-template-columns: minmax(0, 1fr) 170px 190px 200px;
      }
    `;
    const headerTracks = resolvedTrackList(fakeCss, ".fake-header-row {");
    const rowTracks = resolvedTrackList(fakeCss, ".fake-data-row {");
    expect(headerTracks).not.toBe(rowTracks);
  });
});
