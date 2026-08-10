// Zero-dependency RFC 4180 CSV utilities (DEC-011).
//
// Pure module: no node:/cloudflare imports, only plain JS/TS + Web APIs, per
// the pure-core rule (DEC-002). Used by contact import (J11, via
// mapColumns) and every CSV export surface (J12, via toCsv).

/**
 * Thrown when parseCsv encounters input that cannot be parsed as valid CSV
 * (e.g. an unterminated quoted field), or when mapColumns is given a
 * mapping that references a header that does not exist. External input at
 * this boundary gets a real, actionable error rather than silent
 * truncation or a best-effort guess.
 */
export class CsvParseError extends Error {
  /** 1-based line number where the problem was detected, if known. */
  readonly line?: number;

  constructor(message: string, line?: number) {
    super(line !== undefined ? `${message} (line ${line})` : message);
    this.name = "CsvParseError";
    this.line = line;
  }
}

/**
 * Parses RFC 4180 CSV text into an array of rows of string fields.
 *
 * - Handles quoted fields, including embedded commas, newlines, and
 *   escaped double-quotes ("" inside a quoted field).
 * - Accepts both CRLF and bare LF row terminators (and, leniently, a bare
 *   CR).
 * - Strips a single leading UTF-8 BOM if present.
 * - Ignores exactly one trailing empty line (a single trailing newline at
 *   end of input does not produce a spurious final empty row); additional
 *   trailing blank lines are preserved as empty rows.
 * - Throws CsvParseError (with the line number where the offending quote
 *   was opened) if a quoted field is never closed.
 */
export function parseCsv(text: string): string[][] {
  if (text.startsWith("﻿")) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let quoteStartLine = 1;

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
      if (c === "\n") {
        line++;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"' && field === "") {
      inQuotes = true;
      quoteStartLine = line;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      line++;
      i += 2;
      continue;
    }
    if (c === "\n" || c === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      line++;
      i++;
      continue;
    }
    field += c;
    i++;
  }

  if (inQuotes) {
    throw new CsvParseError(
      "Unterminated quoted field",
      quoteStartLine,
    );
  }

  // A single trailing empty line (input ending in a newline) should not
  // produce a spurious final row; anything actually present must be kept.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Serializes rows into RFC 4180 CSV text. Fields are quoted only when they
 * contain a comma, double-quote, or newline; embedded double-quotes are
 * doubled. Rows are joined with CRLF. `null` cells render as empty
 * strings; numeric cells are stringified.
 */
export function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((row) => row.map(formatCell).join(","))
    .join("\r\n");
}

function formatCell(cell: string | number | null): string {
  if (cell === null) {
    return "";
  }
  const s = typeof cell === "number" ? String(cell) : cell;
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Builds a row-mapper for column-mapped CSV import (J11 contact import).
 *
 * `mapping` maps target field name -> source column header name. Given the
 * parsed header row, returns a function that projects a data row into a
 * `{ targetField: value }` object. Throws CsvParseError immediately (at
 * build time, not per-row) if `mapping` references a header not present in
 * `header`.
 */
export function mapColumns(
  header: string[],
  mapping: Record<string, string>,
): (row: string[]) => Record<string, string> {
  const indices: Record<string, number> = {};
  for (const [target, sourceHeader] of Object.entries(mapping)) {
    const idx = header.indexOf(sourceHeader);
    if (idx === -1) {
      throw new CsvParseError(
        `Column mapping references missing header "${sourceHeader}"`,
      );
    }
    indices[target] = idx;
  }

  return (row: string[]) => {
    const result: Record<string, string> = {};
    for (const [target, idx] of Object.entries(indices)) {
      result[target] = row[idx] ?? "";
    }
    return result;
  };
}
