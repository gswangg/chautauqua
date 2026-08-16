// Pure core for the J8 file pipeline (DEC-020): upload validation + the
// version-chain rule. Web APIs only — no node:/cloudflare/drizzle imports
// (DEC-002, pure-core rule).

// DEC-425: caps attacker-controlled filename length; reuses MAX_NAME_LENGTH.
import { MAX_NAME_LENGTH } from "../forms/validate";
import { DEC_425 } from "../decisions";
import { overCapFieldMessage, overCapSentence } from "./cap-copy";

void DEC_425;

// 'presentation' | 'poster' | 'handout' | 'recording' | 'photo' —
// DEC-003/DEC-879 file.kind literal. DEC-879: a session recording is a
// deliverable like any other file kind, not a separate concept; a headshot/
// photo file request is likewise its own deliverable kind (wave-67
// amendment), distinct from the profile-derived 'headshot' library
// projection off contact.headshot_file_id (src/server/repo/files-library-scope.ts).
export const FILE_KINDS = ["presentation", "poster", "handout", "recording", "photo"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export function isValidFileKind(value: unknown): value is FileKind {
  return typeof value === "string" && (FILE_KINDS as readonly string[]).includes(value);
}

const BYTES_PER_MB = 1024 * 1024;

// DEC-020 allowlist: extension -> forced served content type. Never an HTML
// content type; extensions without a clean standard MIME type (key, zip,
// generic docs) are served application/octet-stream rather than sniffed.
const DOCUMENT_EXT_CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  key: "application/octet-stream",
  odp: "application/vnd.oasis.opendocument.presentation",
};

// DEC-879 (findings wave 5 amendment): a zip archive is a workshop-pack
// deliverable, not a slide/poster/recording — admitted only for the
// 'handout' kind, using the same shape as the VIDEO_EXT_CONTENT_TYPE /
// 'recording' tier below (a single-extension map + a kind check inside
// validateUpload, rather than folding zip into the generic document tier).
const ZIP_EXT_CONTENT_TYPE: Record<string, string> = {
  zip: "application/zip",
};

const IMAGE_EXT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// txt/md are always forced to text/plain — a .md file must never be served
// as text/html (or any other content type a browser might render as HTML).
const TEXT_EXT_CONTENT_TYPE: Record<string, string> = {
  txt: "text/plain",
  md: "text/plain",
};

// DEC-879: a recording is a video deliverable. mp4/mov/webm only, forced to
// their standard video content type — never sniffed, never HTML.
const VIDEO_EXT_CONTENT_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export const DOCUMENT_MAX_BYTES = 25 * BYTES_PER_MB;
export const IMAGE_MAX_BYTES = 8 * BYTES_PER_MB;
// DEC-020 doesn't state a separate cap for txt/md; narrowest reasonable
// reading reuses the document-tier cap (25 MB) since they're just another
// flavor of document upload.
export const TEXT_MAX_BYTES = 25 * BYTES_PER_MB;

// DEC-879 (wave-22 amendment): Cloudflare Workers Free/Pro incoming
// request-body ceiling — a request larger than this 413s at the edge before
// the Worker ever runs, so no in-Worker validation (including the recording
// deliverable's own designed over-cap error at
// src/routes/portal/tasks.tsx:496) is reachable for a request over this size.
export const WORKERS_REQUEST_BODY_MAX_BYTES = 100 * BYTES_PER_MB;

// Headroom reserved for multipart/form-data framing overhead (field
// boundaries, headers, the non-file fields riding in the same request) so
// the raw file bytes plus framing still clear WORKERS_REQUEST_BODY_MAX_BYTES.
const MULTIPART_FRAMING_HEADROOM_BYTES = 5 * BYTES_PER_MB;
// Test-only re-export, mirroring the other _FOR_TEST constants above.
export const MULTIPART_FRAMING_HEADROOM_BYTES_FOR_TEST = MULTIPART_FRAMING_HEADROOM_BYTES;

