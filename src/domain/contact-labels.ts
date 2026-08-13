// DEC-738/DEC-726: a contact's Labels ARE its customFields, formatted once,
// server-side -- never a derived participation-role query (supersedes
// DEC-712's deriveContactLabels/fetchContactLabels, which this replaces).
// Pure core (DEC-002): no node:/cloudflare/drizzle imports.

/** The one reserved custom-field key (DEC-292): travel/logistics text is
 * edited via its own labeled textarea, never listed as a generic label.
 * Owned here so both this server-importable labels formatter and the
 * client-side custom-field editor (app/src/pages/contacts/customFields.ts)
 * import the same string instead of hand-copying it. */
export const TRAVEL_KEY = "travel_logistics";

/**
 * Formats a contact's customFields as its Labels: one "`key` `value`"
 * string per entry, in stable key order (the order Object.keys returns),
 * excluding the reserved travel key. Used both server-side (GET
 * /api/v1/contacts's `labels` field) and client-side (ContactDrawer's
 * read-only Labels row, ContactsTable's Labels column) so the two never
 * drift.
 */
export function contactLabels(customFields: Record<string, string>): string[] {
  return Object.keys(customFields)
    .filter((key) => key !== TRAVEL_KEY)
    .map((key) => `${key} ${customFields[key]}`);
}
