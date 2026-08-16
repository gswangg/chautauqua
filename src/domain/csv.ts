// Zero-dependency RFC 4180 CSV utilities (DEC-011).
//
// Pure module: no node:/cloudflare imports, only plain JS/TS + Web APIs, per
// the pure-core rule (DEC-002). Used by every CSV export surface (J12, via
// toCsv) and by CSV parsing at import boundaries (J11, via parseCsv).

/**
 * Thrown when parseCsv encounters input that cannot be parsed as valid CSV
 * (e.g. an unterminated quoted field). External input at this boundary gets
 * a real, actionable error rather than silent truncation or a best-effort
 * guess.
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

/**
 * Serializes rows into CSV text with NO DEC-179 formula-injection
 * neutralization (no leading-apostrophe prefixing of `= + - @`-led cells).
 *
 * This must never be named `toCsv`, and must never be pointed at an export
 * surface: it exists ONLY for text this application re-parses ITSELF (the
 * import wizard's preview -> commit round trip, see
 * app/src/pages/contacts/ImportWizard.tsx). toCsv's apostrophe prefix is
 * correct for a file a human opens in a spreadsheet, but corrupts data our
 * own parseCsv will read right back -- a `+1 555 0100` phone number or a
 * `--Keynote--` title would silently gain a leading `'` on every preview ->
 * commit round trip, and (being CSV-legal) never surface as an error. Two
 * differently-named functions mean a future caller reading only the name
 * can never wire an export surface to the unsafe one by accident, and can
 * never wire this re-parsed-by-us round trip to the apostrophe-mangling one
 * (DEC-179 amendment, wave 65).
 *
 * Fields are quoted only when they contain a comma, double-quote, or
 * newline; embedded double-quotes are doubled. Rows are joined with `\n`
 * (not CRLF), with a trailing newline.
 */
export function toCsvVerbatim(rows: string[][]): string {
  return rows.map((row) => row.map(formatCellVerbatim).join(",")).join("\n") + "\n";
}

function formatCellVerbatim(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n") || cell.includes("\r")) {
    return '"' + cell.replace(/"/g, '""') + '"';
  }
  return cell;
}

function formatCell(cell: string | number | null): string {
  if (cell === null) {
    return "";
  }
  if (typeof cell === "number") {
    return String(cell);
  }
  // DEC-179: neutralize CSV formula injection. A string cell whose first
  // character could be interpreted by spreadsheet software as the start of
  // a formula/command gets a leading apostrophe, applied before the
  // existing quote-when-needed logic runs.
  let text = cell;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}
