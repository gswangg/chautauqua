// w1-g, DEC-747 amendment: MARKDOWN_SYNTAX_HINT is the plain-language
// statement of renderMarkdown's closed allow-list, shown next to the wiki
// resource editor. These tests keep the hint and the allow-list from
// drifting apart: every construct the hint names must actually survive
// renderMarkdown, and the hint must never claim support for a construct
// renderMarkdown escapes.

import { describe, expect, it } from "vitest";
import { MARKDOWN_SYNTAX_HINT, renderMarkdown } from "../src/lib/markdown";

describe("MARKDOWN_SYNTAX_HINT names exactly what renderMarkdown supports", () => {
  it("## heading survives as <h2>", () => {
    expect(renderMarkdown("## Travel")).toContain("<h2>");
  });

  it("### heading survives as <h3>", () => {
    expect(renderMarkdown("### Parking")).toContain("<h3>");
  });

  it("blank-line-separated paragraphs survive as two <p> tags", () => {
    const out = renderMarkdown("First para.\n\nSecond para.");
    expect(out.match(/<p>/g)?.length).toBe(2);
  });

  it("- list items survive as <ul><li>", () => {
    const out = renderMarkdown("- One\n- Two");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>");
  });

  it("**bold** survives as <strong>", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("*italic* survives as <em>", () => {
    expect(renderMarkdown("*italic*")).toContain("<em>italic</em>");
  });

  it("[text](https://...) links survive as <a href>", () => {
    const out = renderMarkdown("[Directions](https://maps.example.com)");
    expect(out).toContain("<a href=\"https://maps.example.com\"");
  });

  it("the hint text advertises exactly these constructs", () => {
    expect(MARKDOWN_SYNTAX_HINT).toContain("##");
    expect(MARKDOWN_SYNTAX_HINT).toContain("###");
    expect(MARKDOWN_SYNTAX_HINT).toContain("blank-line");
    expect(MARKDOWN_SYNTAX_HINT).toContain("- lists");
    expect(MARKDOWN_SYNTAX_HINT).toContain("**bold**");
    expect(MARKDOWN_SYNTAX_HINT).toContain("*italic*");
    expect(MARKDOWN_SYNTAX_HINT).toContain("[text](https://...)");
  });

  it("the hint never claims raw HTML or single-newline line breaks are supported", () => {
    // renderMarkdown escapes every raw tag and joins single-newline lines
    // within a paragraph with a space rather than a <br>, so the hint must
    // not promise either -- it explicitly disclaims raw HTML/other syntax.
    expect(MARKDOWN_SYNTAX_HINT.toLowerCase()).not.toContain("<br");
    expect(MARKDOWN_SYNTAX_HINT.toLowerCase()).toContain("raw html and other markdown syntax are not supported");
  });

  it("a raw <script> tag named nowhere in the hint stays inert, as the hint implies", () => {
    const out = renderMarkdown("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
  });

  it("a single newline within a paragraph (no line break the hint doesn't mention) is joined, not turned into <br>", () => {
    const out = renderMarkdown("Line one.\nLine two.");
    expect(out).not.toContain("<br");
    expect(out).toBe("<p>Line one. Line two.</p>");
  });
});
