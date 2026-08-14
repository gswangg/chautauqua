// DEC-851 amendment (wave 5): closes the frame 10--01/10--02 public agenda
// residue -- the 3px olive edge was pre-spent at rest (always-on), the rail
// never swapped to the highlight's own section, break rows carried their
// time inside the band instead of the time gutter, and the day heading's
// room count disagreed with the rail's own room list because the two read
// different groupings. Render-only unit-test style (no db), matching
// test/public-agenda-block-anatomy.test.ts / test/public-agenda-rail.test.ts.

import { describe, expect, it } from "vitest";
import { AgendaContent } from "../src/routes/public/agenda";
import { AgendaDayGrid } from "../src/routes/public/agenda-grid";
import { AgendaRail, roomsInUse } from "../src/routes/public/agenda-rail";
import type { PublicAgendaItem, PublicEvent, PublicTrack } from "../src/server/repo/public";
import type { ScheduleBreak } from "../src/server/repo/breaks";

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

const TRACK_A: PublicTrack = { id: "trk-a", name: "Track A", color: null };
const TRACK_B: PublicTrack = { id: "trk-b", name: "Track B", color: null };

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
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

function brk(overrides: Partial<ScheduleBreak>): ScheduleBreak {
  return {
    id: "brk-1",
    eventId: "e1",
    day: "2026-08-10",
    label: "Coffee",
    location: "Foyer",
    startMin: 615,
    durationMin: 15,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("DEC-851 amendment (wave 5): the block edge is one of the highlight's consequences, never pre-spent at rest", () => {
  it("at rest (no highlight) every block carries a plain hairline edge, not the 3px olive", () => {
    const items = [item({ submissionId: "s1", tracks: [TRACK_A] })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain('class="chq-pub-agenda-block"');
    expect(html).not.toContain("chq-pub-agenda-block-highlight");
    expect(html).not.toContain("chq-pub-agenda-block-muted");
  });

  it("with a highlight set, a matching block gets chq-pub-agenda-block-highlight and a non-matching block gets chq-pub-agenda-block-muted", () => {
    const items = [
      item({ submissionId: "s1", tracks: [TRACK_A] }),
      item({ submissionId: "s2", startMin: 600, endMin: 615, tracks: [TRACK_B] }),
    ];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda", highlightTrackId: "trk-a" }));
    expect(html).toContain('id="chq-agenda-s1"');
    const s1 = html.slice(html.indexOf('id="chq-agenda-s1"') - 200, html.indexOf('id="chq-agenda-s1"'));
    expect(s1).toContain("chq-pub-agenda-block chq-pub-agenda-block-highlight");
    const s2 = html.slice(html.indexOf('id="chq-agenda-s2"') - 200, html.indexOf('id="chq-agenda-s2"'));
    expect(s2).toContain("chq-pub-agenda-block chq-pub-agenda-block-muted");
  });
});

describe("DEC-851 amendment (wave 5): the rail's first block swaps to the highlight, and the print block gets its own eyebrow", () => {
  it("with no highlight, the rail shows Rooms in use today with a caption naming what the row jumps to", () => {
    const items = [item({ submissionId: "s1", roomId: "room-a", roomName: "Alpha Hall" })];
    const html = String(AgendaRail({ event: EVENT, items, activeDay: "2026-08-10" }));
    expect(html).toContain("Rooms in use today");
    expect(html).toContain("Jumps to that room&#39;s first session");
    expect(html).not.toContain(" in Track");
  });

  it("with a highlight set, the rail's first block becomes 'N in <track>', listing room + time per match with its own caption", () => {
    const items = [
      item({ submissionId: "s1", startMin: 540, endMin: 555, roomId: "room-a", roomName: "Alpha Hall", tracks: [TRACK_A] }),
      item({ submissionId: "s2", startMin: 600, endMin: 615, roomId: "room-b", roomName: "Beta Room", tracks: [TRACK_B] }),
    ];
    const html = String(
      AgendaRail({ event: EVENT, items, activeDay: "2026-08-10", highlightTrackId: "trk-a", tracks: [TRACK_A, TRACK_B] }),
    );
    expect(html).toContain("1 in Track A");
    expect(html).toContain("Jumps to that session");
    expect(html).not.toContain("Rooms in use today");
    expect(html).toContain('href="#chq-agenda-s1"');
    expect(html).toContain("Alpha Hall");
    expect(html).not.toContain("Beta Room");
  });

  it("the print block carries a PRINT eyebrow and its own caption", () => {
    const html = String(AgendaRail({ event: EVENT, items: [], activeDay: "2026-08-10" }));
    expect(html).toContain(">Print<");
    expect(html).toContain("A one-page version of all three days.");
    expect(html).toContain('href="/e/ev/programme"');
  });
});

describe("DEC-851 amendment (wave 5): break row anatomy -- time in the gutter, band a quiet left-aligned rule, room kept", () => {
  it("the break's time renders in the shared time-gutter cell, not inside the band text", () => {
    const items = [item({ submissionId: "s1", startMin: 540, endMin: 600 })];
    const breaksByDay = new Map([["2026-08-10", [brk({ startMin: 615, label: "Coffee", location: "Foyer", durationMin: 15 })]]]);
    const html = String(AgendaContent({ event: EVENT, items, total: 1, breaksByDay }));
    // The gutter cell carries the break's own start time...
    expect(html).toContain('<div class="chq-pub-agenda-day-time">10:15 AM</div><div class="chq-pub-agenda-break">');
    // ...and the band text itself no longer repeats the time inline.
    const bandMatch = html.match(/<div class="chq-pub-agenda-break">([^<]*)<\/div>/);
    expect(bandMatch).toBeTruthy();
    expect(bandMatch![1]).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("a short break (Coffee) keeps its room in the band, same as a long break (Lunch)", () => {
    const items = [item({ submissionId: "s1", startMin: 540, endMin: 600 })];
    const breaksByDay = new Map([
      [
        "2026-08-10",
        [
          brk({ id: "b1", label: "Coffee", location: "Foyer", startMin: 615, durationMin: 15 }),
          brk({ id: "b2", label: "Lunch", location: "Foyer", startMin: 720, durationMin: 60 }),
        ],
      ],
    ]);
    const html = String(AgendaContent({ event: EVENT, items, total: 1, breaksByDay }));
    expect(html).toContain("Coffee · Foyer · 15 min");
    expect(html).toContain("Lunch · Foyer · 60 min");
  });

  it("the break row is a .chq-pub-agenda-day-row so the grid CSS aligns its time gutter with session rows", () => {
    const items = [item({ submissionId: "s1", startMin: 540, endMin: 600 })];
    const breaksByDay = new Map([["2026-08-10", [brk({})]]]);
    const html = String(AgendaContent({ event: EVENT, items, total: 1, breaksByDay }));
    expect(html).toContain('class="chq-pub-agenda-day-row chq-pub-agenda-break-row"');
  });
});

describe("DEC-851 amendment (wave 5): ONE READER for the day heading's room count and the rail's room list", () => {
  it("a day where every item carries a roomId but a null roomName still counts as 1 room on the h1 (not 0)", () => {
    const items = [item({ submissionId: "s1", roomId: "room-a", roomName: null })];
    const html = String(AgendaContent({ event: EVENT, items, total: 1, activeDay: "2026-08-10" }));
    expect(html).toContain("1 session · 1 room");
  });

  it("the h1 room count equals roomsInUse()'s own real-room count for the same day's items", () => {
    const items = [
      item({ submissionId: "s1", roomId: "room-a", roomName: "Alpha Hall" }),
      item({ submissionId: "s2", startMin: 600, endMin: 630, roomId: "room-b", roomName: "Beta Room" }),
      item({ submissionId: "s3", startMin: 660, endMin: 690, roomId: null, roomName: null }),
    ];
    const html = String(AgendaContent({ event: EVENT, items, total: 3, activeDay: "2026-08-10" }));
    const expectedRoomCount = roomsInUse(items).filter((r) => r.roomKey !== "tbd").length;
    expect(expectedRoomCount).toBe(2);
    expect(html).toContain(`3 sessions · ${expectedRoomCount} rooms`);
  });
});
