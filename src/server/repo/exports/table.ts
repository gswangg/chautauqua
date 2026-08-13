// Shared pure row-shaping primitives used by every export kind in this
// directory (DEC-027): the ExportTable shape, the buildTable/buildTable's
// records-view helper, minutesToClock, and the dynamic-custom-column naming
// helper shared by submissions.ts and evaluations.ts (DEC-529).

// DEC-027 amendment (wave 50): the bound lives on the QUERY, not on a check
// after rows are already in memory. Derivation, modelled on DEC-353's
// archive-cap arithmetic (src/routes/files.ts:324-333):
//   - average serialized row width: ~500 bytes (a wide submissions/contacts
//     row with several dynamic custom-field/score columns, each cell
//     duplicated once as a CSV string cell and once as a JSON record value)
//   - peak multiplier: 3x — the driving SELECT's row objects, the shaped
//     string[][]/records[] view (buildTable holds both simultaneously), and
//     the toCsv-joined single string/JSON-stringified body all live in the
//     isolate at once for format=csv or format=json respectively
//   - EXPORT_MAX_ROWS x 500 bytes x 3 = 20,000 x 1,500 bytes = 30,000,000
//     bytes (~28.6 MB), which is comfortably under 0.75 x 128 MB (96 MB) of
//     ISOLATE_MEMORY_BUDGET_BYTES (see test/exports-bounds.test.ts) even
//     before accounting for query/route overhead already running in the
//     isolate.
export const EXPORT_MAX_ROWS = 20000;

export interface ExportTable {
  header: string[];
  rows: string[][];
  /** Same records as an array of objects keyed by header, for format=json. */
  records: Record<string, string>[];
  /** True when the driving row query came back with EXPORT_MAX_ROWS + 1 rows
   * (the extra row proving there is more data than the cap allows) — the
   * extra row itself is always dropped, never shaped into `rows`/`records`.
   * The route refuses (ApiError) rather than shipping a silently-truncated
   * file. */
  truncated: boolean;
}

export function buildTable(header: string[], rows: string[][], truncated = false): ExportTable {
  const records = rows.map((row) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      rec[h] = row[i] ?? "";
    });
    return rec;
  });
  return { header, rows, records, truncated };
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
