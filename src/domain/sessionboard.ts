// Sessionboard import, layer 1 of 3 (DEC-612, DEC-613): pure mapping +
// planning core. No node:/cloudflare imports (DEC-002) -- this module is
// consumed by both the route layer (task-w5-b/c) and its own tests with no
// runtime dependency beyond plain JS.
//
// DEC-612: every imported row's identity is a namespaced
// "<source>:<their id>" external_ref, never a bare id, so two sources can
// never collide. DEC-613: this planner is the ONE code path dry run and
// real run both go through -- the route layer (not this file) decides
// whether to execute the writes this plan implies.

/** Lower-snake source tag for every ref this importer mints. */
export const SESSIONBOARD_SOURCE = "sessionboard";

/** Builds the namespaced external_ref value: "<source>:<their id>". */
export function externalRef(source: string, recordId: string): string {
  return `${source}:${recordId}`;
}

export type SbEntity = "contacts" | "submissions" | "tracks";

/** Canonical target field names per entity. "externalId" is special: it is
 * never written as a `values` key (planSessionboardRows turns it into
 * `externalRef` instead), every other field is a passthrough column. */
export const SB_TARGET_FIELDS: Record<SbEntity, readonly string[]> = {
  contacts: ["externalId", "email", "firstName", "lastName", "company", "title", "phone", "bio"],
  submissions: ["externalId", "title", "description", "trackName", "status"],
  tracks: ["externalId", "name", "color"],
};

export interface SbRowPlan {
  row: number;
  externalRef: string | null;
  values: Record<string, string>;
}

export interface SbIssue {
  row: number;
  field: string;
  message: string;
}

/** Normalizes a header cell for case/space/underscore-insensitive matching:
 * lowercase, strip spaces and underscores. */
function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s_]+/g, "");
}

// Alias lists per entity/target field, matched via normalizeHeaderCell
// against both the alias and the incoming header cell.
const SB_ALIASES: Record<SbEntity, Record<string, readonly string[]>> = {
  contacts: {
    externalId: ["record id", "id", "contact id", "speaker id"],
    email: ["email", "speaker email", "email address"],
    firstName: ["first name", "speaker first name"],
    lastName: ["last name", "speaker last name"],
    company: ["company", "organization"],
    title: ["title", "job title"],
    phone: ["phone", "phone number"],
    bio: ["bio", "biography", "speaker bio"],
  },
  submissions: {
    externalId: ["record id", "id", "submission id", "session id"],
    title: ["title", "session title", "talk title"],
    description: ["description", "abstract", "session description"],
    trackName: ["track", "track name"],
    status: ["status", "session status"],
  },
  tracks: {
    externalId: ["record id", "id", "track id"],
    name: ["name", "track name"],
    color: ["color", "colour", "track color"],
  },
};

/** Matches CSV header columns to SB_TARGET_FIELDS[entity] by normalized
 * alias, case/space/underscore-insensitive (e.g. 'Speaker Email' -> email,
 * 'Session Title' -> title, 'Record ID'|'Id' -> externalId). Returns a
 * column -> target field map; columns with no match are simply absent (the
 * caller may still hand-map them). First alias match wins per column; a
 * column never maps to more than one field. */
export function autoMapSessionboardColumns(entity: SbEntity, header: readonly string[]): Record<string, string> {
  const aliasesByField = SB_ALIASES[entity];
  const normalizedAliasToField = new Map<string, string>();
  for (const field of SB_TARGET_FIELDS[entity]) {
    for (const alias of aliasesByField[field] ?? []) {
      normalizedAliasToField.set(normalizeHeaderCell(alias), field);
    }
  }

  const mapping: Record<string, string> = {};
  for (const column of header) {
    const field = normalizedAliasToField.get(normalizeHeaderCell(column));
    if (field) mapping[column] = field;
  }
  return mapping;
}

/** Plans every row against the given column->field mapping. A row with no
 * external id yields an ISSUE naming the row (never a silent skip); a blank
 * cell is absent data, so its key is omitted from `values` rather than
 * written as ''. Rows are 1-indexed against the CSV file counting the
 * header as row 1 (first data row is row 2), matching the CRM importer's
 * `line` convention (src/routes/api/contacts/import.ts). */
export function planSessionboardRows(
  entity: SbEntity,
  header: readonly string[],
  rows: readonly string[][],
  mapping: Record<string, string>,
): { plans: SbRowPlan[]; issues: SbIssue[] } {
  const plans: SbRowPlan[] = [];
  const issues: SbIssue[] = [];
  const targetFields = new Set(SB_TARGET_FIELDS[entity]);

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const values: Record<string, string> = {};
    let externalId: string | undefined;

    for (let i = 0; i < header.length; i++) {
      const column = header[i];
      if (column === undefined) continue;
      const target = mapping[column];
      if (!target || !targetFields.has(target)) continue;
      const raw = row[i];
      const value = raw === undefined ? "" : raw.trim();
      // A blank cell is absent data -- omit the key rather than writing ''.
      if (value === "") continue;

      if (target === "externalId") {
        externalId = value;
        continue;
      }
      values[target] = value;
    }

    if (!externalId) {
      issues.push({ row: rowNumber, field: "externalId", message: "Missing external id (Record ID)" });
      plans.push({ row: rowNumber, externalRef: null, values });
      return;
    }

    plans.push({ row: rowNumber, externalRef: externalRef(SESSIONBOARD_SOURCE, externalId), values });
  });

  return { plans, issues };
}
