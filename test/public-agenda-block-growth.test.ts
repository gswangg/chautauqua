// task-w1-e (DEC-768): public agenda blocks grow to fit their content
// instead of clipping a 15-minute session's title away, headings appear
// exactly once per day (never duplicated by AgendaDayGrid + AgendaItemList
// both owning one), day labels render via event-time.ts's formatCalendarDate
// (never a raw ISO 'YYYY-MM-DD' string, never toISOString), and the day
// switcher survives a `?day=` filtered view instead of dead-ending.

import { describe, expect, it } from "vitest";
import { AgendaContent, AgendaDayGrid, ScheduleContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "Event",
  slug: "ev",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function item(overrides: Partial<PublicAgendaItem>): PublicAgendaItem {
  return {
    submissionId: "sub",
    ref: "SES-1",
    title: "Talk",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 555,
    roomId: "room-a",
    roomName: "Alpha Hall",
    roomPosition: 0,
    icsSequence: 0,
    tracks: [{ id: "t1", name: "Track One", color: "#123456" }],
    speakers: [{ contactId: "sp1", firstName: "Ada", lastName: "Lovelace", title: "Engineer", company: "Acme", headshotUrl: null, bio: null }],
    format: null,
    ...overrides,
  };
}

describe("task-w1-e (DEC-768): agenda row template grows to fit content", () => {
  it("grid-template-rows uses minmax(22px, auto) for every 15-minute row", () => {
    const items = [item({ submissionId: "s1", title: "A Very Short Fifteen Minute Lightning Talk", startMin: 540, endMin: 555 })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain("minmax(22px, auto)");
  });

  it("a 15-minute session's title text is present in the rendered block", () => {
    const items = [item({ submissionId: "s1", title: "A Very Short Fifteen Minute Lightning Talk", startMin: 540, endMin: 555 })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain("A Very Short Fifteen Minute Lightning Talk");
  });
});

describe("task-w1-e (DEC-768): exactly one heading per day", () => {
  it("AgendaContent renders exactly one <h3> for a single day", () => {
    const items = [item({ submissionId: "s1" })];
    const html = String(AgendaContent({ event: EVENT, items, total: items.length }));
    const h3Count = (html.match(/<h3>/g) ?? []).length;
    expect(h3Count).toBe(1);
  });

  it("ScheduleContent renders exactly one <h3> for a single day", () => {
    const items = [item({ submissionId: "s1" })];
    const html = String(ScheduleContent({ event: EVENT, items, total: items.length }));
    const h3Count = (html.match(/<h3>/g) ?? []).length;
    expect(h3Count).toBe(1);
  });

  it("the day heading is a formatted, non-ISO label (never the raw 'YYYY-MM-DD' string)", () => {
    const items = [item({ submissionId: "s1", day: "2026-08-10" })];
    const html = String(AgendaContent({ event: EVENT, items, total: items.length }));
    const h3Match = html.match(/<h3>([^<]+)<\/h3>/);
    expect(h3Match).toBeTruthy();
    const label = h3Match![1];
    expect(label).not.toBe("2026-08-10");
    expect(label).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // formatCalendarDate (event-time.ts) output: "Mon, Aug 10, 2026".
    expect(label).toMatch(/Mon, Aug 10, 2026/);
  });
});

describe("task-w1-e (DEC-768): day switcher survives a ?day= filtered view", () => {
  it("AgendaContent still renders the switcher (with every day, current marked) when only one day's items are passed but allDays lists more", () => {
    const items = [item({ submissionId: "s1", day: "2026-08-10" })];
    const html = String(
      AgendaContent({
        event: EVENT,
        items,
        total: items.length,
        allDays: ["2026-08-10", "2026-08-11"],
        activeDay: "2026-08-10",
      }),
    );
    expect(html).toContain("chq-pub-day-switcher");
    // DEC-835: the active day's own section is on this page -> a real
    // ?day= navigation href (never a bare #chq-day-<day> anchor), with the
    // section id kept as a fragment for in-page anchoring.
    expect(html).toContain('href="/e/ev/agenda?day=2026-08-10#chq-day-2026-08-10"');
    // The other day is NOT rendered here -> a real navigation link, not a
    // dead in-page anchor to a section that doesn't exist.
    expect(html).toContain('href="/e/ev/agenda?day=2026-08-11"');
    expect(html).toContain('aria-current="page"');
  });

  it("ScheduleContent also keeps the switcher on a filtered view", () => {
    const items = [item({ submissionId: "s1", day: "2026-08-10" })];
    const html = String(
      ScheduleContent({
        event: EVENT,
        items,
        total: items.length,
        allDays: ["2026-08-10", "2026-08-11"],
        activeDay: "2026-08-10",
      }),
    );
    expect(html).toContain("chq-pub-day-switcher");
    expect(html).toContain('href="/e/ev/schedule?day=2026-08-11"');
  });
});
