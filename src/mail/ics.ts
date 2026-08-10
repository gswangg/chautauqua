// .ics generation (DEC-007): stable UID from submission id, SEQUENCE bumped
// by caller, METHOD:REQUEST, LOCATION only when provided, UTC times, 75-octet
// line folding, CRLF line endings.

export interface IcsEventInput {
  uidSubmissionId: string;
  sequence: number;
  title: string;
  description?: string;
  startUtc: Date;
  endUtc: Date;
  location?: string;
  dtstamp: Date;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatIcsDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// RFC 5545 §3.1: lines folded at 75 octets, continuation lines start with a
// single space. Fold on UTF-8 byte boundaries, never splitting a multi-byte
// character.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off if we'd split a multi-byte UTF-8 sequence (continuation
    // bytes have the high bit pattern 10xxxxxx, i.e. 0x80-0xBF).
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1;
    }
    chunks.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines lose one octet to the leading space
  }
  return chunks.join("\r\n ");
}

function uidFor(submissionId: string): string {
  return `chq-${submissionId}@chautauqua`;
}

function buildVevent(e: IcsEventInput): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${uidFor(e.uidSubmissionId)}`);
  lines.push(`SEQUENCE:${e.sequence}`);
  lines.push(`DTSTAMP:${formatIcsDate(e.dtstamp)}`);
  lines.push(`DTSTART:${formatIcsDate(e.startUtc)}`);
  lines.push(`DTEND:${formatIcsDate(e.endUtc)}`);
  lines.push(`SUMMARY:${escapeText(e.title)}`);
  if (e.description !== undefined) {
    lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  }
  if (e.location !== undefined) {
    lines.push(`LOCATION:${escapeText(e.location)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcsEvent(e: IcsEventInput): string {
  return buildIcsCalendar([e]);
}

/** Escapes a filename for a Content-Disposition header value (strips CR/LF
 * and double quotes, which would otherwise let it break out of the quoted
 * string / inject headers). */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[\r\n"]/g, "");
}

/**
 * Headers for serving a stored .ics file as a download (dev mailbox detail
 * view, DEC-006): 'text/calendar' with the stored filename, never served as
 * an inline page.
 */
export function icsDownloadHeaders(filename: string): Record<string, string> {
  const safeName = sanitizeFilename(filename);
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${safeName}"`,
  };
}

export function buildIcsCalendar(events: IcsEventInput[]): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Chautauqua//Chautauqua//EN");
  lines.push("METHOD:REQUEST");
  for (const e of events) {
    lines.push(...buildVevent(e));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
