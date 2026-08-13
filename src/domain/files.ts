// Pure core for the J8 file pipeline (DEC-020): upload validation + the
// version-chain rule. Web APIs only — no node:/cloudflare/drizzle imports
// (DEC-002, pure-core rule).

// DEC-425: caps attacker-controlled filename length; reuses MAX_NAME_LENGTH.
import { MAX_NAME_LENGTH } from "../forms/validate";

// 'presentation' | 'poster' | 'handout' | 'recording' — DEC-003/DEC-879
// file.kind literal. DEC-879: a session recording is a deliverable like any
// other file kind, not a separate concept.
export const FILE_KINDS = ["presentation", "poster", "handout", "recording"] as const;
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

const DOCUMENT_MAX_BYTES = 25 * BYTES_PER_MB;
const IMAGE_MAX_BYTES = 8 * BYTES_PER_MB;
// DEC-020 doesn't state a separate cap for txt/md; narrowest reasonable
// reading reuses the document-tier cap (25 MB) since they're just another
// flavor of document upload.
const TEXT_MAX_BYTES = 25 * BYTES_PER_MB;
// DEC-879: recordings are far larger than any other deliverable — 250 MB cap.
export const VIDEO_MAX_BYTES = 250 * BYTES_PER_MB;

/** Every extension validateUpload accepts, for UI hints (accept attr, help
 * text) — never used to bypass validateUpload itself, which stays the
 * single source of truth. */
export const ALLOWED_UPLOAD_EXTENSIONS: readonly string[] = [
  ...Object.keys(DOCUMENT_EXT_CONTENT_TYPE),
  ...Object.keys(IMAGE_EXT_CONTENT_TYPE),
  ...Object.keys(TEXT_EXT_CONTENT_TYPE),
  ...Object.keys(VIDEO_EXT_CONTENT_TYPE),
];

/** Human-readable summary of the upload allowlist + size caps, for form
 * field help text (DEC-020: 25 MB documents/text, 8 MB images; DEC-879:
 * 250 MB for recordings — but only for the 'recording' kind: video is not
 * part of any other kind's tier, so its hint must not advertise a video cap
 * for a field that would reject a video file). Pass `kind` when known (e.g.
 * a field bound to a specific FileKind) so the hint is per-tier honest;
 * omitted, it describes the non-video tiers only. */
export function uploadHintText(kind?: FileKind): string {
  const extensions =
    kind === "recording"
      ? ALLOWED_UPLOAD_EXTENSIONS
      : ALLOWED_UPLOAD_EXTENSIONS.filter((e) => !(e in VIDEO_EXT_CONTENT_TYPE));
  const sizeNote =
    kind === "recording"
      ? "Max 25 MB (8 MB for images, 250 MB for recordings)."
      : "Max 25 MB (8 MB for images).";
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
    return { ok: false, message: `Filename is too long (max ${MAX_NAME_LENGTH} characters)`, fields: { file: `Max ${MAX_NAME_LENGTH}` } };
  }

  const ext = extname(input.filename);

  if (ext in DOCUMENT_EXT_CONTENT_TYPE) {
    if (input.sizeBytes > DOCUMENT_MAX_BYTES) {
      return { ok: false, message: "File exceeds the 25 MB limit for this type", fields: { file: "Too large" } };
    }
    return { ok: true, ext, servedContentType: DOCUMENT_EXT_CONTENT_TYPE[ext]! };
  }

  if (ext in IMAGE_EXT_CONTENT_TYPE) {
    if (input.sizeBytes > IMAGE_MAX_BYTES) {
      return { ok: false, message: "File exceeds the 8 MB limit for images", fields: { file: "Too large" } };
    }
    return { ok: true, ext, servedContentType: IMAGE_EXT_CONTENT_TYPE[ext]! };
  }

  if (ext in TEXT_EXT_CONTENT_TYPE) {
    if (input.sizeBytes > TEXT_MAX_BYTES) {
      return { ok: false, message: "File exceeds the 25 MB limit for this type", fields: { file: "Too large" } };
    }
    return { ok: true, ext, servedContentType: TEXT_EXT_CONTENT_TYPE[ext]! };
  }

  if (ext in VIDEO_EXT_CONTENT_TYPE) {
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
      return { ok: false, message: "File exceeds the 250 MB limit for recordings", fields: { file: "Too large" } };
    }
    return { ok: true, ext, servedContentType: VIDEO_EXT_CONTENT_TYPE[ext]! };
  }

  return {
    ok: false,
    message: `File type '.${ext || "?"}' isn't allowed`,
    fields: { file: "Unsupported file type" },
  };
}

/** Whether a served content type should be presented as an inline image
 * (vs. a Content-Disposition: attachment download). */
export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
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

const HEADSHOT_MAX_BYTES = 8 * BYTES_PER_MB;

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
    return { ok: false, message: `Filename is too long (max ${MAX_NAME_LENGTH} characters)`, fields: { headshot: `Max ${MAX_NAME_LENGTH}` } };
  }
  const ext = extname(input.filename);
  if (!(ext in HEADSHOT_EXT_CONTENT_TYPE)) {
    return {
      ok: false,
      message: "Headshots must be PNG, JPG, JPEG, or WEBP",
      fields: { headshot: "Unsupported file type" },
    };
  }
  if (input.sizeBytes > HEADSHOT_MAX_BYTES) {
    return { ok: false, message: "Headshot exceeds the 8 MB limit", fields: { headshot: "Too large" } };
  }
  return { ok: true, ext, servedContentType: HEADSHOT_EXT_CONTENT_TYPE[ext]! };
}
