import { describe, expect, it } from "vitest";
import { MergeFieldError, MERGE_FIELDS, renderTemplate, escapeHtml, textToHtml } from "../src/mail/render";
import { buildIcsCalendar, buildIcsEvent, ICS_ORGANIZER_EMAIL, type IcsEventInput, type IcsOptions } from "../src/mail/ics";
import { DevSinkMailer, InMemoryEmailLog } from "../src/mail/dev-sink";
import type { RenderedEmail } from "../src/mail/types";

describe("renderTemplate", () => {
  it("replaces single-brace placeholders present in vars", () => {
    const out = renderTemplate("Hi {speaker_name}, talk: {talk_title}", {
      speaker_name: "Ada Lovelace",
      talk_title: "On Engines",
    });
    expect(out).toBe("Hi Ada Lovelace, talk: On Engines");
  });

  it("throws MergeFieldError on a placeholder absent from vars", () => {
    expect(() => renderTemplate("Hi {speaker_name}", {})).toThrow(MergeFieldError);
  });

  it("throws for a placeholder that is not in the whitelist and not in vars", () => {
    expect(() => renderTemplate("{unknown_field}", { speaker_name: "x" })).toThrow(
      MergeFieldError,
    );
  });

  it("exports the DEC-006 merge field whitelist", () => {
    expect(MERGE_FIELDS).toEqual([
      "speaker_name",
      "talk_title",
      "event_name",
      "portal_link",
      "due_date",
      "task_list",
      "feedback",
    ]);
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >, \", and '", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("neutralizes an XSS payload disguised as a talk title", () => {
    const title = `<img src=x onerror=alert(1)>`;
    const out = escapeHtml(title);
    expect(out).not.toContain("<img");
    expect(out).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("textToHtml", () => {
  it("wraps single-line text in a <p> after escaping", () => {
    expect(textToHtml("hello world")).toBe("<p>hello world</p>");
  });

  it("converts a single newline within a paragraph to <br/>", () => {
    expect(textToHtml("line one\nline two")).toBe("<p>line one<br/>line two</p>");
  });

  it("splits blank-line-separated paragraphs into separate <p> blocks", () => {
    expect(textToHtml("para one\n\npara two")).toBe("<p>para one</p><p>para two</p>");
  });

  it("escapes a malicious talk title before wrapping in HTML", () => {
    const text = `Hi Ada,\n\nWe received your submission "<img src=x onerror=alert(1)>" for DevConf.`;
    const out = textToHtml(text);
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).toBe(
      '<p>Hi Ada,</p><p>We received your submission &quot;&lt;img src=x onerror=alert(1)&gt;&quot; for DevConf.</p>',
    );
  });
});

describe("ics builder", () => {
  const base: IcsEventInput = {
    uidSubmissionId: "abc123",
    sequence: 0,
    title: "On Engines",
    startUtc: new Date(Date.UTC(2026, 5, 1, 14, 0, 0)),
    endUtc: new Date(Date.UTC(2026, 5, 1, 15, 0, 0)),
    dtstamp: new Date(Date.UTC(2026, 5, 1, 12, 0, 0)),
  };

  const requestOpts: IcsOptions = {
    method: "REQUEST",
    organizer: { name: "DevConf", email: ICS_ORGANIZER_EMAIL },
    attendee: { name: "Ada Lovelace", email: "ada@example.com" },
  };

  const publishOpts: IcsOptions = {
    method: "PUBLISH",
    organizer: { name: "DevConf", email: ICS_ORGANIZER_EMAIL },
  };

  it("produces a stable UID derived from the submission id", () => {
    const a = buildIcsEvent(base, requestOpts);
    const b = buildIcsEvent({ ...base, sequence: 3 }, requestOpts);
    expect(a).toContain("UID:chq-abc123@chautauqua");
    expect(b).toContain("UID:chq-abc123@chautauqua");
  });

  it("serializes SEQUENCE", () => {
    const ics = buildIcsEvent({ ...base, sequence: 5 }, requestOpts);
    expect(ics).toContain("SEQUENCE:5");
  });

  it("omits LOCATION when no room is assigned", () => {
    const ics = buildIcsEvent(base, requestOpts);
    expect(ics).not.toContain("LOCATION");
  });

  it("includes LOCATION when provided", () => {
    const ics = buildIcsEvent({ ...base, location: "Room A" }, requestOpts);
    expect(ics).toContain("LOCATION:Room A");
  });

  it("uses CRLF line endings and METHOD:REQUEST with an ORGANIZER and ATTENDEE", () => {
    const ics = buildIcsEvent(base, requestOpts);
    expect(ics).toContain("\r\n");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain(`ORGANIZER;CN="DevConf":mailto:${ICS_ORGANIZER_EMAIL}`);
    // The ATTENDEE line is long enough to be 75-octet folded; assert on the
    // unfolded content rather than a single contiguous line.
    expect(ics.replace(/\r\n /g, "")).toContain(
      'ATTENDEE;CN="Ada Lovelace";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:ada@example.com',
    );
    expect(ics.split("\r\n").some((l) => l.startsWith("\n"))).toBe(false);
  });

  it("PUBLISH events carry an ORGANIZER but never an ATTENDEE", () => {
    const ics = buildIcsEvent(base, publishOpts);
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain(`ORGANIZER;CN="DevConf":mailto:${ICS_ORGANIZER_EMAIL}`);
    expect(ics).not.toContain("ATTENDEE");
  });

  it("throws when METHOD:REQUEST is built without an attendee", () => {
    expect(() =>
      buildIcsEvent(base, { method: "REQUEST", organizer: { name: "DevConf", email: ICS_ORGANIZER_EMAIL } }),
    ).toThrow();
  });

  it("throws when METHOD:PUBLISH is built with an attendee", () => {
    expect(() =>
      buildIcsEvent(base, {
        method: "PUBLISH",
        organizer: { name: "DevConf", email: ICS_ORGANIZER_EMAIL },
        attendee: { name: "Ada Lovelace", email: "ada@example.com" },
      }),
    ).toThrow();
  });

  it("strips embedded double quotes from CN values", () => {
    const ics = buildIcsEvent(base, {
      method: "REQUEST",
      organizer: { name: 'Dev"Conf', email: ICS_ORGANIZER_EMAIL },
      attendee: { name: 'Ada "Countess" Lovelace', email: "ada@example.com" },
    });
    expect(ics).toContain(`ORGANIZER;CN="DevConf":mailto:${ICS_ORGANIZER_EMAIL}`);
    expect(ics).toContain('ATTENDEE;CN="Ada Countess Lovelace";ROLE=REQ-PARTICIPANT');
  });

  it("golden string for a minimal event", () => {
    const ics = buildIcsEvent(base, requestOpts);
    expect(ics).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Chautauqua//Chautauqua//EN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:chq-abc123@chautauqua",
        "SEQUENCE:0",
        "DTSTAMP:20260601T120000Z",
        "DTSTART:20260601T140000Z",
        "DTEND:20260601T150000Z",
        "SUMMARY:On Engines",
        `ORGANIZER;CN="DevConf":mailto:${ICS_ORGANIZER_EMAIL}`,
        'ATTENDEE;CN="Ada Lovelace";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=',
        " TRUE:mailto:ada@example.com",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });

  it("folds long lines at 75 octets with a leading-space continuation", () => {
    const longTitle = "A".repeat(200);
    const ics = buildIcsEvent({ ...base, title: longTitle }, requestOpts);
    const lines = ics.split("\r\n");
    const encoder = new TextEncoder();
    for (const line of lines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // The folded SUMMARY continuation lines start with a single space.
    const summaryLineIdx = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(lines[summaryLineIdx + 1]?.startsWith(" ")).toBe(true);
    // Unfolding (strip CRLF + following space) reconstructs the original.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${longTitle}`);
  });

  it("folds a long ORGANIZER CN across continuation lines", () => {
    const longName = "Ada Lovelace ".repeat(20).trim();
    const ics = buildIcsEvent(base, {
      method: "REQUEST",
      organizer: { name: longName, email: ICS_ORGANIZER_EMAIL },
      attendee: { name: "Ada Lovelace", email: "ada@example.com" },
    });
    const lines = ics.split("\r\n");
    const encoder = new TextEncoder();
    for (const line of lines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const organizerLineIdx = lines.findIndex((l) => l.startsWith("ORGANIZER;CN="));
    expect(lines[organizerLineIdx + 1]?.startsWith(" ")).toBe(true);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`ORGANIZER;CN="${longName}":mailto:${ICS_ORGANIZER_EMAIL}`);
  });

  it("buildIcsCalendar emits one VCALENDAR with multiple VEVENTs sharing the schema", () => {
    const cal = buildIcsCalendar(
      [base, { ...base, uidSubmissionId: "def456", title: "Second Talk" }],
      requestOpts,
    );
    expect(cal.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(cal.match(/BEGIN:VCALENDAR/g)?.length).toBe(1);
    expect(cal).toContain("UID:chq-abc123@chautauqua");
    expect(cal).toContain("UID:chq-def456@chautauqua");
  });
});

describe("DevSinkMailer", () => {
  it("writes one email_log entry per send with full rendered content", async () => {
    const log = new InMemoryEmailLog();
    const clock = { now: () => new Date(Date.UTC(2026, 0, 1)) };
    const mailer = new DevSinkMailer(log, clock);

    const email: RenderedEmail = {
      to: { email: "ada@example.com", name: "Ada Lovelace" },
      subject: "You're accepted",
      text: "plain text body",
      html: "<p>html body</p>",
      ics: { filename: "invite.ics", content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n" },
      templateId: "acceptance",
      eventId: "evt_1",
      contactId: "ct_1",
    };

    await mailer.send(email);

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toEqual({
      eventId: "evt_1",
      contactId: "ct_1",
      templateId: "acceptance",
      batchId: null,
      toEmail: "ada@example.com",
      toName: "Ada Lovelace",
      subject: "You're accepted",
      bodyText: "plain text body",
      bodyHtml: "<p>html body</p>",
      icsText: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      icsFilename: "invite.ics",
      provider: "dev",
      status: "sent",
      sentAt: Date.UTC(2026, 0, 1),
    });
  });

  it("writes a second independent entry for a second send", async () => {
    const log = new InMemoryEmailLog();
    const mailer = new DevSinkMailer(log);
    const base: RenderedEmail = {
      to: { email: "a@example.com", name: "A" },
      subject: "s1",
      text: "t1",
      html: "<p>h1</p>",
      eventId: "evt_1",
      contactId: "ct_1",
    };
    await mailer.send(base);
    await mailer.send({ ...base, subject: "s2", contactId: "ct_2" });
    expect(log.rows).toHaveLength(2);
    expect(log.rows[1]?.subject).toBe("s2");
  });
});