// DEC-879 (wave-22 amendment): recordings are far larger than any other
// deliverable, but the cap must be derived from the edge's own ceiling, not
// guessed — mirroring the ISOLATE_MEMORY_BUDGET_BYTES /
// ARCHIVE_PEAK_MULTIPLIER / ARCHIVE_MAX_TOTAL_BYTES derivation pattern at
// src/routes/files.ts:344-359. At 250 MB the edge 413s the request before
// the Worker runs, making the product's own over-cap error unreachable.
// VIDEO_MAX_BYTES + MULTIPART_FRAMING_HEADROOM_BYTES <=
// WORKERS_REQUEST_BODY_MAX_BYTES (see test/files.test.ts).
export const VIDEO_MAX_BYTES = 95 * BYTES_PER_MB;

// Wave-38 (DEC-020 amendment): `ext in SOME_CONTENT_TYPE_MAP` walks
// Object.prototype for a plain object literal, so a filename like
// `deck.constructor` or `x.__proto__` clears the allowlist and yields a
// function/object as the "content type". The ONE lookup every tier test (and
// the video-extension filter in allowedUploadExtensions) must route through
// — own-property only, matching src/forms/validate.ts:66's shape.
function allowedContentType(map: Record<string, string>, ext: string): string | null {
  return Object.prototype.hasOwnProperty.call(map, ext) ? map[ext]! : null;
}

const ALL_UPLOAD_EXTENSIONS: readonly string[] = [
  ...Object.keys(DOCUMENT_EXT_CONTENT_TYPE),
  ...Object.keys(IMAGE_EXT_CONTENT_TYPE),
  ...Object.keys(TEXT_EXT_CONTENT_TYPE),
  ...Object.keys(VIDEO_EXT_CONTENT_TYPE),
  ...Object.keys(ZIP_EXT_CONTENT_TYPE),
];

// DEC-879 (wave-54 amendment): the public CFP file field binds three call
// sites — src/views/form-render.tsx's `accept` attribute AND its
// uploadHintText call, and src/routes/public/submit-post.tsx's
// validateUpload call — to the SAME FileKind, so the picker, the visible
// hint, and the server never disagree on what's admitted (a zip archive was
// excluded from the picker's `accept` while the hint and the server both
// accepted it). All three sites must use this constant rather than a
// hand-typed "handout" literal.
export const CFP_FILE_FIELD_KIND: FileKind = "handout";

/** Every extension validateUpload accepts for the given kind, for UI hints
 * (accept attr, help text) — never used to bypass validateUpload itself,
 * which stays the single source of truth. DEC-879: video is admitted only
 * for the 'recording' kind, and (findings wave 5 amendment) zip is admitted
 * only for the 'handout' kind — every other kind (and the no-kind-known
 * case) excludes each, matching the tier validateUpload actually enforces.
 * The ONE place this per-kind filter is applied (DEC-879 amendment, wave
 * 10) — uploadHintText derives from this, not a second copy of the rule. */
export function allowedUploadExtensions(kind?: FileKind): readonly string[] {
  // DEC-879 (wave-67 amendment): the 'photo' kind admits ONLY the image
  // extensions — narrower than every other kind's document+image+text base,
  // matching the tier gate validateUpload enforces below.
  if (kind === "photo") return Object.keys(IMAGE_EXT_CONTENT_TYPE);
  return ALL_UPLOAD_EXTENSIONS.filter((e) => {
    if (allowedContentType(VIDEO_EXT_CONTENT_TYPE, e) !== null) return kind === "recording";
    if (allowedContentType(ZIP_EXT_CONTENT_TYPE, e) !== null) return kind === "handout";
    return true;
  });
}

/** Human-readable summary of the upload allowlist + size caps, for form
 * field help text (DEC-020: DOCUMENT_MAX_BYTES for documents/text,
 * IMAGE_MAX_BYTES for images; DEC-879: VIDEO_MAX_BYTES for recordings,
 * derived from WORKERS_REQUEST_BODY_MAX_BYTES — but only for the
 * 'recording' kind: video is not part of any other kind's tier, so its hint
 * must not advertise a video cap for a field that would reject a video
 * file). Pass `kind` when known (e.g. a field bound to a specific FileKind)
 * so the hint is per-tier honest; omitted, it describes the non-video tiers
 * only. Every size in this string is interpolated from its owning tier
 * constant — never hand-typed — so this copy can't drift from the enforced
 * cap (wave-67 amendment, DEC-020). */
