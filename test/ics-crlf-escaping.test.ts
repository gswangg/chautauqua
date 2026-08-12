// DEC-131: escapeText normalizes CR (both lone CR and CRLF) to \n before
// escaping, so no raw content line ever carries a bare CR that isn't part
// of the RFC 5545 CRLF line terminator.

import { describe, expect, it } from "vitest";
import { buildIcsEvent, buildIcsCalendar, ICS_ORGANIZER_EMAIL } from "../src/mail/ics";
import type { IcsEventInput, IcsOptions } from "../src/mail/ics";

const requestOpts: IcsOptions = {
  method: "REQUEST",
  organizer: { name: "DevConf", email: ICS_ORGANIZER_EMAIL },
  attendee: { name: "Ada Lovelace", email: "ada@example.com" },
};

function baseEvent(overrides: Partial<IcsEventInput> = {}): IcsEventInput {
  return {
    uidSubmissionId: "sub_crlf",
    sequence: 0,
    title: "Line1\r\nLine2",
    description: "Desc CRLF\r\nhere, and a lone CR\rthere too.",
    startUtc: new Date("2026-09-01T10:00:00Z"),
    endUtc: new Date("2026-09-01T10:30:00Z"),
    location: "Room A\r\nBuilding B",
    dtstamp: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

/** Unfold RFC 5545 folded lines: split on CRLF, then rejoin any line that
 * starts with a single leading space (continuation) onto the previous line. */
function unfold(ics: string): string[] {
  const rawLines = ics.split("\r\n");
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      unfolded.push(line);
    }
  }
  return unfolded;
}

describe("ics escapeText CR normalization (DEC-131)", () => {
  it("escapes CRLF and lone CR in the title as literal \\n, not raw CR", () => {
    const ics = buildIcsEvent(baseEvent(), requestOpts);
    const unfolded = unfold(ics);
    const summary = unfolded.find((l) => l.startsWith("SUMMARY:"));
    expect(summary).toBe("SUMMARY:Line1\\nLine2");
  });

  it("has no bare CR anywhere in the output (every CR is part of CRLF)", () => {
    const ics = buildIcsCalendar([baseEvent(), baseEvent({ uidSubmissionId: "sub_crlf_2" })], requestOpts);
    expect(/\r(?!\n)/.test(ics)).toBe(false);
  });

  it("produces no raw \\r or \\n in any content line after unfolding", () => {
    const ics = buildIcsEvent(baseEvent(), requestOpts);
    const unfolded = unfold(ics);
    for (const line of unfolded) {
      expect(line.includes("\r")).toBe(false);
      expect(line.includes("\n")).toBe(false);
    }
    // Sanity: the escaped literal "\n" sequences are still present (as two
    // chars, backslash + n), proving the escaping did happen.
    const description = unfolded.find((l) => l.startsWith("DESCRIPTION:"));
    expect(description).toContain("\\n");
    const location = unfolded.find((l) => l.startsWith("LOCATION:"));
    expect(location).toBe("LOCATION:Room A\\nBuilding B");
  });
});

// DEC-499: sanitizeCn strips DQUOTE + every CTL char from CN parameter
// values, so an embedded CRLF (or other control char) in an organizer/
// attendee name can never inject a new content line into the .ics output.
describe("ics CN injection hardening (DEC-499)", () => {
  const KNOWN_LINE_STARTS = [
    "BEGIN",
    "END",
    "VERSION",
    "PRODID",
    "METHOD",
    "UID",
    "SEQUENCE",
    "DTSTAMP",
    "DTSTART",
    "DTEND",
    "SUMMARY",
    "DESCRIPTION",
    "LOCATION",
    "ORGANIZER",
    "ATTENDEE",
  ];

  function assertNoInjectedLines(ics: string): void {
    const rawLines = ics.split("\r\n").filter((l) => l.length > 0);
    for (const line of rawLines) {
      const isKnownStart = KNOWN_LINE_STARTS.some((name) => line.startsWith(name));
      const isFoldContinuation = line.startsWith(" ");
      expect(isKnownStart || isFoldContinuation).toBe(true);
    }
    expect(rawLines.some((l) => /^X-EVIL/.test(l))).toBe(false);
    expect(rawLines.some((l) => /^BEGIN:VALARM/.test(l))).toBe(false);
  }

  it("REQUEST calendar: strips CRLF/control chars injected via organizer and attendee CN", () => {
    const opts: IcsOptions = {
      method: "REQUEST",
      organizer: { name: "Ada\r\nX-EVIL:1", email: ICS_ORGANIZER_EMAIL },
      attendee: { name: "Bob\nBEGIN:VALARM", email: "bob@example.com" },
    };
    const ics = buildIcsEvent(baseEvent(), opts);
    assertNoInjectedLines(ics);

    const unfolded = unfold(ics);
    const organizer = unfolded.find((l) => l.startsWith("ORGANIZER;"));
    const attendee = unfolded.find((l) => l.startsWith("ATTENDEE;"));
    expect(organizer).toBe(`ORGANIZER;CN="AdaX-EVIL:1":mailto:${ICS_ORGANIZER_EMAIL}`);
    expect(attendee).toContain('CN="BobBEGIN:VALARM"');
  });

  it("strips tab and form-feed control chars from a CN", () => {
    const opts: IcsOptions = {
      method: "REQUEST",
      organizer: { name: "Org", email: ICS_ORGANIZER_EMAIL },
      attendee: { name: "Bob\tSmith\fJones", email: "bob@example.com" },
    };
    const ics = buildIcsEvent(baseEvent(), opts);
    const unfolded = unfold(ics);
    const attendee = unfolded.find((l) => l.startsWith("ATTENDEE;"));
    expect(attendee).toContain('CN="BobSmithJones"');
  });

  it("keeps legal characters ; and : intact inside a CN", () => {
    const opts: IcsOptions = {
      method: "PUBLISH",
      organizer: { name: "Smith; Jones: Ltd", email: ICS_ORGANIZER_EMAIL },
    };
    const ics = buildIcsEvent(baseEvent(), opts);
    const unfolded = unfold(ics);
    const organizer = unfolded.find((l) => l.startsWith("ORGANIZER;"));
    expect(organizer).toBe(`ORGANIZER;CN="Smith; Jones: Ltd":mailto:${ICS_ORGANIZER_EMAIL}`);
    assertNoInjectedLines(ics);
  });

  it("PUBLISH calendar (organizer only): strips CRLF injection from CN", () => {
    const opts: IcsOptions = {
      method: "PUBLISH",
      organizer: { name: "Evil\r\nX-EVIL:1", email: ICS_ORGANIZER_EMAIL },
    };
    const ics = buildIcsEvent(baseEvent(), opts);
    assertNoInjectedLines(ics);
    const unfolded = unfold(ics);
    const organizer = unfolded.find((l) => l.startsWith("ORGANIZER;"));
    expect(organizer).toBe(`ORGANIZER;CN="EvilX-EVIL:1":mailto:${ICS_ORGANIZER_EMAIL}`);
  });
});
