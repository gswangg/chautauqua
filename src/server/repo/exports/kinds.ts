// Export kind enumeration for GET /api/v1/events/:eventId/export/:kind
// (J12, DEC-027).

export const EXPORT_KINDS = ["submissions", "speakers", "evaluations", "agenda", "email-log"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(value: unknown): value is ExportKind {
  return typeof value === "string" && (EXPORT_KINDS as readonly string[]).includes(value);
}