export function uploadHintText(kind?: FileKind): string {
  const extensions = allowedUploadExtensions(kind);
  const sizeNote =
    kind === "recording"
      ? `Max ${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB (${IMAGE_MAX_BYTES / BYTES_PER_MB} MB for images, ${VIDEO_MAX_BYTES / BYTES_PER_MB} MB for recordings).`
      : kind === "photo"
        ? `Max ${IMAGE_MAX_BYTES / BYTES_PER_MB} MB.`
        : `Max ${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB (${IMAGE_MAX_BYTES / BYTES_PER_MB} MB for images).`;
  return `Allowed types: ${extensions.map((e) => `.${e}`).join(", ")}. ${sizeNote}`;
}

export interface UploadInput {
  filename: string;
  sizeBytes: number;
  kind: unknown;
}

export interface ValidUpload {
  ok: true;
  ext: string;
  servedContentType: string;
}

export interface InvalidUpload {
  ok: false;
  message: string;
  fields?: Record<string, string>;
}

export type ValidateUploadResult = ValidUpload | InvalidUpload;

/** Lowercased extension without the leading dot, or '' when there isn't one. */
export function extname(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * DEC-020 upload validation: extension allowlist with a forced served
 * content type + per-category size cap. Never returns an HTML content type;
 * anything outside the allowlist (including no extension) is invalid.
 */
export function validateUpload(input: UploadInput): ValidateUploadResult {
  if (!isValidFileKind(input.kind)) {
    return {
      ok: false,
      message: `kind must be one of ${FILE_KINDS.join(", ")}`,
      fields: { kind: "Invalid file kind" },
    };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, message: "File is empty", fields: { file: "File is empty" } };
  }

  // DEC-425: reject an oversized filename before type/extension checks so
  // the message is about length, not type.
  if (input.filename.length > MAX_NAME_LENGTH) {
    return { ok: false, message: overCapSentence("Filename", input.filename.length, MAX_NAME_LENGTH), fields: { file: overCapFieldMessage(input.filename.length, MAX_NAME_LENGTH) } };
  }

  const ext = extname(input.filename);

  const documentType = allowedContentType(DOCUMENT_EXT_CONTENT_TYPE, ext);
  if (documentType !== null) {
    // DEC-879 (wave-67 amendment): the photo tier admits image extensions
    // only — a document extension is rejected outright, never sized,
    // mirroring the video/zip kind gates below.
    if (input.kind === "photo") {
      return {
        ok: false,
        message: "Documents are not accepted for a photo deliverable",
        fields: { file: "Unsupported file type for this kind" },
      };
    }
    if (input.sizeBytes > DOCUMENT_MAX_BYTES) {
      return {
        ok: false,
        message: `File exceeds the ${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB limit for this type`,
        fields: { file: "Too large" },
      };
    }
    return { ok: true, ext, servedContentType: documentType };
  }

  const imageType = allowedContentType(IMAGE_EXT_CONTENT_TYPE, ext);
  if (imageType !== null) {
    if (input.sizeBytes > IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: `File exceeds the ${IMAGE_MAX_BYTES / BYTES_PER_MB} MB limit for images`,
        fields: { file: "Too large" },
      };
    }
    return { ok: true, ext, servedContentType: imageType };
  }

  const textType = allowedContentType(TEXT_EXT_CONTENT_TYPE, ext);
  if (textType !== null) {
    // DEC-879 (wave-67 amendment): the photo tier admits image extensions
    // only — a text extension is rejected outright, never sized, mirroring
    // the video/zip kind gates below.
    if (input.kind === "photo") {
      return {
        ok: false,
        message: "Text files are not accepted for a photo deliverable",
        fields: { file: "Unsupported file type for this kind" },
      };
    }
    if (input.sizeBytes > TEXT_MAX_BYTES) {
      return {
        ok: false,
        message: `File exceeds the ${TEXT_MAX_BYTES / BYTES_PER_MB} MB limit for this type`,
        fields: { file: "Too large" },
      };
    }
    return { ok: true, ext, servedContentType: textType };
  }

  const videoType = allowedContentType(VIDEO_EXT_CONTENT_TYPE, ext);
  if (videoType !== null) {
    // DEC-879: the video tier is admitted only for a 'recording' deliverable
    // — every other kind rejects a video extension outright, never sizing it.
    if (input.kind !== "recording") {
      return {
        ok: false,
        message: "Video files are only accepted for a recording deliverable",
        fields: { file: "Unsupported file type for this kind" },
      };
    }
    if (input.sizeBytes > VIDEO_MAX_BYTES) {
      return {
        ok: false,
        message: `File exceeds the ${VIDEO_MAX_BYTES / BYTES_PER_MB} MB limit for recordings`,
        fields: { file: "Too large" },
      };
    }
    return { ok: true, ext, servedContentType: videoType };
  }

  const zipType = allowedContentType(ZIP_EXT_CONTENT_TYPE, ext);
  if (zipType !== null) {
    // DEC-879 (findings wave 5 amendment): the zip tier is admitted only
    // for a 'handout' deliverable — every other kind rejects a zip
    // extension outright, never sizing it, mirroring the video tier above.
    if (input.kind !== "handout") {
      return {
        ok: false,
        message: "Zip archives are only accepted for a handout deliverable",
        fields: { file: "Unsupported file type for this kind" },
      };
    }
    if (input.sizeBytes > DOCUMENT_MAX_BYTES) {
      return {
        ok: false,
        message: `File exceeds the ${DOCUMENT_MAX_BYTES / BYTES_PER_MB} MB limit for this type`,
        fields: { file: "Too large" },
      };
    }
    return { ok: true, ext, servedContentType: zipType };
  }

  return {
    ok: false,
    message: `File type '.${ext || "?"}' isn't allowed`,
    fields: { file: "Unsupported file type" },
  };
}

