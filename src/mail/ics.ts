// .ics generation (DEC-007, amended by DEC-168 for RFC 5546 compliance):
// stable UID from submission id, SEQUENCE bumped by caller, METHOD is
// caller-supplied (REQUEST for one-to-one scheduling emails, PUBLISH for
// public/anonymous itinerary exports), LOCATION only when provided, UTC
// times, 75-octet line folding, CRLF line endings. Every VEVENT carries an
// ORGANIZER; REQUEST events also carry a single ATTENDEE (fail loudly if
// that pairing is violated).

import { DEC_131 } from "../decisions";
void DEC_131;

/** Dev-local organizer mailbox for outgoing .ics files (DEC-168). No real
 * mailbox exists behind this address in Stage 1 — it is never used to send
 * mail, only to populate the ORGANIZER property. */
export const ICS_ORGANIZER_EMAIL = "noreply@chautauqua.local";

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

export interface IcsPerson {
  name?: string;
  email: string;
}

export interface IcsOptions {
  method: "REQUEST" | "PUBLISH";
  organizer: { name: string; email: string };
  attendee?: IcsPerson;
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

// DEC-131 / DEC-540: normalize CR before escaping so a lone CR (or CRLF) in
// source text never survives as a bare CR inside a content line; both become
// \n like a normal line break. Then, matching sanitizeCn's rule (DEC-499),
// every remaining C0 control byte (0x00-0x1f, including HTAB) and DEL
// (0x7f) is stripped outright — except LF, which is escaped to the literal
// "\n" below along with backslash, ';', and ','. TEXT values reach this
// function from public, unauthenticated CFP text (title/description) and
// room names (location), so control bytes must never survive into SUMMARY,
// DESCRIPTION or LOCATION content lines.
export function sanitizeIcsText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, "")
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

// DEC-499: CN values are quoted-string parameters (RFC 5545 §3.2); QSAFE-CHAR
// is "any character except CTL and DQUOTE", so both DQUOTE and every C0/DEL
// control character (including CR and LF) are stripped outright rather than
// escaped — a bare CRLF here would otherwise inject a new content line into
// the output. This is enforced at the serializer, not upstream, because CN
// values reach this function from three call sites (organizer name derived
// from event.name, and attendee name derived from a contact's name or
// email), one of which — the attendee name on a compose send — originates
// in unauthenticated public CFP text answers. `;`, `:`, `,`, `\`, and
// non-ASCII characters are legal inside a quoted parameter value and must
// survive unchanged.
function sanitizeCn(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/["\x00-\x1f\x7f]/g, "");
}

function buildVevent(e: IcsEventInput, opts: IcsOptions): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${uidFor(e.uidSubmissionId)}`);
  lines.push(`SEQUENCE:${e.sequence}`);
  lines.push(`DTSTAMP:${formatIcsDate(e.dtstamp)}`);
  lines.push(`DTSTART:${formatIcsDate(e.startUtc)}`);
  lines.push(`DTEND:${formatIcsDate(e.endUtc)}`);
  lines.push(`SUMMARY:${sanitizeIcsText(e.title)}`);
  if (e.description !== undefined) {
    lines.push(`DESCRIPTION:${sanitizeIcsText(e.description)}`);
  }
  if (e.location !== undefined) {
    lines.push(`LOCATION:${sanitizeIcsText(e.location)}`);
  }
  lines.push(`ORGANIZER;CN="${sanitizeCn(opts.organizer.name)}":mailto:${opts.organizer.email}`);
  if (opts.method === "REQUEST") {
    const attendee = opts.attendee!;
    lines.push(
      `ATTENDEE;CN="${sanitizeCn(attendee.name ?? attendee.email)}";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}`,
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcsEvent(e: IcsEventInput, opts: IcsOptions): string {
  return buildIcsCalendar([e], opts);
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

export function buildIcsCalendar(events: IcsEventInput[], opts: IcsOptions): string {
  if (opts.method === "REQUEST" && !opts.attendee) {
    throw new Error("buildIcsCalendar: METHOD:REQUEST requires an attendee");
  }
  if (opts.method === "PUBLISH" && opts.attendee) {
    throw new Error("buildIcsCalendar: METHOD:PUBLISH must not have an attendee");
  }
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Chautauqua//Chautauqua//EN");
  lines.push(`METHOD:${opts.method}`);
  for (const e of events) {
    lines.push(...buildVevent(e, opts));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
