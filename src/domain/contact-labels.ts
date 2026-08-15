// DEC-738/DEC-726: a contact's Labels ARE its customFields, formatted once,
// server-side -- never a derived participation-role query (supersedes
// DEC-712's deriveContactLabels/fetchContactLabels, which this replaces).
// Pure core (DEC-002): no node:/cloudflare/drizzle imports.

// DEC-292 (and its findings-wave-5 amendment): this module is the sole
// implementation of the reserved-custom-field-key contract.
import { DEC_292 } from "../decisions";
void DEC_292;

/** The three reserved custom-field keys (DEC-292, amendment findings wave
 * 5): dietary, travel/logistics, and accessibility text are each edited via
 * their own labeled textarea in the drawer's "This event" group, never
 * listed as generic labels. Owned here so both this server-importable
 * labels formatter and the client-side custom-field editor
 * (app/src/pages/contacts/customFields.ts) import the same strings instead
 * of hand-copying them. The travel key's stored string is unchanged from
 * the original single-reserved-key design, so no data migration is
 * needed. */
export const RESERVED_CUSTOM_FIELD_KEYS = {
  dietary: "dietary",
  travel: "travel_logistics",
  accessibility: "accessibility",
} as const;

export type ReservedCustomFieldKey =
  (typeof RESERVED_CUSTOM_FIELD_KEYS)[keyof typeof RESERVED_CUSTOM_FIELD_KEYS];

/** Labels shown above each reserved field's textarea, in frame order
 * (Chautauqua Contacts.dc.html :899-904): Dietary -> Travel ->
 * Accessibility. */
export const RESERVED_CUSTOM_FIELD_LABELS: Record<ReservedCustomFieldKey, string> = {
  [RESERVED_CUSTOM_FIELD_KEYS.dietary]: "Dietary",
  [RESERVED_CUSTOM_FIELD_KEYS.travel]: "Travel",
  [RESERVED_CUSTOM_FIELD_KEYS.accessibility]: "Accessibility",
};

const RESERVED_KEY_SET: Set<string> = new Set(Object.values(RESERVED_CUSTOM_FIELD_KEYS));

// DEC-417 amendment (wave 2): a contact's customFields object was bounded
// per-value (checkLen on each string) but never bounded in KEY COUNT --
// unbounded keys is an unbounded collection with no cap at all. Owned here
// (pure core, no node:/cloudflare/drizzle imports) rather than in the route
// file, since the batch-cap scan forbids the literal there.
export const MAX_CONTACT_CUSTOM_FIELDS = 40;

/**
 * Formats a contact's customFields as its Labels: one "`key` `value`"
 * string per entry, in stable key order (the order Object.keys returns),
 * excluding the reserved keys (dietary, travel, accessibility). Used both
 * server-side (GET /api/v1/contacts's `labels` field) and client-side
 * (ContactDrawer's read-only Labels row, ContactsTable's Labels column) so
 * the two never drift.
 */
export function contactLabels(customFields: Record<string, string>): string[] {
  return Object.keys(customFields)
    .filter((key) => !RESERVED_KEY_SET.has(key))
    .map((key) => `${key} ${customFields[key]}`);
}
