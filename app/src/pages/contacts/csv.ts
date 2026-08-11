// Client-side CSV helpers for the contact-import wizard (J11, DEC-026). The
// app package builds against its own tsconfig (app/tsconfig.json, "include":
// ["src"]) and cannot import src/lib/csv.ts across the package boundary, so
// this mirrors its RFC 4180 behavior at the level the wizard needs: enough
// to preview + map columns client-side. The server (src/lib/csv.ts +
// src/domain/contacts.ts's mapImportRow) is the authority for the actual
// import; this is best-effort preview parsing only, matching
// upload-validation.ts's "mirror the server, server wins" pattern.

/**
 * Parses RFC 4180 CSV text into rows of string fields. Handles quoted
 * fields (embedded commas/newlines, doubled "" escapes), CRLF/LF/bare-CR
 * line endings, and strips a leading BOM. A single trailing blank line is
 * dropped so `"a,b\n"` parses to one row, not two.
 */
export function parseCsv(text: string): string[][] {
  if (text.startsWith('﻿')) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"' && field === '') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 2;
      continue;
    }
    if (c === '\n' || c === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }

  if (inQuotes) {
    throw new Error('Unterminated quoted field in CSV');
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Standard target fields the mapping wizard offers, plus free-form 'custom.<key>'.
 * Kept exactly aligned with the server's pure-core mapImportRow
 * (src/domain/contacts.ts) target-field switch, which throws on an
 * unrecognized target (P1 fix, w1-f) — phone and bio are supported there
 * (DEC-290), so they're offered here too. */
export const STANDARD_IMPORT_FIELDS = ['firstName', 'lastName', 'email', 'company', 'title', 'phone', 'bio'] as const;
export type StandardImportField = (typeof STANDARD_IMPORT_FIELDS)[number];

/**
 * P1 fix (w1-f): a fixture/export CSV frequently carries one combined "name"
 * column (e.g. docs/fixtures/speakers.csv's `name` header, "Priya Raman")
 * rather than separate first/last columns. The server's mapImportRow
 * (src/domain/contacts.ts) only understands firstName/lastName/email/
 * company/title targets — there's no wire-level "split this value" target —
 * so a wizard user mapping a combined name column to just "firstName" (the
 * only option that reads like a name field) silently dropped the surname on
 * every imported row. This client-only pseudo-target lets the wizard offer
 * "Full name (splits into first / last)"; expandFullNameMapping() below
 * rewrites the CSV + mapping into columns the server already supports
 * *before* the request is sent, so no server/domain change is needed.
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

/** RFC 4180 serializer (mirrors parseCsv's dialect): quotes a field only
 * when it contains a comma, quote, or newline, doubling embedded quotes. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\n') + '\n';
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

export interface MappedContactRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  bio?: string;
  customFields?: Record<string, string>;
}

/**
 * Applies a column -> target-field mapping (target is a StandardImportField
 * or 'custom.<name>') to one parsed CSV row, mirroring the wire semantics of
 * src/domain/contacts.ts's mapImportRow: unmapped columns are ignored, and a
 * missing/blank mapped email yields {} so the caller can skip the row.
 */
export function mapImportRow(mapping: Record<string, string>, header: string[], row: string[]): MappedContactRow {
  const result: MappedContactRow = {};
  const customFields: Record<string, string> = {};
  let hasCustom = false;

  for (let i = 0; i < header.length; i++) {
    const column = header[i];
    if (column === undefined) continue;
    const target = mapping[column];
    if (!target) continue;
    const value = row[i] ?? '';

    if (target.startsWith('custom.')) {
      const key = target.slice('custom.'.length);
      customFields[key] = value;
      hasCustom = true;
      continue;
    }

    if (target === FULL_NAME_TARGET) {
      const { firstName, lastName } = splitFullName(value);
      if (firstName) result.firstName = firstName;
      if (lastName) result.lastName = lastName;
      continue;
    }

    if ((STANDARD_IMPORT_FIELDS as readonly string[]).includes(target)) {
      (result as Record<string, string>)[target] = value;
    } else {
      throw new Error(`mapImportRow: unknown target field "${target}"`);
    }
  }

  if (hasCustom) result.customFields = customFields;

  if (!result.email || result.email.trim() === '') {
    return {};
  }

  return result;
}

/** True when a mapping wizard row (post mapImportRow) has no usable data — used to compute "skipped" preview counts. */
export function isEmptyMappedRow(row: MappedContactRow): boolean {
  return Object.keys(row).length === 0;
}

function normalizeHeaderName(col: string): string {
  return col.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** column-name aliases (normalized: lowercase, non-alnum stripped) that
 * should auto-map to each standard field. */
const FIELD_ALIASES: Record<StandardImportField, string[]> = {
  firstName: ['firstname', 'first', 'fname', 'givenname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  email: ['email', 'emailaddress', 'e-mail', 'mail'],
  company: ['company', 'organization', 'organisation', 'employer'],
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
    const match = (Object.entries(FIELD_ALIASES) as [StandardImportField, string[]][]).find(([, aliases]) =>
      aliases.includes(normalized),
    );
    if (match) {
      mapping[col] = match[0];
    } else if (FULL_NAME_ALIASES.includes(normalized)) {
      mapping[col] = FULL_NAME_TARGET;
    }
  }
  return mapping;
}
