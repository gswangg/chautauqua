// DEC-696: renderMarkdown must escape-FIRST, then apply a closed allow-list.
// XSS cases are tested explicitly — each must survive as inert escaped text.

import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/markdown";

describe("renderMarkdown", () => {
  it("renders an ATX h2 heading", () => {
    expect(renderMarkdown("## Travel")).toBe("<h2>Travel</h2>");
  });

  it("renders an ATX h3 heading", () => {
    expect(renderMarkdown("### Parking")).toBe("<h3>Parking</h3>");
  });

  it("renders a paragraph", () => {
    expect(renderMarkdown("Bring a badge.")).toBe("<p>Bring a badge.</p>");
  });

  it("renders multiple paragraphs split on blank lines", () => {
    expect(renderMarkdown("First para.\n\nSecond para.")).toBe(
      "<p>First para.</p><p>Second para.</p>",
    );
  });

  it("renders an unordered list", () => {
    expect(renderMarkdown("- One\n- Two\n- Three")).toBe(
      "<ul><li>One</li><li>Two</li><li>Three</li></ul>",
    );
  });

  it("renders bold and italic", () => {
    expect(renderMarkdown("**bold** and *italic*")).toBe(
      "<p><strong>bold</strong> and <em>italic</em></p>",
    );
  });

  it("renders an http(s) link", () => {
    expect(renderMarkdown("[Directions](https://maps.example.com)")).toBe(
      '<p><a href="https://maps.example.com" rel="noopener noreferrer nofollow" target="_blank">Directions</a></p>',
    );
  });

  it("rejects a javascript: href, never emitting an <a> tag for it", () => {
    const out = renderMarkdown("[Click me](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href=");
    // The raw markdown source survives as inert escaped text, never an
    // active link/URL.
    expect(out).toBe("<p>[Click me](javascript:alert(1))</p>");
  });

  it("keeps a raw <script> tag inert as escaped text", () => {
    const out = renderMarkdown('<script>alert("xss")</script>');
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("keeps an onerror= attribute inert as escaped text", () => {
    const out = renderMarkdown('<div onerror="alert(1)">hi</div>');
    expect(out).not.toContain("onerror=\"alert");
    expect(out).toContain("&lt;div");
  });

  it("keeps an <img> tag inert as escaped text", () => {
    const out = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("escapes ampersands, quotes, and apostrophes", () => {
    const out = renderMarkdown(`Ben & Jerry's "ice cream"`);
    expect(out).toBe("<p>Ben &amp; Jerry&#39;s &quot;ice cream&quot;</p>");
  });
});
