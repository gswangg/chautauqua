import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  extname,
  FILE_KINDS,
  isImageContentType,
  isValidFileKind,
  isValidVersionChain,
  sanitizeFilenameForKey,
  validateUpload,
} from "../src/domain/files";

describe("extname", () => {
  it("lowercases and strips the leading dot", () => {
    expect(extname("Slides.PDF")).toBe("pdf");
  });

  it("returns '' when there's no extension", () => {
    expect(extname("README")).toBe("");
  });

  it("returns '' for a trailing dot with nothing after it", () => {
    expect(extname("file.")).toBe("");
  });
});

describe("isValidFileKind", () => {
  it("accepts the three DEC-003 literals", () => {
    expect(isValidFileKind("presentation")).toBe(true);
    expect(isValidFileKind("poster")).toBe(true);
    expect(isValidFileKind("handout")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidFileKind("slides")).toBe(false);
    expect(isValidFileKind(undefined)).toBe(false);
  });
});

describe("validateUpload", () => {
  it("accepts a pdf under the 25 MB document cap", () => {
    const result = validateUpload({ filename: "deck.pdf", sizeBytes: 10 * 1024 * 1024, kind: "presentation" });
    expect(result).toEqual({ ok: true, ext: "pdf", servedContentType: "application/pdf" });
  });

  it("rejects a pdf over the 25 MB document cap", () => {
    const result = validateUpload({ filename: "deck.pdf", sizeBytes: 26 * 1024 * 1024, kind: "presentation" });
    expect(result.ok).toBe(false);
  });

  it("accepts a jpg under the 8 MB image cap", () => {
    const result = validateUpload({ filename: "headshot.jpg", sizeBytes: 4 * 1024 * 1024, kind: "poster" });
    expect(result).toEqual({ ok: true, ext: "jpg", servedContentType: "image/jpeg" });
  });

  it("rejects an image over the 8 MB cap even though it's under the document cap", () => {
    const result = validateUpload({ filename: "poster.png", sizeBytes: 10 * 1024 * 1024, kind: "poster" });
    expect(result.ok).toBe(false);
  });

  it("forces txt to text/plain", () => {
    const result = validateUpload({ filename: "notes.txt", sizeBytes: 100, kind: "handout" });
    expect(result).toEqual({ ok: true, ext: "txt", servedContentType: "text/plain" });
  });

  it("forces md to text/plain — never HTML, even though markdown often renders as HTML", () => {
    const result = validateUpload({ filename: "notes.md", sizeBytes: 100, kind: "handout" });
    expect(result).toEqual({ ok: true, ext: "md", servedContentType: "text/plain" });
  });

  it("never returns an HTML content type for any allowed extension", () => {
    const exts = ["pdf", "ppt", "pptx", "key", "odp", "zip", "png", "jpg", "jpeg", "webp", "gif", "txt", "md"];
    for (const ext of exts) {
      const result = validateUpload({ filename: `f.${ext}`, sizeBytes: 100, kind: "handout" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.servedContentType).not.toMatch(/html/i);
      }
    }
  });

  it("rejects an unlisted extension", () => {
    const result = validateUpload({ filename: "malware.exe", sizeBytes: 100, kind: "handout" });
    expect(result.ok).toBe(false);
  });

  it("rejects an html extension explicitly (defense in depth)", () => {
    const result = validateUpload({ filename: "index.html", sizeBytes: 100, kind: "handout" });
    expect(result.ok).toBe(false);
  });

  it("rejects a file with no extension", () => {
    const result = validateUpload({ filename: "README", sizeBytes: 100, kind: "handout" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid kind", () => {
    const result = validateUpload({ filename: "deck.pdf", sizeBytes: 100, kind: "slides" });
    expect(result.ok).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const result = validateUpload({ filename: "deck.pdf", sizeBytes: 0, kind: "handout" });
    expect(result.ok).toBe(false);
  });

  // DEC-425: caps the attacker-controlled filename length before extension lookup.
  it("rejects a filename over MAX_NAME_LENGTH (200) with an InvalidUpload", () => {
    const filename = "x".repeat(201) + ".pdf";
    const result = validateUpload({ filename, sizeBytes: 100, kind: "handout" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields?.file).toBeDefined();
  });

  it("accepts a filename exactly AT MAX_NAME_LENGTH (200) (off-by-one)", () => {
    const filename = "x".repeat(196) + ".pdf"; // 196 + 4 = 200
    expect(filename.length).toBe(200);
    const result = validateUpload({ filename, sizeBytes: 100, kind: "handout" });
    expect(result.ok).toBe(true);
  });
});

// DEC-879: a recording is a deliverable like any other file kind.
describe("validateUpload — recording (DEC-879)", () => {
  it("accepts a 186 MB mp4 under the 250 MB video cap", () => {
    const result = validateUpload({ filename: "talk.mp4", sizeBytes: 186 * 1024 * 1024, kind: "recording" });
    expect(result).toEqual({ ok: true, ext: "mp4", servedContentType: "video/mp4" });
  });

  it("rejects a 300 MB mp4 over the 250 MB video cap", () => {
    const result = validateUpload({ filename: "talk.mp4", sizeBytes: 300 * 1024 * 1024, kind: "recording" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/250 MB/);
  });

  it("accepts mov and webm too, never with an HTML/sniffable content type", () => {
    for (const [filename, expectedType] of [
      ["clip.mov", "video/quicktime"],
      ["clip.webm", "video/webm"],
    ] as const) {
      const result = validateUpload({ filename, sizeBytes: 1024, kind: "recording" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.servedContentType).toBe(expectedType);
        expect(result.servedContentType).not.toMatch(/html/i);
      }
    }
  });

  it("never serves an mp4 with an HTML/sniffable content type regardless of declared kind", () => {
    const result = validateUpload({ filename: "recording.mp4", sizeBytes: 1024, kind: "recording" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.servedContentType).toBe("video/mp4");
  });

  it("FILE_KINDS and ALLOWED_UPLOAD_EXTENSIONS both include the new members, derived not hand-typed", () => {
    expect(FILE_KINDS).toContain("recording");
    expect(ALLOWED_UPLOAD_EXTENSIONS).toEqual(expect.arrayContaining(["mp4", "mov", "webm"]));
  });
});

describe("isImageContentType", () => {
  it("is true for image/* content types", () => {
    expect(isImageContentType("image/png")).toBe(true);
  });

  it("is false for everything else", () => {
    expect(isImageContentType("application/pdf")).toBe(false);
    expect(isImageContentType("text/plain")).toBe(false);
  });
});

describe("sanitizeFilenameForKey", () => {
  it("strips path separators", () => {
    expect(sanitizeFilenameForKey("../../etc/passwd")).toBe("passwd");
  });

  it("replaces unsafe characters", () => {
    expect(sanitizeFilenameForKey("my deck (final)!.pdf")).toBe("my_deck__final__.pdf");
  });

  it("falls back to 'file' for an empty filename", () => {
    expect(sanitizeFilenameForKey("")).toBe("file");
  });
});

describe("isValidVersionChain", () => {
  it("is valid when there's no replacesFileId target", () => {
    expect(isValidVersionChain(null, { submissionId: "s1", kind: "presentation" })).toBe(true);
    expect(isValidVersionChain(undefined, { submissionId: "s1", kind: "presentation" })).toBe(true);
  });

  it("is valid when the target is the same submission and kind", () => {
    const target = { submissionId: "s1", kind: "presentation" };
    expect(isValidVersionChain(target, { submissionId: "s1", kind: "presentation" })).toBe(true);
  });

  it("is invalid when the target is a different submission", () => {
    const target = { submissionId: "s2", kind: "presentation" };
    expect(isValidVersionChain(target, { submissionId: "s1", kind: "presentation" })).toBe(false);
  });

  it("is invalid when the target is a different kind", () => {
    const target = { submissionId: "s1", kind: "poster" };
    expect(isValidVersionChain(target, { submissionId: "s1", kind: "presentation" })).toBe(false);
  });
});
