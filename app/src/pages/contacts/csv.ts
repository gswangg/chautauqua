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

/** Standard target fields the mapping wizard offers, plus free-form 'custom.<key>'. */
export const STANDARD_IMPORT_FIELDS = ['firstName', 'lastName', 'email', 'company', 'title', 'phone'] as const;
export type StandardImportField = (typeof STANDARD_IMPORT_FIELDS)[number];

export interface MappedContactRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
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
