import { describe, expect, it } from "vitest";
import { stripCssComments } from "./strip-css-comments";

describe("stripCssComments", () => {
  it("removes a simple single-line comment with no residue", () => {
    expect(stripCssComments(".a { color: red; } /* note */ .b { color: blue; }")).toBe(
      ".a { color: red; }  .b { color: blue; }",
    );
  });

  it("removes a comment containing braces without desyncing brace-matching", () => {
    const src = ".a { /* { not a rule } */ color: red; }";
    expect(stripCssComments(src)).toBe(".a {  color: red; }");
  });

  it("preserves line numbers across a multi-line comment", () => {
    const src = ".a {\n  color: red;\n}\n/*\nthis comment\nspans four lines\n*/\n.b {\n  color: blue;\n}\n";
    const stripped = stripCssComments(src);
    // Every line of `.b`'s rule must land on the SAME line number it started
    // on, so an offender report built off `stripped` can cite the original
    // file's line numbers.
    const strippedLines = stripped.split("\n");
    const srcLines = src.split("\n");
    expect(strippedLines.length).toBe(srcLines.length);
    const bLineIndex = srcLines.findIndex((l) => l.includes(".b {"));
    expect(strippedLines[bLineIndex]).toContain(".b {");
  });

  it("does not touch a legal content: \"/*\" declaration (string-aware)", () => {
    const src = '.a::before { content: "/*"; color: red; }';
    expect(stripCssComments(src)).toBe(src);
  });

  it("does not touch a legal content: '/*' declaration with single quotes", () => {
    const src = ".a::before { content: '/*'; color: red; }";
    expect(stripCssComments(src)).toBe(src);
  });

  it("a real comment following a content string is still stripped", () => {
    const src = '.a::before { content: "/*"; } /* real comment */ .b {}';
    expect(stripCssComments(src)).toBe('.a::before { content: "/*"; }  .b {}');
  });

  it("handles a nested-looking /* /* */ */ comment the way CSS actually parses it (first */ closes it)", () => {
    // CSS comments do not nest -- the first `*/` after the opening `/*`
    // closes the comment, leaving the trailing ` */` as ordinary text
    // (which downstream rule-parsing may treat as garbage, but that is a
    // property of the source, not a bug in the stripper).
    const src = ".a { /* /* nested */ color: red; */ }";
    expect(stripCssComments(src)).toBe(".a {  color: red; */ }");
  });

  it("an unterminated comment runs to end of string rather than throwing", () => {
    expect(stripCssComments(".a { color: red; } /* never closed")).toBe(".a { color: red; } ");
  });

  it("escaped quote inside a string does not end the string early", () => {
    const src = '.a::before { content: "\\"/* still string */"; color: red; }';
    expect(stripCssComments(src)).toBe(src);
  });

  it("is idempotent on text with no comments at all", () => {
    const src = ".a { color: red; }\n.b { color: blue; }\n";
    expect(stripCssComments(src)).toBe(src);
  });
});
