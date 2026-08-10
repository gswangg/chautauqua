// Pure core for the J8 file pipeline (DEC-020): upload validation + the
// version-chain rule. Web APIs only — no node:/cloudflare/drizzle imports
// (DEC-002, pure-core rule).

// 'presentation' | 'poster' | 'handout' — DEC-003 file.kind literal.
export const FILE_KINDS = ["presentation", "poster", "handout"] as const;
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

const DOCUMENT_MAX_BYTES = 25 * BYTES_PER_MB;
const IMAGE_MAX_BYTES = 8 * BYTES_PER_MB;
// DEC-020 doesn't state a separate cap for txt/md; narrowest reasonable
// reading reuses the document-tier cap (25 MB) since they're just another
// flavor of document upload.
const TEXT_MAX_BYTES = 25 * BYTES_PER_MB;

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
