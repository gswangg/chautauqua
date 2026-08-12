// Export kind enumeration for GET /api/v1/events/:eventId/export/:kind
// (J12, DEC-027).

// DEC-597: 'contacts' is org-scoped (every other kind here is event-scoped)
// but still rides the DEC-027 export route/format machinery verbatim.
export const EXPORT_KINDS = ["submissions", "speakers", "evaluations", "agenda", "email-log", "contacts"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(value: unknown): value is ExportKind {
  return typeof value === "string" && (EXPORT_KINDS as readonly string[]).includes(value);
}