// -----------------------------------------------------------------------
// DEC-160/DEC-353: bulk ZIP archive caps — declared once here (wave-53
// amendment) so src/routes/files.ts and the SPA's FilesLibrary both cross
// the app/ -> src/ boundary at this one module rather than hand-copying the
// literal.
// -----------------------------------------------------------------------
export const ARCHIVE_MAX_FILES = 50;
// DEC-353 (wave-46 amendment): bound the memory the archive materialises
// in-worker — the sum of the resolved latest versions' sizeBytes must fit
// under this before any R2 get is issued (fail loudly, no truncation/partial
// archive/silent skip). The cap is derived, not guessed: peak in-worker
// memory during archive build is the entry buffers (fetched, held in
// `entries`) plus the ByteWriter's transient growth while it assembles the
// body/central/eocd chunks and materialises the final Uint8Array — call that
// ARCHIVE_PEAK_MULTIPLIER x the total resolved bytes. That peak must stay
// well under the isolate's memory budget (with headroom for everything else
// running in the isolate), so ARCHIVE_MAX_TOTAL_BYTES is chosen such that
// ARCHIVE_MAX_TOTAL_BYTES * ARCHIVE_PEAK_MULTIPLIER <= 0.75 *
// ISOLATE_MEMORY_BUDGET_BYTES (see test/files-archive-budget.test.ts).
export const ISOLATE_MEMORY_BUDGET_BYTES = 128 * 1024 * 1024;
export const ARCHIVE_PEAK_MULTIPLIER = 4;
export const ARCHIVE_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** DEC-160/DEC-353 wave-53: the ONE sentence describing the archive's two
 * caps, so a client surface never hand-assembles its own copy. */
export function archiveCapMessage(): string {
  return `${ARCHIVE_MAX_FILES} files or ${formatBytes(ARCHIVE_MAX_TOTAL_BYTES)} at a time — narrow the filter`;
}

// DEC-244: comment body cap on the portal reply endpoint (matches no
// existing forms/validate.ts constant since file comments aren't a form
// field — long-text form answers cap at 20000, but a deliverable reply
// thread is capped much tighter). Declared here (wave-56 amendment, DEC-244)
// so both the route handler and the pure-render textarea/help-text share the
// one number instead of a route-local constant the view can't reach.
export const MAX_COMMENT_BODY_LENGTH = 4000;

// DEC-020 (wave-55 amendment): the ONE human byte-size renderer in this
// codebase. Below 1024 bytes renders as a whole-number byte count; at or
// above 1024, one decimal place and a single space before the KB/MB/GB
// unit. Fails loudly on a non-finite or negative input rather than
// silently coercing it (house invariant) — a caller passing a corrupted
// sizeBytes wants to know, not see "NaN B".
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error(`formatBytes: bytes must be a finite non-negative number, got ${bytes}`);
  }
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Whether a served content type should be presented as an inline image
 * (vs. a Content-Disposition: attachment download). */
