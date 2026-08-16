// Client-side helpers for the contact-import wizard (J11, DEC-026).
//
// DEC-011/DEC-179/DEC-478 amendment (wave 65): parseCsv, toCsv and
// mapImportRow used to be reimplemented here, justified by a comment
// claiming the app package "cannot import src/domain/csv.ts across the
// package boundary" -- that premise was false (app/tsconfig.json's
// "include" already lists "../src/domain/**/*.ts", and this file's own
// consumer, ImportWizard.tsx, already imports validateImportMapping
// straight from the domain). The two copies had diverged: this file's
// parser threw a bare Error with no line number where the domain's throws
// CsvParseError naming the line, and this file's mapImportRow accepted
// custom.<key> targets the domain's rejected against a stale hand-listed
// switch. This file now re-exports the domain's parseCsv (src/domain/csv.ts)
// and mapImportRow/STANDARD_IMPORT_FIELDS (src/domain/contacts-parts/import.ts)
// directly -- there is exactly ONE implementation of each, used by both the
// wizard's client-side preview and the server's actual import. The wizard
// serializes its preview -> commit payload with toCsvVerbatim (also
// src/domain/csv.ts), never toCsv (DEC-179): this app re-parses its own
// output, and toCsv's formula-injection apostrophe would corrupt it.
//
// What stays here, and why (client-side by REASON, not by accident): the
// server never runs FULL_NAME_TARGET/splitFullName/expandFullNameMapping or
// suggestMapping -- they only ever rewrite a request BEFORE it is sent, so
// they have no server-side counterpart to converge with.
export { parseCsv, toCsvVerbatim } from '../../../../src/domain/csv';
export { mapImportRow, STANDARD_IMPORT_FIELDS } from '../../../../src/domain/contacts-parts/import';

/**
 * P1 fix (w1-f): a fixture/export CSV frequently carries one combined "name"
 * column (e.g. docs/fixtures/speakers.csv's `name` header, "Priya Raman")
 * rather than separate first/last columns. The server's mapImportRow
 * (src/domain/contacts-parts/import.ts) only understands the
 * STANDARD_IMPORT_FIELDS targets -- there's no wire-level "split this value"
 * target -- so a wizard user mapping a combined name column to just
 * "firstName" (the only option that reads like a name field) silently
 * dropped the surname on every imported row. This client-only pseudo-target
 * lets the wizard offer "Full name (splits into first / last)";
 * expandFullNameMapping() below rewrites the CSV + mapping into columns the
 * server already supports *before* the request is sent, so no server/domain
 * change is needed.
 */
export const FULL_NAME_TARGET = 'fullName';

/** Splits "Priya Raman" into { firstName: 'Priya', lastName: 'Raman' }.
 * Splits on the first space: everything before it is the first name,
 * everything after is the last name. A single-token name (no space) becomes
 * firstName only, matching how a human would read it. */
export function splitFullName(value: string): { firstName: string; lastName: string } {
  const trimmed = value.trim();
  if (trimmed === '') return { firstName: '', lastName: '' };
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, idx).trim(), lastName: trimmed.slice(idx + 1).trim() };
}

/**
 * Rewrites a parsed CSV + mapping so that any column mapped to
 * FULL_NAME_TARGET is replaced by two new columns (already split via
 * splitFullName) mapped to firstName/lastName, and everything else passes
 * through unchanged. Returns a new {header, rows, mapping} the server's
 * mapImportRow already understands.
 */
export function expandFullNameMapping(
  header: string[],
  dataRows: string[][],
  mapping: Record<string, string>,
): { header: string[]; rows: string[][]; mapping: Record<string, string> } {
  const fullNameCols = header.filter((col) => mapping[col] === FULL_NAME_TARGET);
  if (fullNameCols.length === 0) {
    return { header, rows: dataRows, mapping };
  }

  const nextHeader: string[] = [];
  const nextMapping: Record<string, string> = {};

  header.forEach((col) => {
    if (mapping[col] === FULL_NAME_TARGET) {
      const firstCol = `${col} (first)`;
      const lastCol = `${col} (last)`;
      nextHeader.push(firstCol, lastCol);
      nextMapping[firstCol] = 'firstName';
      nextMapping[lastCol] = 'lastName';
    } else {
      nextHeader.push(col);
      if (mapping[col]) nextMapping[col] = mapping[col];
    }
  });

  const nextRows = dataRows.map((row) => {
    const out: string[] = [];
    header.forEach((col, i) => {
      if (mapping[col] === FULL_NAME_TARGET) {
        const { firstName, lastName } = splitFullName(row[i] ?? '');
        out.push(firstName, lastName);
      } else {
        out.push(row[i] ?? '');
      }
    });
    return out;
  });

  return { header: nextHeader, rows: nextRows, mapping: nextMapping };
}

function normalizeHeaderName(col: string): string {
  return col.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** column-name aliases (normalized: lowercase, non-alnum stripped) that
 * should auto-map to each standard field. */
const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ['firstname', 'first', 'fname', 'givenname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  email: ['email', 'emailaddress', 'e-mail', 'mail'],
  company: ['company', 'organization', 'organisation', 'employer', 'org', 'orgname', 'companyname'],
  title: ['title', 'jobtitle', 'role'],
  phone: ['phone', 'phonenumber', 'telephone', 'mobile', 'cell'],
  bio: ['bio', 'biography', 'about'],
};

/** column-name aliases that indicate a single combined "full name" column
 * (see FULL_NAME_TARGET) rather than separate first/last columns. */
const FULL_NAME_ALIASES = ['name', 'fullname', 'contactname', 'speakername'];

/**
 * P1 fix (w1-f): a pasted/uploaded CSV whose header already spells out the
 * standard field names (e.g. "Email", "First Name") previously left the
 * mapping wizard's per-column <select> defaulted to "(ignore)" until a user
 * manually picked every column — a CSV with an obviously-named email column
 * would silently import 0 rows (every row skipped as "missing email") unless
 * the user hand-mapped it first. This suggests a starting mapping by
 * matching normalized header names against FIELD_ALIASES; callers still let
 * the user override any suggestion via the mapping <select>.
 */
export function suggestMapping(header: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const col of header) {
    const normalized = normalizeHeaderName(col);
    const match = Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.includes(normalized));
    if (match) {
      mapping[col] = match[0];
    } else if (FULL_NAME_ALIASES.includes(normalized)) {
      mapping[col] = FULL_NAME_TARGET;
    }
  }
  return mapping;
}
