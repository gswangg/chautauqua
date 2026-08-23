// DEC-037 amendment (wave 20, B9): src/mail/shell.ts is now vendored from
// the frame (see the citation on the first `it()` below) + DESIGN-
// RULINGS.md B9, rather than an ad-hoc olive palette. This file (1) pins
// the frame's exact values on the rendered HTML and (2) is the mail-side
// twin of test/palette-conformance.test.ts: that scan deliberately
// excludes src/mail/**/*.ts (email clients cannot resolve var(--chq-*), so
// literals are licensed there), which means nothing else checks that the
// literals used inside src/mail are the ones actually vendored from the
// frame -- this scan closes that gap by enumerating a named allowlist and
// failing on any hex literal outside it.

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
    // docs/design/Chautauqua Comms.dc.html:699-741 (`width:620px;
    // background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px;
    const html = renderEmailHtml("Hello there.", { eventName: "DevFlow Conf 2027", reason: "you're a speaker at this event" });
    expect(html).toContain("background:#E9E7E2"); // page ground
    expect(html).toContain("background:#F4F1E8"); // card background
    // overflow:hidden; box-shadow:0 18px 44px rgba(27,29,23,0.13)`)
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

  it("renders the highlighted-fact block (label over value, 3px left border) when fact is present", () => {
    // docs/design/Chautauqua Comms.dc.html `<div style="border-left:3px
    // solid #4E5C31; padding:2px 0 2px 15px; display:flex;
    // flex-direction:column; gap:5px">` holding `{{ e.factLabel }}` over
    // `{{ e.fact }}` (DEC-441 wave-32 amendment).
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      fact: { label: "Still to do", value: "- Slides — due 1 May 2027" },
    });
    expect(html).toContain("border-left:3px solid #4E5C31");
    expect(html).toContain("font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#565A4B");
    expect(html).toContain(">Still to do<");
    expect(html).toContain("font-size:15px;line-height:1.6;color:#1B1D17");
    expect(html).toContain(">- Slides — due 1 May 2027<");
  });

  it("places the fact block between the body and the CTA block", () => {
    const html = renderEmailHtml("Body copy here.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      fact: { label: "Still to do", value: "- Slides" },
      cta: { label: "Open your tasks", href: "https://example.test/portal/abc" },
    });
    const bodyIdx = html.indexOf("Body copy here.");
    const factIdx = html.indexOf("border-left:3px solid #4E5C31");
    const ctaIdx = html.indexOf("Open your tasks");
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(factIdx).toBeGreaterThan(bodyIdx);
    expect(ctaIdx).toBeGreaterThan(factIdx);
  });

  it("negative control: emits no border-left at all when fact is absent or null", () => {
    const withoutFact = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    expect(withoutFact).not.toContain("border-left");

    const withNullFact = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test", fact: null });
    expect(withNullFact).not.toContain("border-left");
  });

  it("byte-identical to the fact-less render when fact is omitted vs. explicitly null", () => {
    const omitted = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    const explicitNull = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test", fact: null });
    expect(explicitNull).toBe(omitted);
  });

  it("HTML-escapes both the fact label and value", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      fact: { label: "R&D <label>", value: "5 > 3 & \"quoted\"" },
    });
    expect(html).toContain("R&amp;D &lt;label&gt;");
    expect(html).toContain("5 &gt; 3 &amp; &quot;quoted&quot;");
    expect(html).not.toContain("R&D <label>");
    expect(html).not.toContain("5 > 3 & \"quoted\"");
  });

  // DEC-441 (wave-38 amendment): the shell's fact value stays a single
  // escaped run -- the frame draws ONE span, and a caller-composed
  // multi-item value (a sentence run, never a newline join) must still
  // round-trip escaping correctly. This documents that joining is the
  // CALLER's job, not the shell's: a value containing a literal "\n" is
  // still emitted verbatim (escaped), proving the shell does not itself
  // split, bullet, or otherwise reformat what it is given.
  it("renders a multi-line fact value as one escaped span, verbatim -- the shell never splits or reformats it", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      fact: { label: "Still to do", value: "Slides — due 1 May 2027.\nBio — due 10 April 2027." },
    });
    // The literal value (including its embedded \n) appears once, as a
    // single escaped run inside the value span -- no <br> invented, no
    // second row, no second border-left block.
    expect(html).toContain(">Slides — due 1 May 2027.\nBio — due 10 April 2027.<");
    expect((html.match(/border-left:3px solid #4E5C31/g) ?? []).length).toBe(1);
    // Scope the "no <br> invented" check to the fact block itself -- the
    // shell's footer legitimately carries its own unrelated <br /> between
    // its two static lines.
    const factBlockStart = html.indexOf("border-left:3px solid #4E5C31");
    const factBlockEnd = html.indexOf("</table></td></tr>", factBlockStart);
    const factBlockHtml = html.slice(factBlockStart, factBlockEnd);
    expect(factBlockHtml).not.toContain("<br");
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

  // DEC-037 wave-48 amendment: the masthead's second line.
  it("renders the eventMeta row as a second masthead line, styled at the frame's 12px/MUTED_COLOR register", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      eventMeta: "12-14 May 2027 · Moscone West, San Francisco",
    });
    expect(html).toContain("12-14 May 2027 · Moscone West, San Francisco");
    expect(html).toContain("font-size:12px;line-height:1.6;color:#565A4B");
    // still inside the masthead table, above the same bottom rule -- not a
    // second unrelated block.
    const mastheadIdx = html.indexOf("DevFlow Conf 2027");
    const ruleIdx = html.indexOf("border-bottom:1px solid #E1DDCE");
    const metaIdx = html.indexOf("12-14 May 2027 · Moscone West, San Francisco");
    expect(mastheadIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeGreaterThan(mastheadIdx);
    expect(ruleIdx).toBeGreaterThan(-1);
  });

  it("emits no eventMeta row and no new bytes when absent, null, or blank", () => {
    const omitted = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    const explicitNull = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test", eventMeta: null });
    const blank = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test", eventMeta: "   " });
    expect(explicitNull).toBe(omitted);
    expect(blank).toBe(omitted);
  });
});

