// DEC-020 (wave-67 amendment): every human-readable MB figure in
// src/domain/files.ts must be interpolated from the tier constant that owns
// it -- never a second hand-typed copy of the number the constant already
// declares. This scan enumerates every string/template literal in the file
// (comments and constant *declarations* like `25 * BYTES_PER_MB` are exempt
// -- only the rendered-copy shape "<digits> MB" inside a literal counts) and
// fails if any hand-typed "<digits> MB" survives.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MAX_BYTES,
  HEADSHOT_MAX_BYTES,
  IMAGE_MAX_BYTES,
  TEXT_MAX_BYTES,
  uploadHintText,
  validateUpload,
  validateHeadshotUpload,
  VIDEO_MAX_BYTES,
} from "../src/domain/files";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES_TS = join(HERE, "..", "src", "domain", "files.ts");
const BYTES_PER_MB = 1024 * 1024;

/** Strips // line comments and /* *\/ block comments (including JSDoc), so
 * prose mentioning "25 MB" in a doc-comment doesn't false-positive the
 * hand-typed-literal detector below -- only code (declarations, strings,
 * template literals) survives. */
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// The rendered-copy shape: one or more digits, optional whitespace, then
// "MB" as a whole word. A constant declaration like `25 * BYTES_PER_MB`
// never matches this -- the digits there are followed by ` * BYTES_PER_MB`,
// not directly by `MB`. An interpolated template literal like
// `${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB` never matches either -- the
// character immediately before " MB" is `}`, not a digit.
const HAND_TYPED_MB_RE = /\d+(?:\.\d+)?\s*MB\b/g;

function findHandTypedMb(src: string): string[] {
  return stripComments(src).match(HAND_TYPED_MB_RE) ?? [];
}

describe("src/domain/files.ts never hand-types a <digits> MB rendered figure (DEC-020, wave-67 amendment)", () => {
  it("the file has no hand-typed '<digits> MB' string-literal figure", () => {
    const src = readFileSync(FILES_TS, "utf-8");
    const found = findHandTypedMb(src);
    expect(found, `hand-typed MB figures found: ${found.join(", ")}`).toEqual([]);
  });

  // Negative control: the detector DOES fire on a synthetic hand-typed
  // message, proving it isn't vacuously passing.
  it("negative control: the detector flags a synthetic hand-typed MB literal", () => {
    const violating = `return { ok: false, message: "File exceeds the 25 MB limit for this type" };`;
    expect(findHandTypedMb(violating)).toEqual(["25 MB"]);
  });

  // Positive control: a comment mentioning a bare "<digits> MB" figure is
  // NOT flagged -- only code survives comment-stripping.
  it("positive control: a comment's own MB figure is stripped before scanning", () => {
    const commentOnly = `// this cap is basically 25 MB, roughly\nconst x = 1;`;
    expect(findHandTypedMb(commentOnly)).toEqual([]);
  });
});

describe("uploadHintText interpolates every MB figure from its owning constant", () => {
  it("non-recording hint text contains the document and image tier MB values", () => {
    const text = uploadHintText("handout");
    expect(text).toContain(`${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB`);
    expect(text).toContain(`${IMAGE_MAX_BYTES / BYTES_PER_MB} MB`);
  });

  it("recording hint text also contains the video tier MB value", () => {
    const text = uploadHintText("recording");
    expect(text).toContain(`${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB`);
    expect(text).toContain(`${IMAGE_MAX_BYTES / BYTES_PER_MB} MB`);
    expect(text).toContain(`${VIDEO_MAX_BYTES / BYTES_PER_MB} MB`);
  });
});

describe("each oversize refusal message interpolates its own tier constant", () => {
  it("document oversize message carries DOCUMENT_MAX_BYTES's MB value", () => {
    const result = validateUpload({
      filename: "deck.pdf",
      sizeBytes: DOCUMENT_MAX_BYTES + 1,
      kind: "presentation",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(`${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB`);
  });

  it("image oversize message carries IMAGE_MAX_BYTES's MB value", () => {
    const result = validateUpload({
      filename: "photo.png",
      sizeBytes: IMAGE_MAX_BYTES + 1,
      kind: "poster",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(`${IMAGE_MAX_BYTES / BYTES_PER_MB} MB`);
  });

  it("text oversize message carries TEXT_MAX_BYTES's MB value", () => {
    const result = validateUpload({
      filename: "notes.txt",
      sizeBytes: TEXT_MAX_BYTES + 1,
      kind: "handout",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(`${TEXT_MAX_BYTES / BYTES_PER_MB} MB`);
  });

  it("video oversize message carries VIDEO_MAX_BYTES's MB value", () => {
    const result = validateUpload({
      filename: "talk.mp4",
      sizeBytes: VIDEO_MAX_BYTES + 1,
      kind: "recording",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(`${VIDEO_MAX_BYTES / BYTES_PER_MB} MB`);
  });

  it("headshot oversize message carries HEADSHOT_MAX_BYTES's MB value", () => {
    const result = validateHeadshotUpload({
      filename: "me.png",
      sizeBytes: HEADSHOT_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(`${HEADSHOT_MAX_BYTES / BYTES_PER_MB} MB`);
  });
});

describe("the headshot tier and the image tier are one number", () => {
  it("HEADSHOT_MAX_BYTES === IMAGE_MAX_BYTES", () => {
    expect(HEADSHOT_MAX_BYTES).toBe(IMAGE_MAX_BYTES);
  });
});
