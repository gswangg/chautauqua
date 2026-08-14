// DEC-996 / DEC-499 wave-23 amendments: header/address escaping in the mail
// serializers. addressHeader's quoted display name must not let an embedded
// DQUOTE close the quoted-string and splice a second address into
// From:/To:; the address half must not let EMAIL_PATTERN-legal `,`/`;`
// characters turn one stored address into an address-list; and a long
// non-ASCII subject must fold into <=75-char RFC 2047 encoded-words with
// every physical header line <=998 octets and exactly one logical
// `Subject:`. The ICS serializer's mailto: addresses share the same
// sanitizer.

import { describe, expect, it } from "vitest";
import { EmailBindingMailer } from "../src/mail/email-binding";
import { InMemoryEmailLog } from "../src/mail/dev-sink";
import { buildIcsEvent } from "../src/mail/ics";
import type { RenderedEmail } from "../src/mail/types";

function baseMsg(overrides: Partial<RenderedEmail> = {}): RenderedEmail {
  return {
    to: { email: "speaker@example.com", name: "Speaker Name" },
    subject: "Hello",
    text: "hello text",
    html: "<p>hello</p>",
    eventId: "evt_1",
    contactId: "contact_1",
    ...overrides,
  };
}

const identityFactory = (from: string, to: string, raw: string) => ({ from, to, raw });

function makeMailer() {
  const calls: Array<{ raw: string }> = [];
  const binding = { send: async (message: unknown) => { calls.push(message as { raw: string }); } };
  const log = new InMemoryEmailLog();
  const mailer = new EmailBindingMailer(
    binding,
    log,
    { email: "hello@chautauqua.cc", name: "Chautauqua" },
    identityFactory,
  );
  return { mailer, calls };
}

