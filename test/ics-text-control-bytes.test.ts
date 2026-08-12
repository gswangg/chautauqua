// DEC-540: sanitizeIcsText strips every C0 control byte (0x00-0x1f) and DEL
// (0x7f) — except LF, which is escaped to the literal "\n" — from SUMMARY,
// DESCRIPTION and LOCATION content lines. This is a property over every
// control byte value, not a handful of examples, because these TEXT values
// reach the serializer from unauthenticated public CFP text (title/
// description) and room names (location).

import { describe, expect, it } from "vitest";
import { buildIcsEvent, buildIcsCalendar, ICS_ORGANIZER_EMAIL } from "../src/mail/ics";
import type { IcsEventInput, IcsOptions } from "../src/mail/ics";

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

function assertWellFormed(ics: string): void {
  const rawLines = ics.split("\r\n");
  for (const line of rawLines) {
    if (line.length === 0) continue;
    const isKnownStart = KNOWN_LINE_STARTS.some((name) => line.startsWith(name));
    const isFoldContinuation = line.startsWith(" ");
    expect(isKnownStart || isFoldContinuation).toBe(true);
  }
  // After splitting on the CRLF terminator, no remaining line may contain
  // any control byte (< 0x20 or === 0x7f) — the only legal control bytes
  // (CR, LF) are consumed as the line terminator itself.
  for (const line of rawLines) {
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      expect(code < 0x20 || code === 0x7f).toBe(false);
    }
  }
}

function controlBytes(): number[] {
  const bytes: number[] = [];
  for (let b = 0x00; b <= 0x1f; b++) bytes.push(b);
  bytes.push(0x7f);
  return bytes;
}

function baseEvent(overrides: Partial<IcsEventInput> = {}): IcsEventInput {
  return {
    uidSubmissionId: "sub_ctrl",
    sequence: 0,
    title: "Title",
    description: "Description",
    startUtc: new Date("2026-09-01T10:00:00Z"),
    endUtc: new Date("2026-09-01T10:30:00Z"),
    location: "Location",
    dtstamp: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

describe("sanitizeIcsText control byte stripping (DEC-540)", () => {
  for (const byte of controlBytes()) {
    const hex = byte.toString(16).padStart(2, "0");
    const ch = String.fromCharCode(byte);

    it(`REQUEST event: strips 0x${hex} embedded in title/description/location`, () => {
      const opts: IcsOptions = {
        method: "REQUEST",
        organizer: { name: "Org", email: ICS_ORGANIZER_EMAIL },
        attendee: { name: "Attendee", email: "attendee@example.com" },
      };
      const ics = buildIcsEvent(
        baseEvent({
          title: `Title${ch}Evil`,
          description: `Desc${ch}Evil`,
          location: `Loc${ch}Evil`,
        }),
        opts,
      );
      assertWellFormed(ics);
    });

    it(`PUBLISH multi-event calendar: strips 0x${hex} embedded in title/description/location`, () => {
      const opts: IcsOptions = {
        method: "PUBLISH",
        organizer: { name: "Org", email: ICS_ORGANIZER_EMAIL },
      };
      const ics = buildIcsCalendar(
        [
          baseEvent({
            uidSubmissionId: "sub_ctrl_a",
            title: `Title${ch}Evil`,
            description: `Desc${ch}Evil`,
            location: `Loc${ch}Evil`,
          }),
          baseEvent({
            uidSubmissionId: "sub_ctrl_b",
            title: `Second${ch}Evil`,
            description: `SecondDesc${ch}Evil`,
            location: `SecondLoc${ch}Evil`,
          }),
        ],
        opts,
      );
      assertWellFormed(ics);
    });
  }

  it("strips control bytes but preserves the rest of the text verbatim", () => {
    const opts: IcsOptions = {
      method: "PUBLISH",
      organizer: { name: "Org", email: ICS_ORGANIZER_EMAIL },
    };
    const ics = buildIcsEvent(
      baseEvent({
        title: "A\x00B\x01C\x1fD\x7fE",
        description: "Plain description",
        location: "Plain location",
      }),
      opts,
    );
    expect(ics).toContain("SUMMARY:ABCDE");
  });

  it("still escapes LF (not stripped) as the literal \\n sequence", () => {
    const opts: IcsOptions = {
      method: "PUBLISH",
      organizer: { name: "Org", email: ICS_ORGANIZER_EMAIL },
    };
    const ics = buildIcsEvent(
      baseEvent({ title: "Line1\nLine2" }),
      opts,
    );
    expect(ics).toContain("SUMMARY:Line1\\nLine2");
    assertWellFormed(ics);
  });

  it("strips HTAB from title/description/location (matches sanitizeCn's rule)", () => {
    const opts: IcsOptions = {
      method: "PUBLISH",
      organizer: { name: "Org", email: ICS_ORGANIZER_EMAIL },
    };
    const ics = buildIcsEvent(
      baseEvent({ title: "Tab\tHere", description: "Also\tHere", location: "And\tHere" }),
      opts,
    );
    expect(ics).toContain("SUMMARY:TabHere");
    expect(ics).toContain("DESCRIPTION:AlsoHere");
    expect(ics).toContain("LOCATION:AndHere");
    assertWellFormed(ics);
  });
});
