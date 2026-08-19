// DEC-037 amendment (wave 20, B9): src/mail/shell.ts is now vendored from
// docs/design/Chautauqua Comms.dc.html:699-741 (`width:620px; background:#F4F1E8;
// border:1px solid #D3CFC0; border-radius:6px; overflow:hidden; box-shadow:0
// 18px 44px rgba(27,29,23,0.13)`) + DESIGN-RULINGS.md B9,
// rather than an ad-hoc olive palette. This file (1) pins the frame's exact
// values on the rendered HTML and (2) is the mail-side twin of
// test/palette-conformance.test.ts: that scan deliberately excludes
// src/mail/**/*.ts (email clients cannot resolve var(--chq-*), so literals
// are licensed there), which means nothing else checks that the literals
// used inside src/mail are the ones actually vendored from the frame --
// this scan closes that gap by enumerating a named allowlist and failing on
// any hex literal outside it.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderEmailHtml } from "../src/mail/shell";

const REPO_ROOT = join(__dirname, "..");
const MAIL_DIR = join(REPO_ROOT, "src/mail");

// The exact values transcribed from the vendored frame (Chautauqua
// Comms.dc.html:699-741) + DESIGN-RULINGS.md B9. Any hex literal appearing
// under src/mail that is not in this set fails the scan below.
const PERMITTED_MAIL_COLOURS = new Set([
  "#E9E7E2", // page/client ground
  "#F4F1E8", // 560px card background
  "#D3CFC0", // card border
  "#1B1D17", // masthead ink
  "#E1DDCE", // masthead bottom rule / footer top rule
  "#3F4237", // body copy (token table's "Body copy")
  "#4E5C31", // CTA background
  "#F7F9F0", // CTA text
  "#565A4B", // paste-URL line + footer lines
]);

function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

describe("mail shell frame fidelity (DEC-037 amendment, wave 20)", () => {
  it("renders the card, masthead, and body values from the frame", () => {
    const html = renderEmailHtml("Hello there.", {
      eventName: "DevFlow Conf 2027",
      reason: "you're a speaker at this event",
    });

    expect(html).toContain("background:#E9E7E2"); // page ground
    expect(html).toContain("background:#F4F1E8"); // card background
    expect(html).toContain("border:1px solid #D3CFC0"); // card border
    expect(html).toContain("border-radius:4px");
    expect(html).toContain("padding:32px 34px 0 34px"); // card padding (top edge)

    // masthead
    expect(html).toContain("color:#1B1D17");
    expect(html).toContain("font-size:19px;font-weight:700");
    expect(html).toContain("border-bottom:1px solid #E1DDCE");

    // body
    expect(html).toContain("font-size:16px;line-height:1.6;color:#3F4237");

    // no CTA present -> no paste-URL line
    expect(html).not.toContain("Or paste this into your browser:");
  });

  it("renders the CTA (no border), the paste-URL line, and the two-line footer when cta is present", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "you're a speaker at this event",
      cta: { label: "View submission", href: "https://example.test/portal/abc" },
    });

    // CTA
    expect(html).toContain("background:#4E5C31");
    expect(html).toContain("color:#F7F9F0");
    expect(html).toContain("border-radius:4px");
    expect(html).toContain("font-size:15px;font-weight:700");
    expect(html).toContain("padding:14px 22px");
    // No border on the CTA cell/anchor (README Controls: a primary has no border).
    const ctaTdMatch = html.match(/<td style="border-radius:4px;background:#4E5C31;">/);
    expect(ctaTdMatch).not.toBeNull();
    expect(html).not.toMatch(/border:1px solid #3f4a1f/i);

    // paste-URL line
    expect(html).toContain("Or paste this into your browser: https://example.test/portal/abc");
    expect(html).toContain("font-size:13px;line-height:1.6;color:#565A4B;word-break:break-all");

    // footer: two lines
    expect(html).toContain("You are receiving this because you&#39;re a speaker at this event");
    expect(html).toContain("DevFlow Conf 2027 &middot; sent with <span style=\"font-weight:700;\">Chautauqua</span>");
    expect(html).toContain("border-top:1px solid #E1DDCE");
  });

  it("omits the paste-URL line when cta is absent", () => {
    const html = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    expect(html).not.toContain("Or paste this into your browser:");
  });

  it("footer line 2 reads 'sent with Chautauqua' with no event clause when eventName is null/blank", () => {
    const withNull = renderEmailHtml("Body.", { eventName: null, reason: "test" });
    expect(withNull).toContain("sent with <span style=\"font-weight:700;\">Chautauqua</span>");
    expect(withNull).not.toMatch(/null &middot; sent with/);

    const withBlank = renderEmailHtml("Body.", { eventName: "   ", reason: "test" });
    expect(withBlank).toContain("sent with <span style=\"font-weight:700;\">Chautauqua</span>");
  });

  it("the footer's 'Chautauqua' is never a link", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      cta: { label: "Go", href: "https://example.test" },
    });
    // The only <a> in the document is the CTA anchor -- the footer's
    // "Chautauqua" must not add a second one.
    const anchors = html.match(/<a /g) ?? [];
    expect(anchors).toHaveLength(1);
  });

  it("scan: every hex literal under src/mail/**/*.ts is in PERMITTED_MAIL_COLOURS", () => {
    const files = glob(MAIL_DIR, [".ts"]);
    expect(files.length).toBeGreaterThan(0);
    const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
    const violations: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      // Strip line + block comments so prose mentions of hex values in
      // commentary (e.g. this file's own header) never trip the scan.
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      let match: RegExpExecArray | null;
      while ((match = hexRe.exec(src)) !== null) {
        const hex = match[0];
        const upper = hex.toUpperCase();
        if (!PERMITTED_MAIL_COLOURS.has(upper)) {
          violations.push(`${file.replace(REPO_ROOT + "/", "")}: ${hex}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
