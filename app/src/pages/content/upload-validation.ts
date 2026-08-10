// DEC-020 upload validation, mirrored client-side for immediate UX feedback.
// The server (src/domain/files.ts) is the authority; this is a best-effort
// pre-check so users see the real accepted-types/size-cap text (CNT-12)
// before submitting, not a silent guess. The server rejects anything this
// misses.

export const DOCUMENT_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'key', 'odp', 'zip'] as const;
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB cap

export const MEDIA_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024; // 8 MB cap

export const TEXT_EXTENSIONS = ['txt', 'md'] as const;
// Text files are grouped with the media size cap (DEC-020 lists it directly
// after the 8 MB group with no separate cap of its own).
export const TEXT_MAX_BYTES = MEDIA_MAX_BYTES;

interface ExtensionGroup {
  extensions: readonly string[];
  maxBytes: number;
  label: string;
}

const GROUPS: readonly ExtensionGroup[] = [
  { extensions: DOCUMENT_EXTENSIONS, maxBytes: DOCUMENT_MAX_BYTES, label: 'max 25 MB' },
  { extensions: [...MEDIA_EXTENSIONS, ...TEXT_EXTENSIONS], maxBytes: MEDIA_MAX_BYTES, label: 'max 8 MB' },
];

/** Verbatim accepted-types + size-cap text for the upload zone (CNT-12). */
export function formatAcceptedTypesMessage(): string {
  return GROUPS.map((g) => `${g.extensions.join(', ')} (${g.label})`).join(' · ');
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

export interface UploadValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Pure pre-check for a file about to be uploaded. Mirrors DEC-020: unknown
 * extensions are 'invalid'; each allowed extension has its own size cap.
 */
export function validateUploadFile(file: { name: string; size: number }): UploadValidationResult {
  const ext = extensionOf(file.name);
  const group = GROUPS.find((g) => g.extensions.includes(ext));

  if (!group) {
    return { valid: false, message: `"${ext || file.name}" is not an accepted file type. Accepted: ${formatAcceptedTypesMessage()}` };
  }

  if (file.size > group.maxBytes) {
    const capMb = Math.round(group.maxBytes / (1024 * 1024));
    return { valid: false, message: `File exceeds the ${capMb} MB cap for .${ext} files.` };
  }

  return { valid: true };
}
