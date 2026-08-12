// DEC-602 (EMB-06 w3 / EMB-09 w2 / EMB-10 w1): AgendaDayGrid's hour-label
// column, block sizing, /schedule's list-at-every-width rendering, and the
// 'Show only my picks' toggle.

import { describe, expect, it } from "vitest";
import { AgendaContent, AgendaDayGrid, ScheduleContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "Event",
  slug: "ev",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
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
    endMin: 600,
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

const ITEMS: PublicAgendaItem[] = [
  item({ submissionId: "s1", startMin: 480, endMin: 570, title: "Opening Talk", description: "A long-form description of the opening talk." }),
  item({
    submissionId: "s2",
    startMin: 600,
    endMin: 660,
    title: "Second Talk",
    roomId: "room-b",
    roomName: "Beta Hall",
    roomPosition: 1,
    speakers: [{ contactId: "sp2", firstName: "Grace", lastName: "Hopper", title: null, company: "Navy", headshotUrl: null, bio: null }],
  }),
];

describe("DEC-602 (EMB-06 w3): AgendaDayGrid hour-label column", () => {
  it("emits an hour label into grid-column 1 for each whole hour spanned by the day", () => {
    const html = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda" }));
    const labelMatches = [...html.matchAll(/<div class="chq-pub-agenda-hour-label" style="grid-column:1;grid-row:(\d+)">([^<]+)<\/div>/g)];
    expect(labelMatches.length).toBeGreaterThan(0);
    // dayStart=480 (8:00 AM), one of the marks must be exactly 8 AM.
    expect(labelMatches.some((m) => m[2] === "8 AM")).toBe(true);
    // 11 AM is within [480, 660] too.
    expect(labelMatches.some((m) => m[2] === "11 AM")).toBe(true);
  });

  it("an hour label's grid-row matches the same rowForMinute math a block at that same minute would get", () => {
    // Item s1 starts exactly at dayStart (480 = 8 AM), so its block's
    // rowStart and the 8 AM label's grid-row must be identical (row 2).
    const html = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda" }));
    const label8am = html.match(/<div class="chq-pub-agenda-hour-label" style="grid-column:1;grid-row:(\d+)">8 AM<\/div>/);
    expect(label8am).toBeTruthy();
    const blockRow = html.match(/id="chq-agenda-s1"[^>]*style="grid-column:\d+;grid-row:(\d+)/);
    // block markup is `style=...; id=...` in that attribute order, so check both.
    const blockRowAlt = html.match(/style="grid-column:\d+;grid-row:(\d+)[^"]*"\s+id="chq-agenda-s1"/);
    const rowNum = (blockRow ?? blockRowAlt)?.[1];
    expect(rowNum).toBe(label8am![1]);
  });

  it("a grid block never contains an interactive control (no checkbox inside AgendaDayGrid)", () => {
    const html = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda" }));
    expect(html).not.toContain("chq-itinerary-toggle");
    expect(html).not.toContain("<input");
  });
});

describe("DEC-602 (EMB-09 w2): /schedule renders the list at every width, never the grid", () => {
  it("ScheduleContent's HTML contains no .chq-pub-agenda-day grid markup", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).not.toContain('class="chq-pub-agenda-day"');
    expect(html).not.toContain("chq-pub-agenda-desktop");
    expect(html).toContain("chq-pub-schedule-list");
  });

  it("a schedule card carries TrackChips, title, description, full day + start-end time, room, and speaker company", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain("Track One");
    expect(html).toContain("Opening Talk");
    expect(html).toContain("A long-form description of the opening talk.");
    // full day text (formatDay output) alongside the start-end time
    expect(html).toMatch(/Mon, Aug 10/);
    expect(html).toContain("8:00 AM");
    expect(html).toContain("9:30 AM");
    expect(html).toContain("Alpha Hall");
    expect(html).toContain("Ada");
    expect(html).toContain("Engineer, Acme");
  });

  it("a schedule card still carries the 'Add to itinerary' checkbox", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain("Add to itinerary");
  });
});

describe("DEC-602 (EMB-10 w1): 'Show only my picks' toggle scaffolding", () => {
  it("renders the toggle, a live count span, and an honest empty state (hidden by default)", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain('id="chq-picks-only"');
    expect(html).toContain("Show only my picks");
    expect(html).toContain('id="chq-picks-only-count"');
    expect(html).toMatch(/id="chq-picks-empty"[^>]*hidden/);
  });

  it("does not render the picks toggle on /agenda (AgendaContent has no itinerary flow)", () => {
    const html = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).not.toContain("chq-picks-only");
  });
});
