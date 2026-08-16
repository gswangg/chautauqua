// DEC-582 Amendment (wave 48): the anonymous event hub (GET /) stops being a
// 900px bordered card. docs/design/README.md §Widths: "Chrome is always full
// bleed. The header rule, the toolbar rules and section rules run edge to
// edge; only the content inside them is constrained." .chq-home-shell now
// carries no max-width/border/border-radius/background of its own; the
// header/body/footer keep their own rules (full bleed) while their content
// sits in a shared centred measure via one padding-inline expression.

import { describe, expect, it } from "vitest";
import { HOME_CSS } from "../src/routes/public/home.css";

function rule(selector: string): string {
  const re = new RegExp(`${selector.replace(/[.-]/g, (c) => (c === "." ? "\\." : c))}\\s*\\{([^}]*)\\}`);
  const m = re.exec(HOME_CSS);
  expect(m, `${selector} not found in HOME_CSS`).not.toBeNull();
  return m![1]!;
}

describe("DEC-582 Amendment (wave 48): .chq-home-shell is full bleed, not a 900px card", () => {
  it(".chq-home-shell declares no border, no border-radius and no max-width: 900px", () => {
    const shell = rule(".chq-home-shell");
    expect(shell).not.toMatch(/\bborder\s*:/);
    expect(shell).not.toMatch(/border-radius\s*:/);
    expect(shell).not.toMatch(/max-width\s*:\s*900px/);
  });

  it("header and footer are full-bleed chrome (44px gutters, no max-width); the body is an 820 container whose content box is 732 (820 - 2x44)", () => {
    const header = rule(".chq-home-header");
    const body = rule(".chq-home-body");
    const footer = rule(".chq-home-footer");

    // Full bleed: header/footer carry no max-width -- the vendored frame
    // (docs/design/Chautauqua Home.dc.html:33, :101) runs them edge to edge
    // with 44px gutters, not a centred 820.
    for (const block of [header, footer]) {
      expect(block).not.toMatch(/max-width\s*:/);
      expect(block).toMatch(/padding-inline:\s*44px;/);
    }

    // The body is the frame's 820 CONTAINER (:38 max-width:820px; margin:0
    // auto; padding:36px 44px 40px); its CONTENT box is 820 - 2x44 = 732.
    expect(body).toMatch(/max-width:\s*820px;/);
    expect(body).toMatch(/margin-inline:\s*auto;/);
    expect(body).toMatch(/padding-inline:\s*44px;/);

    // The footer's sunk fill (background) still spans edge to edge -- it
    // lives on the full-bleed rule, not on some inner wrapper.
    expect(footer).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
  });

  it("the phone breakpoint keeps its own 16px padding-inline override for header/body/footer", () => {
    const media = /@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/.exec(HOME_CSS);
    expect(media).not.toBeNull();
    const block = media![1]!;
    expect(block).toMatch(/\.chq-home-header\s*\{[^}]*padding-inline:\s*16px;/);
    expect(block).toMatch(/\.chq-home-body\s*\{[^}]*padding-inline:\s*16px;/);
    expect(block).toMatch(/\.chq-home-footer\s*\{[^}]*padding-inline:\s*16px;/);
  });
});

describe("DEC-582 Amendment (wave 48): .chq-home-action-quiet drops the 44px phone tap floor", () => {
  it("declares no min-height (it is a desktop text link, not a tap target)", () => {
    const quiet = rule(".chq-home-action-quiet");
    expect(quiet).not.toMatch(/min-height\s*:/);
  });

  it("leaves the primary and secondary action heights alone", () => {
    expect(rule(".chq-home-action-primary")).toMatch(/min-height:\s*48px/);
    expect(rule(".chq-home-action-secondary")).toMatch(/min-height:\s*46px/);
  });
});
