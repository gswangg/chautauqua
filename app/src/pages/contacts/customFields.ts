// DEC-292: contact custom fields are edited as key/value rows plus a
// reserved `travel_logistics` field surfaced as a labeled textarea. This
// module owns the pure serialize/deserialize rules so they are testable
// without a DOM and shared by ContactDrawer.

export const TRAVEL_KEY = 'travel_logistics';

export interface CustomFieldRow {
  key: string;
  value: string;
}

/**
 * Splits a customFields map into the travel textarea value and the
 * remaining key/value rows, in stable key order.
 */
export function toRows(fields: Record<string, string>): CustomFieldRow[] {
  return Object.keys(fields)
    .filter((key) => key !== TRAVEL_KEY)
    .map((key) => ({ key, value: fields[key] ?? '' }));
}

export function travelValue(fields: Record<string, string>): string {
  return fields[TRAVEL_KEY] ?? '';
}

export type FromRowsResult = { fields: Record<string, string> } | { error: string };

/**
 * Reassembles the customFields map from the travel textarea value and the
 * key/value rows, implementing DEC-292's validation rules:
 * - keys are trimmed
 * - a row blank in both key and value is dropped
 * - a blank key with a non-blank value is an error
 * - duplicate trimmed keys is an error naming the key
 * - a hand-typed `travel_logistics` key is an error pointing at the labeled field
 * - the travel key is included only when the travel text is non-blank
 */
export function fromRows(travel: string, rows: CustomFieldRow[]): FromRowsResult {
  const fields: Record<string, string> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value;
    const valueBlank = value.trim() === '';

    if (key === '' && valueBlank) {
      continue;
    }
    if (key === '' && !valueBlank) {
      return { error: 'Custom field rows with a value must also have a key.' };
    }
    if (key === TRAVEL_KEY) {
      return {
        error: `"${TRAVEL_KEY}" is reserved for the Travel & logistics field above — use that field instead.`,
      };
    }
    if (seen.has(key)) {
      return { error: `Duplicate custom field key "${key}".` };
    }
    seen.add(key);
    fields[key] = value;
  }

  if (travel.trim() !== '') {
    fields[TRAVEL_KEY] = travel;
  }

  return { fields };
}
