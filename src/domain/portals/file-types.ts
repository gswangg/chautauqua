// File-request limits on library items (Portals frame, flow 2 "New library
// item"): which kinds of file a participant may upload, how large, how
// many. Enforced on upload on top of src/domain/files.ts's own rules.
// Pure core.

export const FILE_TYPE_GROUPS = ["pdf", "keynote", "powerpoint", "image", "video", "any"] as const;
export type FileTypeGroup = (typeof FILE_TYPE_GROUPS)[number];

export const FILE_TYPE_GROUP_LABELS: Record<FileTypeGroup, string> = {
  pdf: "PDF",
  keynote: "Keynote",
  powerpoint: "PowerPoint",
  image: "Image",
  video: "Video",
  any: "Any file",
};

const GROUP_EXTENSIONS: Record<Exclude<FileTypeGroup, "any">, readonly string[]> = {
  pdf: ["pdf"],
  keynote: ["key"],
  powerpoint: ["ppt", "pptx"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
  video: ["mp4", "mov", "webm"],
};

export const MAX_FILE_REQUEST_SIZE_MB = 200;
export const MAX_FILE_REQUEST_FILES = 10;

export function isFileTypeGroup(v: string): v is FileTypeGroup {
  return (FILE_TYPE_GROUPS as readonly string[]).includes(v);
}

/** Validates an untrusted list of file-type groups. */
export function parseAcceptedTypes(input: unknown): FileTypeGroup[] {
  if (!Array.isArray(input) || input.some((v) => typeof v !== "string" || !isFileTypeGroup(v))) {
    throw new Error(`File types must be a list of: ${FILE_TYPE_GROUPS.join(", ")}.`);
  }
  return [...new Set(input as FileTypeGroup[])];
}

/** task.accepted_types_json: null means no limit beyond the per-kind rules. */
export function parseAcceptedTypesJson(json: string | null): FileTypeGroup[] | null {
  if (json === null) return null;
  return parseAcceptedTypes(JSON.parse(json));
}

/** The extensions a set of groups allows, or null for any file. */
export function allowedExtensions(groups: readonly FileTypeGroup[]): string[] | null {
  if (groups.length === 0 || groups.includes("any")) return null;
  return groups.flatMap((g) => (g === "any" ? [] : [...GROUP_EXTENSIONS[g]]));
}

/** The picker's accept attribute: ".pdf,.key,.ppt,.pptx". */
export function acceptAttribute(groups: readonly FileTypeGroup[]): string | null {
  const ext = allowedExtensions(groups);
  return ext ? ext.map((e) => `.${e}`).join(",") : null;
}

/** "Keynote, PDF or PowerPoint, up to 200 MB" */
export function limitSentence(groups: readonly FileTypeGroup[] | null, maxSizeMb: number | null): string {
  const names = groups && !groups.includes("any") ? groups.map((g) => FILE_TYPE_GROUP_LABELS[g]) : [];
  const types = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  if (types && maxSizeMb) return `${types}, up to ${maxSizeMb} MB`;
  if (types) return types;
  if (maxSizeMb) return `Any file up to ${maxSizeMb} MB`;
  return "Any file";
}

/** Null when the file is allowed, otherwise the refusal reason. */
export function checkFileAgainstLimits(
  file: { filename: string; sizeBytes: number },
  limits: { acceptedTypes: readonly FileTypeGroup[] | null; maxSizeMb: number | null },
): string | null {
  const allowed = limits.acceptedTypes ? allowedExtensions(limits.acceptedTypes) : null;
  const ext = file.filename.includes(".") ? file.filename.split(".").pop()!.toLowerCase() : "";
  const sentence = limitSentence(limits.acceptedTypes, limits.maxSizeMb);
  if (allowed && !allowed.includes(ext)) return `This file type isn't accepted here: ${sentence}.`;
  if (limits.maxSizeMb !== null && file.sizeBytes > limits.maxSizeMb * 1024 * 1024) {
    return `This file is too large: ${sentence}.`;
  }
  return null;
}
