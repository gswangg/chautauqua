// DEC-292: contact custom fields are edited as key/value rows plus three
// reserved fields (dietary, travel/logistics, accessibility -- amendment
// findings wave 5) surfaced as labeled textareas. This module owns the pure
// serialize/deserialize rules so they are testable without a DOM and shared
// by ContactDrawer.

// DEC-738/DEC-726: the reserved keys are owned by
// src/domain/contact-labels.ts (the server-importable Labels formatter) --
// imported here rather than re-declared, so the reserved key strings have
// exactly one source.
import {
  RESERVED_CUSTOM_FIELD_KEYS,
  RESERVED_CUSTOM_FIELD_LABELS,
} from '../../../../src/domain/contact-labels';
export { RESERVED_CUSTOM_FIELD_KEYS, RESERVED_CUSTOM_FIELD_LABELS };

const RESERVED_KEY_SET: Set<string> = new Set(Object.values(RESERVED_CUSTOM_FIELD_KEYS));

export interface CustomFieldRow {
  key: string;
  value: string;
}

/**
 * Splits a customFields map into the three reserved fields' textarea
 * values plus the remaining key/value rows, in stable key order.
 */
export function toRows(fields: Record<string, string>): CustomFieldRow[] {
  return Object.keys(fields)
    .filter((key) => !RESERVED_KEY_SET.has(key))
    .map((key) => ({ key, value: fields[key] ?? '' }));
}

export function reservedValue(
  fields: Record<string, string>,
  key: (typeof RESERVED_CUSTOM_FIELD_KEYS)[keyof typeof RESERVED_CUSTOM_FIELD_KEYS],
): string {
  return fields[key] ?? '';
}

export type FromRowsResult = { fields: Record<string, string> } | { error: string };

/**
 * Reassembles the customFields map from the three reserved textarea values
 * and the key/value rows, implementing DEC-292's validation rules:
 * - keys are trimmed
 * - a row blank in both key and value is dropped
 * - a blank key with a non-blank value is an error
 * - duplicate trimmed keys is an error naming the key
 * - a hand-typed reserved key is an error pointing at the labeled field
 * - each reserved key is included only when its text is non-blank
 */
export function fromRows(
  reserved: { dietary: string; travel: string; accessibility: string },
  rows: CustomFieldRow[],
): FromRowsResult {
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
    if (RESERVED_KEY_SET.has(key)) {
      const label = RESERVED_CUSTOM_FIELD_LABELS[key as keyof typeof RESERVED_CUSTOM_FIELD_LABELS];
      return {
        error: `"${key}" is reserved for the ${label} field above — use that field instead.`,
      };
    }
    if (seen.has(key)) {
      return { error: `Duplicate custom field key "${key}".` };
    }
    seen.add(key);
    fields[key] = value;
  }

  if (reserved.dietary.trim() !== '') {
    fields[RESERVED_CUSTOM_FIELD_KEYS.dietary] = reserved.dietary;
  }
  if (reserved.travel.trim() !== '') {
    fields[RESERVED_CUSTOM_FIELD_KEYS.travel] = reserved.travel;
  }
  if (reserved.accessibility.trim() !== '') {
    fields[RESERVED_CUSTOM_FIELD_KEYS.accessibility] = reserved.accessibility;
  }

  return { fields };
}