describe("mail header injection: display-name quote escaping", () => {
  it("a display name containing a double quote never splices a second address into To:", async () => {
    const { mailer, calls } = makeMailer();
    await mailer.send(
      baseMsg({ to: { email: "speaker@example.com", name: 'Bob" <attacker@evil.example>, "' } }),
    );
    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    const toLine = lines.find((l) => l.startsWith("To:"))!;
    // Angle brackets are legal QSAFE-CHARs *inside* a quoted-string display
    // name, so strip the quoted-string (delimited by the first and last
    // DQUOTE — safe because DQUOTE was stripped from the name itself)
    // before scanning for real `<addr>` address-list members.
    const firstQuote = toLine.indexOf('"');
    const lastQuote = toLine.lastIndexOf('"');
    const outsideQuotes = toLine.slice(0, firstQuote) + toLine.slice(lastQuote + 1);
    const addresses = [...outsideQuotes.matchAll(/<[^>]*>/g)];
    expect(addresses).toHaveLength(1);
    expect(addresses[0]![0]).toBe("<speaker@example.com>");
  });

  it("a lone backslash in a display name does not leave an unterminated quoted-string", async () => {
    const { mailer, calls } = makeMailer();
    await mailer.send(baseMsg({ to: { email: "speaker@example.com", name: 'Bob \\ Smith' } }));
    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    const toLine = lines.find((l) => l.startsWith("To:"))!;
    // Balanced quoted-string: exactly two DQUOTE characters on the line.
    expect((toLine.match(/"/g) ?? []).length).toBe(2);
    expect(toLine).not.toContain("\\");
    const addresses = [...toLine.matchAll(/<[^>]*>/g)];
    expect(addresses).toHaveLength(1);
    expect(addresses[0]![0]).toBe("<speaker@example.com>");
  });
});

describe("mail header injection: address sanitizing", () => {
  it("a stored-valid address containing a comma never yields two comma-separated To addresses", async () => {
    const { mailer, calls } = makeMailer();
    await mailer.send(baseMsg({ to: { email: "a,b@c.com", name: "Someone" } }));
    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    const toLine = lines.find((l) => l.startsWith("To:"))!;
    const addresses = [...toLine.matchAll(/<[^>]*>/g)];
    expect(addresses).toHaveLength(1);
    expect(addresses[0]![0]).toBe("<ab@c.com>");
  });

  it("strips angle brackets / semicolons from an address so the raw <...> boundary is never split", async () => {
    const { mailer, calls } = makeMailer();
    await mailer.send(baseMsg({ to: { email: "x;y@c.com", name: "Someone" } }));
    const raw = calls[0]!.raw;
    const lines = raw.split("\r\n");
    const toLine = lines.find((l) => l.startsWith("To:"))!;
    const addresses = [...toLine.matchAll(/<[^>]*>/g)];
    expect(addresses).toHaveLength(1);
    expect(addresses[0]![0]).toBe("<xy@c.com>");
  });
});

describe("mail header injection: RFC 2047 encoded-word folding", () => {
  it("a 300-char non-ASCII subject folds into <=75-char encoded-words, every header line <=998 octets, exactly one Subject: line", async () => {
    const { mailer, calls } = makeMailer();
    const longSubject = "café ".repeat(60); // 300 chars, non-ASCII, well over one encoded-word
    await mailer.send(baseMsg({ subject: longSubject }));
    const raw = calls[0]!.raw;
    const headerBlockEnd = raw.indexOf("\r\n\r\n");
    const headerBlock = raw.slice(0, headerBlockEnd);
    const physicalLines = headerBlock.split("\r\n");

    for (const line of physicalLines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(998);
    }

    const subjectLines = physicalLines.filter((l) => l.startsWith("Subject:"));
    expect(subjectLines).toHaveLength(1);

    // Locate the folded Subject block: the Subject: line plus any following
    // continuation lines (start with a single space).
    const subjectStart = physicalLines.indexOf(subjectLines[0]!);
    const block: string[] = [physicalLines[subjectStart]!];
    let i = subjectStart + 1;
    while (i < physicalLines.length && physicalLines[i]!.startsWith(" ")) {
      block.push(physicalLines[i]!);
      i += 1;
    }
    expect(block.length).toBeGreaterThan(1); // must have folded into multiple words

    const encodedWordPattern = /=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g;
    let matchCount = 0;
    let decoded = "";
    for (const line of block) {
      const text = line.startsWith("Subject:") ? line.slice("Subject:".length).trim() : line.trim();
      const words = [...text.matchAll(encodedWordPattern)];
      for (const w of words) {
        matchCount += 1;
        expect(w[0]!.length).toBeLessThanOrEqual(75);
        decoded += atob(w[1]!);
      }
    }
    expect(matchCount).toBeGreaterThan(1);
    // Round-trips (bytes, decoded via Latin1-per-char atob then re-encoded).
    const bytes = new Uint8Array(decoded.length);
    for (let j = 0; j < decoded.length; j++) bytes[j] = decoded.charCodeAt(j);
    expect(new TextDecoder().decode(bytes)).toBe(longSubject);
  });
});

describe("ics mailto: address sanitizing (DEC-499 wave-23 amendment)", () => {
  it("an organizer address containing a comma or quote adds no second content line", () => {
    const ics = buildIcsEvent(
      {
        uidSubmissionId: "sub_1",
        sequence: 0,
        title: "Talk",
        startUtc: new Date("2026-09-01T10:00:00Z"),
        endUtc: new Date("2026-09-01T11:00:00Z"),
        dtstamp: new Date("2026-09-01T00:00:00Z"),
      },
      {
        method: "REQUEST",
        organizer: { name: "Org", email: 'a,"b@c.com' },
        attendee: { name: "Attendee", email: "attendee@example.com" },
      },
    );
    const lines = ics.replace(/\r\n /g, "").split("\r\n");
    const organizerLines = lines.filter((l) => l.startsWith("ORGANIZER"));
    expect(organizerLines).toHaveLength(1);
    expect(organizerLines[0]).toBe('ORGANIZER;CN="Org":mailto:ab@c.com');
    expect(lines.some((l) => l.includes('"b@c.com'))).toBe(false);
  });

  it("an attendee address containing a comma or quote adds no second parameter or content line", () => {
    const ics = buildIcsEvent(
      {
        uidSubmissionId: "sub_1",
        sequence: 0,
        title: "Talk",
        startUtc: new Date("2026-09-01T10:00:00Z"),
        endUtc: new Date("2026-09-01T11:00:00Z"),
        dtstamp: new Date("2026-09-01T00:00:00Z"),
      },
      {
        method: "REQUEST",
        organizer: { name: "Org", email: "org@example.com" },
        attendee: { name: "Attendee", email: 'x,y"@c.com' },
      },
    );
    // Unfold RFC 5545 line-folding (CRLF + single space) before scanning for
    // content-line prefixes, since a long ATTENDEE line legitimately wraps.
    const unfolded = ics.replace(/\r\n /g, "");
    const lines = unfolded.split("\r\n");
    const attendeeLines = lines.filter((l) => l.startsWith("ATTENDEE"));
    expect(attendeeLines).toHaveLength(1);
    expect(attendeeLines[0]).toContain("mailto:xy@c.com");
    expect(attendeeLines[0]).not.toContain(",y");
  });
});