export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

// DEC-425 (wave-24 amendment): the C0 control range (+ DEL) stripped from a
// filename before it can reach any header value.
const C0_AND_DEL_RE = /[\x00-\x1f\x7f]/g;

// RFC 5987 attr-char excludes these beyond what encodeURIComponent already
// percent-encodes.
const EXTRA_ATTR_CHAR_RE = /['()*!]/g;

/**
 * DEC-425 (wave-24 amendment): the ONE owner of every HTTP
 * Content-Disposition header value in this repo. Strips C0 controls/DEL,
 * takes the last path segment (so a path-traversal-shaped name collapses to
 * its basename), builds an ASCII-only `filename=` fallback (dropping `"`
 * and `\` — both would let the value escape the quoted string — and
 * replacing any non-ASCII code point with `_`, defaulting to "download"
 * when nothing survives), and appends an RFC 6266/5987 `filename*=UTF-8''…`
 * parameter whenever the (control-stripped, path-stripped) name held any
 * non-ASCII code point. Asserts the result is pure ASCII before returning —
 * a header value that isn't would be a bug in this function, not a
 * defensive fallback for a caller.
 */
export function contentDispositionAttachment(filename: string): string {
  const stripped = filename.replace(C0_AND_DEL_RE, "");
  const lastSlash = Math.max(stripped.lastIndexOf("/"), stripped.lastIndexOf("\\"));
  const strippedName = lastSlash >= 0 ? stripped.slice(lastSlash + 1) : stripped;

  let fallback = "";
  for (const ch of strippedName) {
    if (ch === '"' || ch === "\\") continue;
    fallback += ch.codePointAt(0)! > 0x7f ? "_" : ch;
  }
  if (fallback.length === 0) fallback = "download";

  let hasNonAscii = false;
  for (const ch of strippedName) {
    if (ch.codePointAt(0)! > 0x7f) {
      hasNonAscii = true;
      break;
    }
  }

  let result = `attachment; filename="${fallback}"`;
  if (hasNonAscii) {
    const pct = encodeURIComponent(strippedName).replace(EXTRA_ATTR_CHAR_RE, (c) =>
      `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    result += `; filename*=UTF-8''${pct}`;
  }

  for (const ch of result) {
    if (ch.codePointAt(0)! >= 0x80) {
      throw new Error("contentDispositionAttachment: produced a non-ASCII header value — invariant violated");
    }
  }
  return result;
}

/** Sanitizes a user-supplied filename for use as an R2 key segment: strips
 * path separators and anything outside a conservative safe set. */
export function sanitizeFilenameForKey(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, "");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "file";
}

/** DEC-160: slugifies a submission title for the per-session folder in a
 * bulk-download ZIP's entry names — lowercase, non-alphanumerics collapsed
 * to single hyphens, trimmed. Falls back to 'submission' for a title that
 * slugifies to nothing (e.g. all punctuation). */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "submission";
}

export interface ReplacesTarget {
  submissionId: string | null;
  kind: string;
}

/**
 * DEC-020 version-chain rule: replacesFileId must reference a file on the
 * same submission with the same kind. `target` is the file being replaced
 * (or undefined/null when there is no replacesFileId); `candidate` is the
 * submission/kind of the file being uploaded now.
 */
export function isValidVersionChain(
  target: ReplacesTarget | null | undefined,
  candidate: { submissionId: string; kind: string },
): boolean {
  if (!target) return true;
  return target.submissionId === candidate.submissionId && target.kind === candidate.kind;
}

// ---------------------------------------------------------------------------
// Headshot uploads (DEC-028, values per DEC-020's image tier: png/jpg/jpeg/
// webp, 8 MB cap — narrower than the submission-file allowlist: no gif, and
// there's no `kind` field since a headshot upload's kind is implicit).
// ---------------------------------------------------------------------------

const HEADSHOT_EXT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// wave-67 amendment: the headshot tier and the image tier are one number —
// derived, never a second hand-typed 8 MB.
export const HEADSHOT_MAX_BYTES = IMAGE_MAX_BYTES;

/** Every extension validateHeadshotUpload accepts, for UI hints (accept
 * attr, help text) — derived from HEADSHOT_EXT_CONTENT_TYPE, never a second
 * hand-typed list, matching allowedUploadExtensions' shape above. */
export const HEADSHOT_EXTENSIONS: readonly string[] = Object.keys(HEADSHOT_EXT_CONTENT_TYPE);

/** Client-side downscale contract for headshot uploads: longest edge and
 * JPEG/WEBP quality, single-sourced here so both file pickers (portal
 * profile, contacts drawer) interpolate the same numbers instead of
 * hand-typing them into their downscale scripts. */
export const HEADSHOT_DOWNSCALE_EDGE_PX = 512;
export const HEADSHOT_DOWNSCALE_QUALITY = 0.85;

/** Human-readable summary of the headshot allowlist + size cap, matching
 * uploadHintText's grammar shape, for both file pickers' help text. */
export function headshotHintText(): string {
  return `Allowed types: ${HEADSHOT_EXTENSIONS.map((e) => `.${e}`).join(", ")}. Max ${HEADSHOT_MAX_BYTES / BYTES_PER_MB} MB.`;
}

export interface HeadshotUploadInput {
  filename: string;
  sizeBytes: number;
}

/**
 * Validates a portal headshot upload: png/jpg/jpeg/webp only, 8 MB cap.
 * Anything else (wrong extension, oversized, empty) is rejected loudly with
 * a user-facing message — never silently coerced.
 */
export function validateHeadshotUpload(input: HeadshotUploadInput): ValidateUploadResult {
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, message: "File is empty", fields: { headshot: "File is empty" } };
  }
  // DEC-425: reject an oversized filename before type/extension checks so
  // the message is about length, not type.
  if (input.filename.length > MAX_NAME_LENGTH) {
    return { ok: false, message: overCapSentence("Filename", input.filename.length, MAX_NAME_LENGTH), fields: { headshot: overCapFieldMessage(input.filename.length, MAX_NAME_LENGTH) } };
  }
  const ext = extname(input.filename);
  const headshotType = allowedContentType(HEADSHOT_EXT_CONTENT_TYPE, ext);
  if (headshotType === null) {
    return {
      ok: false,
      message: "Headshots must be PNG, JPG, JPEG, or WEBP",
      fields: { headshot: "Unsupported file type" },
    };
  }
  if (input.sizeBytes > HEADSHOT_MAX_BYTES) {
    return {
      ok: false,
      message: `Headshot exceeds the ${HEADSHOT_MAX_BYTES / BYTES_PER_MB} MB limit`,
      fields: { headshot: "Too large" },
    };
  }
  return { ok: true, ext, servedContentType: headshotType };
}

// C0 control range + DEL + CR/LF (CR/LF already covered by C0, kept explicit
// for readability) — none may appear in a raw Content-Type header echo.
const HEADER_UNSAFE_RE = /[\x00-\x1f\x7f]/;

/**
 * Wave-38 (DEC-020 amendment): the ONE boundary invariant every raw
 * Content-Type header echo (src/routes/files.ts's byte-serving route) must
 * pass through before it reaches an HTTP response header. `servedContentType`
 * is normally minted by validateUpload/validateHeadshotUpload from a fixed
 * allowlist, but this function doesn't trust that — it re-checks the value
 * itself, throwing loudly (never coercing to a default) rather than letting a
 * corrupted stored value (e.g. a pre-fix row minted via the prototype-chain
 * hole this amendment closes) reach a header raw. Modeled on
 * contentDispositionAttachment's end-of-function invariant assert above.
 */
export function assertServedContentTypeHeader(value: string): string {
  if (typeof value !== "string") {
    throw new Error("assertServedContentTypeHeader: value is not a string — invariant violated");
  }
  if (HEADER_UNSAFE_RE.test(value)) {
    throw new Error("assertServedContentTypeHeader: value contains a control character — invariant violated");
  }
  if (value.toLowerCase().startsWith("text/html")) {
    throw new Error("assertServedContentTypeHeader: value is text/html — invariant violated");
  }
  return value;
}
