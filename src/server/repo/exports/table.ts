// Shared pure row-shaping primitives used by every export kind in this
// directory (DEC-027): the ExportTable shape, the buildTable/buildTable's
// records-view helper, minutesToClock, and the dynamic-custom-column naming
// helper shared by submissions.ts and evaluations.ts (DEC-529).

export interface ExportTable {
  header: string[];
  rows: string[][];
  /** Same records as an array of objects keyed by header, for format=json. */
  records: Record<string, string>[];
}

export function buildTable(header: string[], rows: string[][]): ExportTable {
  const records = rows.map((row) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      rec[h] = row[i] ?? "";
    });
    return rec;
  });
  return { header, rows, records };
}

export function minutesToClock(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** A custom (non-locked-built-in) form field / criterion to render as its
 * own dynamic export column, ordered/deduped by the caller. */
export interface CustomFieldColumn {
  fieldId: string;
  label: string;
}

/** Names each custom column: the field's label, unless that label is empty,
 * collides with another custom field's label, or collides with a fixed
 * column name — in which case ' (<fieldId>)' is appended so every header
 * cell stays unique (a duplicate header silently eats a column in
 * buildTable's JSON `records`). Shared by submissions.ts (form-field
 * columns) and evaluations.ts (DEC-529 score columns), each passing its own
 * fixed column set. */
export function nameCustomColumns(customFields: CustomFieldColumn[], fixedNames: ReadonlySet<string>): string[] {
  const labelCounts = new Map<string, number>();
  for (const f of customFields) labelCounts.set(f.label, (labelCounts.get(f.label) ?? 0) + 1);
  return customFields.map((f) => {
    const isEmpty = f.label.trim() === "";
    const isDuplicate = (labelCounts.get(f.label) ?? 0) > 1;
    const isFixedName = fixedNames.has(f.label);
    return isEmpty || isDuplicate || isFixedName ? `${f.label} (${f.fieldId})` : f.label;
  });
}
