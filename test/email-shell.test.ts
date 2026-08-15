// B9 (DEC-037 amendment, wave 27): every outbound HTML body must render
// through src/mail/shell.ts's renderEmailHtml -- a wordmark, a 560px
// centred table, at most one CTA button, and a footer naming the event +
// the reason the recipient received the mail. This file asserts the shell
// itself; email-shell-sweep.scan.test.ts asserts every send site uses it.

import { describe, expect, it } from "vitest";
import { renderEmailHtml } from "../src/mail/shell";

describe("renderEmailHtml", () => {
  it("renders a 560px centred table (email clients need tables, not flex)", () => {
    const html = renderEmailHtml("Hello there.", {
      eventName: "DevFlow Conf 2027",
      reason: "you're a speaker at this event",
    });
    expect(html).toContain('width="560"');
    expect(html).toContain("560px");
    // No flex/grid layout anywhere -- table-based only.
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display:grid");
  });

  it("shows the event name as a text wordmark, or 'Chautauqua' when null", () => {
    const withEvent = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    expect(withEvent).toContain("DevFlow Conf 2027");

    const withoutEvent = renderEmailHtml("Body.", { eventName: null, reason: "test" });
    expect(withoutEvent).toContain("Chautauqua");
  });

  it("renders the body via textToHtml (paragraphs, not a bare string)", () => {
    const html = renderEmailHtml("First paragraph.\n\nSecond paragraph.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
    });
    expect(html).toContain("<p>First paragraph.</p>");
    expect(html).toContain("<p>Second paragraph.</p>");
  });

  it("escapes merge-field text -- a body containing <script> survives as text, never executes", () => {
    const html = renderEmailHtml('Click here <script>alert(1)</script> to continue.', {
      eventName: "DevFlow Conf 2027",
      reason: "test",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders no button when cta is absent", () => {
    const html = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    expect(html.match(/<a /g) ?? []).toHaveLength(0);
  });

  it("renders at most ONE olive button (no border, per README Controls: a primary has no border) when cta is present", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      cta: { label: "View submission", href: "https://example.test/portal/abc" },
    });
    const anchors = html.match(/<a /g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(html).toContain("View submission");
    // The href appears twice: once as the anchor's href, once in the
    // paste-this-URL fallback line beneath the button.
    expect(html.match(/https:\/\/example\.test\/portal\/abc/g) ?? []).toHaveLength(2);
    expect(html).toContain("background:#4E5C31");
  });

  it("escapes the cta label and href", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      cta: { label: '<b>Click</b>', href: 'https://example.test/?x="y"' },
    });
    expect(html).not.toContain("<b>Click</b>");
    expect(html).toContain("&lt;b&gt;Click&lt;/b&gt;");
  });

  it("footer names the event and states the reason the recipient received the mail", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "you're a speaker at this event",
    });
    expect(html).toContain("DevFlow Conf 2027");
    expect(html).toContain("you&#39;re a speaker at this event");
  });

  it("has no image tags and no multi-column layout", () => {
    const html = renderEmailHtml("Body.", {
      eventName: "DevFlow Conf 2027",
      reason: "test",
      cta: { label: "Go", href: "https://example.test" },
    });
    expect(html).not.toContain("<img");
  });

  it("is a complete HTML document", () => {
    const html = renderEmailHtml("Body.", { eventName: "DevFlow Conf 2027", reason: "test" });
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
  });
});
