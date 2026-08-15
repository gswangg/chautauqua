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

// DEC-675: the importer speaks the product's own vocabularies, imported
// (never retyped) from their single owning modules -- a hand-copied list
// drifts the moment either module changes.
import { SUBMISSION_STATUSES } from "./status";
import { PARTICIPANT_ROLE_OPTIONS } from "./participant-roles";
// DEC-417 (amendment): the sessionboard importer writes the same
// schema.contact/schema.submission columns the hand-typed editors write
// (src/routes/api/contacts/crud.ts, src/routes/api/contacts/import.ts:107)
// -- capped here at plan time with the SAME constants, never a locally
// hand-typed number.
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH } from "../forms/validate";

const SUBMISSION_STATUS_SET = new Set<string>(SUBMISSION_STATUSES);
const PARTICIPANT_ROLE_SET = new Set<string>(PARTICIPANT_ROLE_OPTIONS.map((o) => o.value));

/** DEC-417 (amendment): per-column caps for the sessionboard importer's
 * mapped fields -- the SAME caps every hand-typed writer of these columns
 * enforces (src/domain/contacts.ts's importFieldCapViolations for the
 * contacts entity, MAX_NAME_LENGTH for submission title matching
 * src/routes/api/contacts/import.ts:107's sessionTitle check). Entities/
 * fields absent from this map are uncapped by this pass (out of this
 * task's scope). */
const SB_FIELD_CAPS: Partial<Record<SbEntity, Record<string, number>>> = {
  contacts: {
    email: MAX_NAME_LENGTH,
    firstName: MAX_NAME_LENGTH,
    lastName: MAX_NAME_LENGTH,
    company: MAX_NAME_LENGTH,
    title: MAX_NAME_LENGTH,
    phone: MAX_NAME_LENGTH,
    bio: MAX_LONG_TEXT_LENGTH,
  },
  submissions: {
    title: MAX_NAME_LENGTH,
  },
};

/** Normalizes a status cell for vocabulary matching: trim, lowercase,
 * collapse whitespace/hyphens to underscores (e.g. "Accept Queue" ->
 * "accept_queue"). */
function normalizeStatusCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Builds the namespaced external_ref value: "<source>:<their id>". */
export function externalRef(source: string, recordId: string): string {
  return `${source}:${recordId}`;
}

export type SbEntity = "contacts" | "submissions" | "tracks" | "participants";

/** Canonical target field names per entity. "externalId" is special: it is
 * never written as a `values` key (planSessionboardRows turns it into
 * `externalRef` instead), every other field is a passthrough column.
 *
 * participants deliberately has NO "externalId" (DEC-639): a participant is
 * a join row identified by the (submission, contact) pair it already names,
 * never a third namespace of its own. Its identity fields
 * (sessionExternalId/speakerExternalId/speakerEmail) are ordinary
 * passthrough `values` instead, resolved against the other entities by the
 * repo layer. */
export const SB_TARGET_FIELDS: Record<SbEntity, readonly string[]> = {
  contacts: ["externalId", "email", "firstName", "lastName", "company", "title", "phone", "bio"],
  submissions: ["externalId", "title", "description", "trackName", "status"],
  tracks: ["externalId", "name", "color"],
  participants: ["sessionExternalId", "speakerExternalId", "speakerEmail", "role", "order"],
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
  participants: {
    sessionExternalId: ["session id", "session record id", "submission id"],
    speakerExternalId: ["speaker id", "speaker record id", "contact id"],
    speakerEmail: ["speaker email", "email", "email address"],
    role: ["role", "participant role", "speaker role"],
    order: ["order", "position", "speaker order"],
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

    // DEC-417 (amendment): a mapped value over the same cap the hand-typed
    // editor enforces for that column is refused HERE, at plan time -- the
    // key is dropped (never truncated) and an issue names the row+field, so
    // the dry run never mints a value the field's own drawer would then
    // refuse to re-save.
    const fieldCaps = SB_FIELD_CAPS[entity];
    if (fieldCaps) {
      for (const [field, max] of Object.entries(fieldCaps)) {
        const value = values[field];
        if (value !== undefined && value.length > max) {
          issues.push({
            row: rowNumber,
            field,
            message: `${field} exceeds ${max} characters -- dropped`,
          });
          delete values[field];
        }
      }
    }

    // DEC-675: validate against the product's own vocabularies HERE, in the
    // planner -- the dry run must name the row+field+value the real run
    // would otherwise corrupt. An unrecognised value yields an issue and the
    // key is dropped so the row still imports (with the writer's default)
    // rather than writing an out-of-vocabulary literal into the column.
    if (entity === "submissions" && values.status !== undefined) {
      const normalized = normalizeStatusCell(values.status);
      if (!SUBMISSION_STATUS_SET.has(normalized)) {
        issues.push({
          row: rowNumber,
          field: "status",
          message: `Unrecognised submission status "${values.status}" -- imported as pending`,
        });
        delete values.status;
      } else {
        values.status = normalized;
      }
    }

    if (entity === "participants" && values.role !== undefined) {
      if (!PARTICIPANT_ROLE_SET.has(values.role)) {
        issues.push({
          row: rowNumber,
          field: "role",
          message: `Unrecognised participant role "${values.role}" -- dropped`,
        });
        delete values.role;
      }
    }

    if (entity === "participants" && values.order !== undefined) {
      const isNonNegativeInteger = /^\d+$/.test(values.order);
      if (!isNonNegativeInteger) {
        issues.push({
          row: rowNumber,
          field: "order",
          message: `Invalid participant order "${values.order}" -- dropped`,
        });
        delete values.order;
      }
    }

    if (!targetFields.has("externalId")) {
      // participants (DEC-639): no ref of its own to mint. Require a
      // session ref, and either a speaker ref or a speaker email -- the
      // repo layer resolves both against the other entities.
      if (!values.sessionExternalId) {
        issues.push({ row: rowNumber, field: "sessionExternalId", message: "Missing session external id" });
      } else if (!values.speakerExternalId && !values.speakerEmail) {
        issues.push({
          row: rowNumber,
          field: "speakerExternalId",
          message: "Missing speaker external id or speaker email",
        });
      }
      plans.push({ row: rowNumber, externalRef: null, values });
      return;
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
