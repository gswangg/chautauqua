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
 * Deliberately NOT 'phone': the server's pure-core ContactRecord/mapImportRow
 * (src/domain/contacts.ts) has no phone field and throws on an unrecognized
 * target, so offering it here would let a user pick a mapping that 500s the
 * whole import (P1 fix, w1-f) — keep this list exactly aligned with what the
 * server import path supports. */
export const STANDARD_IMPORT_FIELDS = ['firstName', 'lastName', 'email', 'company', 'title'] as const;
export type StandardImportField = (typeof STANDARD_IMPORT_FIELDS)[number];

export interface MappedContactRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
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
};

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
    if (match) mapping[col] = match[0];
  }
  return mapping;
}
