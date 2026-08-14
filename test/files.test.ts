import { describe, expect, it } from "vitest";
import {
  allowedUploadExtensions,
  DOCUMENT_MAX_BYTES_FOR_TEST,
  extname,
  FILE_KINDS,
  HEADSHOT_MAX_BYTES_FOR_TEST,
  IMAGE_MAX_BYTES_FOR_TEST,
  isImageContentType,
  isValidFileKind,
  isValidVersionChain,
  sanitizeFilenameForKey,
  TEXT_MAX_BYTES_FOR_TEST,
  uploadHintText,
  validateUpload,
  VIDEO_MAX_BYTES,
  WORKERS_REQUEST_BODY_MAX_BYTES,
  MULTIPART_FRAMING_HEADROOM_BYTES_FOR_TEST,
} from "../src/domain/files";

const BYTES_PER_MB = 1024 * 1024;
const VIDEO_MAX_MB = VIDEO_MAX_BYTES / BYTES_PER_MB;

// w42-a: the hint text must not advertise the video tier for anything
// other than the 'recording' kind.
describe("uploadHintText", () => {
  it(`omits video extensions and the ${VIDEO_MAX_MB} MB note for a non-recording kind`, () => {
    const text = uploadHintText("handout");
    expect(text).not.toMatch(/mp4|mov|webm/);
    expect(text).not.toMatch(new RegExp(`${VIDEO_MAX_MB} MB`));
  });

  it("omits video for no kind at all (default/unbound field)", () => {
    const text = uploadHintText();
    expect(text).not.toMatch(/mp4|mov|webm/);
    expect(text).not.toMatch(new RegExp(`${VIDEO_MAX_MB} MB`));
  });

  it(`includes video extensions and the ${VIDEO_MAX_MB} MB note for kind:'recording'`, () => {
    const text = uploadHintText("recording");
    expect(text).toMatch(/mp4/);
    expect(text).toMatch(new RegExp(`${VIDEO_MAX_MB} MB`));
  });
});

// DEC-879 (wave-22 amendment): the recording cap must be derived from the
// Workers request-body ceiling, with headroom for multipart framing, and no
// upload tier may advertise a size the edge itself would refuse.
describe("VIDEO_MAX_BYTES derivation", () => {
  it("VIDEO_MAX_BYTES + multipart framing headroom fits under the Workers request-body ceiling", () => {
    expect(VIDEO_MAX_BYTES + MULTIPART_FRAMING_HEADROOM_BYTES_FOR_TEST).toBeLessThanOrEqual(
      WORKERS_REQUEST_BODY_MAX_BYTES,
    );
  });

  it("every upload tier constant stays strictly below the Workers request-body ceiling", () => {
    for (const tierBytes of [
      DOCUMENT_MAX_BYTES_FOR_TEST,
      IMAGE_MAX_BYTES_FOR_TEST,
      TEXT_MAX_BYTES_FOR_TEST,
      VIDEO_MAX_BYTES,
      HEADSHOT_MAX_BYTES_FOR_TEST,
    ]) {
      expect(tierBytes).toBeLessThan(WORKERS_REQUEST_BODY_MAX_BYTES);
    }
  });
});

// w10-e (DEC-879 amendment): the accept attribute and the hint text must be
// derived from the SAME per-kind filter — never two independent copies of
// the video-is-recording-only rule.
describe("allowedUploadExtensions", () => {
  it("includes the video extensions for kind:'recording'", () => {
    expect(allowedUploadExtensions("recording")).toEqual(expect.arrayContaining(["mp4", "mov", "webm"]));
  });

  it("excludes the video extensions for kind:'presentation'", () => {
    const exts = allowedUploadExtensions("presentation");
    expect(exts).not.toEqual(expect.arrayContaining(["mp4", "mov", "webm"]));
  });

  it("excludes the video extensions when no kind is given", () => {
    const exts = allowedUploadExtensions();
    expect(exts).not.toEqual(expect.arrayContaining(["mp4", "mov", "webm"]));
  });

  // Drives the comparison from the actual hint text (parsed), never a
  // hand-written literal list — a fixture written to the answer cannot fail.
  it("agrees with uploadHintText's extension list, for every kind and the no-kind case", () => {
    for (const kind of [undefined, ...FILE_KINDS] as const) {
      const hint = uploadHintText(kind);
      const hintExts = Array.from(hint.matchAll(/\.([a-z0-9]+)/g)).map((m) => m[1]);
      expect(new Set(hintExts)).toEqual(new Set(allowedUploadExtensions(kind)));
    }
  });
});

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
  it(`accepts a 90 MB mp4 under the ${VIDEO_MAX_MB} MB video cap`, () => {
    const result = validateUpload({ filename: "talk.mp4", sizeBytes: 90 * BYTES_PER_MB, kind: "recording" });
    expect(result).toEqual({ ok: true, ext: "mp4", servedContentType: "video/mp4" });
  });

  it(`rejects a 100 MB mp4 over the ${VIDEO_MAX_MB} MB video cap`, () => {
    const result = validateUpload({ filename: "talk.mp4", sizeBytes: 100 * BYTES_PER_MB, kind: "recording" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(new RegExp(`${VIDEO_MAX_MB} MB`));
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

  it("FILE_KINDS and allowedUploadExtensions('recording') both include the new members, derived not hand-typed", () => {
    expect(FILE_KINDS).toContain("recording");
    expect(allowedUploadExtensions("recording")).toEqual(expect.arrayContaining(["mp4", "mov", "webm"]));
  });

  it(`accepts a large (94 MB) mp4 for kind:'recording', under the ${VIDEO_MAX_MB} MB cap`, () => {
    const result = validateUpload({ filename: "keynote.mp4", sizeBytes: 94 * BYTES_PER_MB, kind: "recording" });
    expect(result).toEqual({ ok: true, ext: "mp4", servedContentType: "video/mp4" });
  });

  // w42-a: the video tier is admitted ONLY for kind:'recording' — every
  // other FileKind rejects a video extension outright, naming the rule.
  for (const kind of FILE_KINDS.filter((k) => k !== "recording")) {
    for (const ext of ["mp4", "mov", "webm"]) {
      it(`rejects a .${ext} for kind:'${kind}' (video tier is recording-only)`, () => {
        const result = validateUpload({ filename: `clip.${ext}`, sizeBytes: 1024, kind });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message).toBe("Video files are only accepted for a recording deliverable");
          expect(result.fields?.file).toBe("Unsupported file type for this kind");
        }
      });
    }
  }
});

// w42-a: the document/image/text tiers are unaffected by the kind-gated
// video tier — still accept/reject purely on extension + size for every kind.
describe("validateUpload — document tier is unchanged across kinds (w42-a)", () => {
  it("accepts a pdf under the document cap for every FileKind", () => {
    for (const kind of FILE_KINDS) {
      const result = validateUpload({ filename: "deck.pdf", sizeBytes: 1024, kind });
      expect(result).toEqual({ ok: true, ext: "pdf", servedContentType: "application/pdf" });
    }
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