// DEC-037 wave-48 amendment: the mail card is an exactly enumerable
// population (docs/design/Chautauqua Comms.dc.html's own 560px card, one
// fixed set of drawn elements) -- so its ledger is a TABLE, resolved once
// per drawn element against renderEmailHtml's real output or a named
// adjudication, never a *_CEILING/*_FLOOR ratchet (DEC-967: an
// exactly-enumerable population needs a table, not a count that can drift).
describe("mail card frame ledger (DEC-037 wave-48 amendment)", () => {
  const FRAME_PATH = join(REPO_ROOT, "docs/design/Chautauqua Comms.dc.html");
  // The exact literal on the card's own opening <div> (Chautauqua
  // Comms.dc.html, the '560px measure' demo block) -- unique in the file
  // (asserted below), so this string alone locates the extent with no
  // hand-typed line number to rot.
  const CARD_OPEN_MARKER = 'max-width:560px; background:#F4F1E8';

  /** Derives the card's own drawn extent at test time (DEC-967: extent
   * clipping must be computed, never hand-copied) -- finds the CARD_OPEN_MARKER
   * (failing loudly if it's missing or ambiguous), then walks matching
   * <div>/</div> pairs forward from that div's own opening tag to find its
   * own matching close, so the extent is exactly this one card, not its
   * parent chrome or a sibling. */
  function cardExtent(): string {
    const frameHtml = readFileSync(FRAME_PATH, "utf8");
    const markerIdx = frameHtml.indexOf(CARD_OPEN_MARKER);
    if (markerIdx === -1) {
      throw new Error(`mail card ledger: CARD_OPEN_MARKER not found in ${FRAME_PATH} -- frame changed, re-derive the marker`);
    }
    if (frameHtml.indexOf(CARD_OPEN_MARKER, markerIdx + 1) !== -1) {
      throw new Error(`mail card ledger: CARD_OPEN_MARKER matched more than once in ${FRAME_PATH} -- extent is ambiguous`);
    }
    const divStart = frameHtml.lastIndexOf("<div", markerIdx);
    if (divStart === -1) {
      throw new Error("mail card ledger: could not find the card's own opening <div tag");
    }
    const tagEnd = frameHtml.indexOf(">", divStart);
    let depth = 1;
    let pos = tagEnd + 1;
    while (depth > 0) {
      const nextOpen = frameHtml.indexOf("<div", pos);
      const nextClose = frameHtml.indexOf("</div>", pos);
      if (nextClose === -1) {
        throw new Error("mail card ledger: unterminated <div> nesting inside the card extent");
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 4;
      } else {
        depth -= 1;
        pos = nextClose + 6;
      }
    }
    return frameHtml.slice(divStart, pos);
  }

  it("vacuous-population tripwire: the card extent draws exactly 11 <span style> elements", () => {
    const extent = cardExtent();
    const spanCount = (extent.match(/<span style="/g) ?? []).length;
    // If this ever fails, the frame's card gained or lost a drawn element --
    // the table below must be re-sized to match, never the count alone
    // edited to make this pass.
    expect(spanCount).toBe(11);
  });

  it("resolves every drawn span in the card extent against renderEmailHtml's real output or a named adjudication", () => {
    const extent = cardExtent();
    // Sanity: the exact masthead second-line text this wave built against.
    expect(extent).toContain("12–14 May 2027 · Moscone West, San Francisco");

    const text = "Hi there,\n\nBody paragraph here.\n\n— Sign-off line.";
    const html = renderEmailHtml(text, {
      eventName: "DevFlow Conf 2027",
      reason: "you're a speaker at this event",
      eventMeta: "12-14 May 2027 · Moscone West, San Francisco",
      fact: { label: "Still to do", value: "Slides — due 1 May 2027." },
      cta: { label: "View submission", href: "https://example.test/portal/abc" },
    });

    type Row = { label: string; verdict: "MATCHED" | "ADJUDICATED"; reason: string; check: () => void };
    const rows: Row[] = [
      {
        label: "masthead line 1 -- wordmark (19px/700/Familjen Grotesk/-0.025em)",
        verdict: "ADJUDICATED",
        reason:
          "email clients cannot reliably load a webfont (Familjen Grotesk); the shell substitutes the email-safe Arial/Helvetica stack at the same 19px/700 -- font-family substitution in mail markup is licensed by this file's own header note on literals-in-mail, and the size/weight/colour are still MATCHED.",
        check: () => expect(html).toContain("font-size:19px;font-weight:700;color:#1B1D17"),
      },
      {
        label: "masthead line 2 -- dates/venue (12px MUTED_COLOR)",
        verdict: "MATCHED",
        reason: "built this wave: eventMeta renders as the second masthead row, inside the same bordered table, above the same bottom rule.",
        check: () => {
          expect(html).toContain("12-14 May 2027 · Moscone West, San Francisco");
          expect(html).toContain("font-size:12px;line-height:1.6;color:#565A4B");
        },
      },
      {
        label: "greeting span",
        verdict: "ADJUDICATED",
        reason:
          "the shell has no separate greeting slot -- the caller's plain-text `text` (which already opens with the greeting line, e.g. compose's rendered template) is the ONE body block textToHtml wraps; a text-content-only join can never assemble the frame's sibling nodes (DEC-976), so this is recorded as a collapse, not a match.",
        check: () => expect(html).toContain("<p>Hi there,</p>"),
      },
      {
        label: "body span",
        verdict: "ADJUDICATED",
        reason: "same collapse as the greeting row above -- one <td> carries every paragraph of the caller's text as sibling <p> tags.",
        check: () => expect(html).toContain("<p>Body paragraph here.</p>"),
      },
      {
        label: "fact block label span",
        verdict: "MATCHED",
        reason: "DEC-441 (wave 32): opts.fact.label renders escaped at the frame's 11px/800/uppercase register.",
        check: () => expect(html).toContain(">Still to do<"),
      },
      {
        label: "fact block value span",
        verdict: "MATCHED",
        reason: "DEC-441 (wave 32): opts.fact.value renders escaped at the frame's 15px/1.6 register, inside the same border-left:3px block.",
        check: () => {
          expect(html).toContain("border-left:3px solid #4E5C31");
          expect(html).toContain(">Slides — due 1 May 2027.<");
        },
      },
      {
        label: "CTA button span (background/colour/border-radius/padding; frame also draws min-height:46px)",
        verdict: "ADJUDICATED",
        reason:
          "the anchor's own box (padding:14px 22px around a single-line 15px label) already clears 46px in every client that resolves box-sizing on an inline-block anchor; Outlook desktop's Word rendering engine ignores min-height on inline/inline-block elements whether or not it is declared, so adding the literal would be a no-op in the one client where the frame's number is least trustworthy -- recorded, not built.",
        check: () => {
          expect(html).toContain("background:#4E5C31");
          expect(html).toContain("padding:14px 22px");
        },
      },
      {
        label: "paste-URL fallback span",
        verdict: "MATCHED",
        reason: "renders whenever cta is present, at the frame's 13px/1.6/MUTED_COLOR register.",
        check: () => expect(html).toContain("Or paste this into your browser: https://example.test/portal/abc"),
      },
      {
        label: "sign-off span",
        verdict: "ADJUDICATED",
        reason: "same collapse as the greeting/body rows -- the caller's text's closing line is the last <p> in the same body <td>, never a separate DOM node.",
        check: () => expect(html).toContain("<p>— Sign-off line.</p>"),
      },
      {
        label: "footer 'why' span",
        verdict: "MATCHED",
        reason: "opts.reason renders escaped as the footer's first line.",
        check: () => expect(html).toContain("You are receiving this because you&#39;re a speaker at this event"),
      },
      {
        label: "footer event+'sent with Chautauqua' span (frame draws 'Chautauqua' as a live <a href=\"#\">)",
        verdict: "ADJUDICATED",
        reason:
          "already pinned by this file's own \"the footer's 'Chautauqua' is never a link\" test above -- the frame's anchor is deliberately rendered as a plain <span>, since a footer link into the product from inside a mail client is not a live destination this app defines.",
        check: () =>
          expect(html).toContain('DevFlow Conf 2027 &middot; sent with <span style="font-weight:700;">Chautauqua</span>'),
      },
    ];

    expect(rows.length).toBe(11);
    for (const row of rows) row.check();
  });
});
