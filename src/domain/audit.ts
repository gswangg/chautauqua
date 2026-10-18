// The append-only audit log (migrations/0046 audit_event): who accessed or
// changed what, and when. Built for the whole app; multi-portal is its first
// writer. Pure core.

export const AUDIT_ACTIONS = [
  "portal.preview",
  "portal.create",
  "portal.update",
  "portal.duplicate",
  "portal.delete",
  "portal.copy",
  "sponsor_tier.update",
  "sponsorship.update",
  "sponsor_session.submit",
  "sponsor_session.withdraw",
  "sponsor_session.request_changes",
  "sponsor_session.approve",
  "sponsor_session.decline",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(v: string): v is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(v);
}

export type AuditDetails = Record<string, string | number | boolean | null>;

/** Validates audit_event.details_json: a flat object of scalars. */
export function parseAuditDetails(input: unknown): AuditDetails {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("audit details must be an object");
  }
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v !== null && typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
      throw new Error(`audit detail ${k} must be a scalar`);
    }
  }
  return input as AuditDetails;
}

export function parseAuditDetailsJson(json: string | null): AuditDetails {
  if (json === null) return {};
  return parseAuditDetails(JSON.parse(json));
}
