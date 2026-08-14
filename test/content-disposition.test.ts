// DEC-425 (wave-24 amendment): contentDispositionAttachment is the ONE
// owner of every HTTP Content-Disposition header value in this repo.
import { describe, expect, it } from "vitest";
import { contentDispositionAttachment } from "../src/domain/files";

describe("contentDispositionAttachment (DEC-425 wave-24 amendment)", () => {
  it("plain ASCII filenames round-trip byte-identical to the old hand-rolled form", () => {
    expect(contentDispositionAttachment("slides.pdf")).toBe('attachment; filename="slides.pdf"');
    expect(contentDispositionAttachment("My Talk (final).pptx")).toBe(
      'attachment; filename="My Talk (final).pptx"',
    );
  });

  it("CRLF cannot break out of the quoted string", () => {
    const result = contentDispositionAttachment('evil\r\nX-Injected: yes\r\n.pdf');
    expect(result).not.toMatch(/[\r\n]/);
    expect(result).toBe('attachment; filename="evilX-Injected: yes.pdf"');
  });

  it('double quote cannot break out of the quoted string', () => {
    const result = contentDispositionAttachment('evil".pdf');
    expect(result).toBe('attachment; filename="evil.pdf"');
    // No unescaped quote or backslash anywhere in the fallback param.
    const fallbackMatch = /filename="([^"]*)"/.exec(result);
    expect(fallbackMatch?.[1]).not.toMatch(/["\\]/);
  });

  it("a bare backslash is treated as a path separator, matching '/'", () => {
    // "evil\.pdf" (one backslash) - the segment after the last separator is
    // taken, same rule as a forward slash.
    const withBackslash = contentDispositionAttachment("evil\\.pdf");
    expect(withBackslash).toBe('attachment; filename=".pdf"');
  });

  it("a CJK filename yields both parameters and an all-ASCII header", () => {
    const result = contentDispositionAttachment("スライド.pdf");
    expect(result).toContain('filename="');
    expect(result).toContain("filename*=UTF-8''");
    expect(result).toContain(encodeURIComponent("スライド.pdf"));
    for (const ch of result) {
      expect(ch.codePointAt(0)!).toBeLessThan(0x80);
    }
  });

  it("a name that survives as nothing (only quotes/backslashes) falls back to 'download'", () => {
    expect(contentDispositionAttachment('"\\"\\')).toBe('attachment; filename="download"');
    expect(contentDispositionAttachment("")).toBe('attachment; filename="download"');
  });

  it("../../etc/passwd collapses to passwd", () => {
    expect(contentDispositionAttachment("../../etc/passwd")).toBe('attachment; filename="passwd"');
    expect(contentDispositionAttachment("..\\..\\etc\\passwd")).toBe('attachment; filename="passwd"');
  });

  it("strips C0 controls beyond CR/LF", () => {
    const result = contentDispositionAttachment("evil\x00\x07name.pdf");
    expect(result).toBe('attachment; filename="evilname.pdf"');
  });

  it("never produces a header value with a code point >= 0x80", () => {
    const inputs = ["normal.pdf", "スライド.pdf", "\r\nX-Injected: yes", '"\\', "", "café.pdf"];
    for (const input of inputs) {
      const result = contentDispositionAttachment(input);
      for (const ch of result) {
        expect(ch.codePointAt(0)!).toBeLessThan(0x80);
      }
    }
  });
});
