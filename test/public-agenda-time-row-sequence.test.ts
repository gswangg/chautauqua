// task-w64-a (DEC-584 wave-64 amendment): the public agenda desktop render
// is a time-row SEQUENCE, not a room-lane matrix -- one row per distinct
// start minute, room is an eyebrow LABEL on the block (never a column
// header), and TrackChips/FormatChip render as inline pills trailing the
// block instead of computing full-width strips.

import { describe, expect, it } from "vitest";
import { AgendaDayGrid } from "../src/routes/public/agenda";
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
    speakers: [{ contactId: "sp1", firstName: "Ada", lastName: "Lovelace", title: null, company: null, headshotUrl: null, bio: null }],
    format: "Talk",
    ...overrides,
  };
}

describe("DEC-584 (wave 64): AgendaDayGrid is a time-row sequence", () => {
  it("renders exactly one row per DISTINCT start minute, ascending, even when two sessions share a start time", () => {
    const items: PublicAgendaItem[] = [
      item({ submissionId: "s1", startMin: 600, endMin: 660, title: "Second Talk", roomId: "room-b", roomName: "Beta Hall", roomPosition: 1 }),
      item({ submissionId: "s2", startMin: 540, endMin: 600, title: "Opening A", roomId: "room-a", roomName: "Alpha Hall", roomPosition: 0 }),
      item({ submissionId: "s3", startMin: 540, endMin: 600, title: "Opening B", roomId: "room-b", roomName: "Beta Hall", roomPosition: 1 }),
    ];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));

    const rows = [...html.matchAll(/<div class="chq-pub-agenda-day-row">/g)];
    expect(rows).toHaveLength(2);

    const times = [...html.matchAll(/<div class="chq-pub-agenda-day-time">([^<]+)<\/div>/g)].map((m) => m[1]);
    expect(times).toEqual(["9:00 AM", "10:00 AM"]);

    // both same-start-time sessions render inside the first row's blocks
    // container, not a duplicated row.
    const firstBlocksMatch = html.match(/<div class="chq-pub-agenda-day-blocks">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="chq-pub-agenda-day-row">/);
    expect(firstBlocksMatch).toBeTruthy();
    expect(firstBlocksMatch![1]).toContain("Opening A");
    expect(firstBlocksMatch![1]).toContain("Opening B");
  });

  it("never renders room column headers or a grid-template-columns room matrix", () => {
    const items = [
      item({ submissionId: "s1", roomId: "room-a", roomName: "Alpha Hall", roomPosition: 0 }),
      item({ submissionId: "s2", roomId: "room-b", roomName: "Beta Hall", roomPosition: 1, startMin: 660, endMin: 720 }),
    ];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).not.toMatch(/grid-template-columns: 70px repeat/);
    expect(html).not.toContain("chq-pub-agenda-hour-label");
  });

  it("room renders as an eyebrow label on the block, never a column header, via publicRoomLabel", () => {
    const items = [item({ submissionId: "s1", roomId: "room-a", roomName: "Alpha Hall", roomPosition: 0 })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain('<span class="chq-pub-agenda-block-room">Alpha Hall</span>');
  });

  it("a TBD/null room renders 'To be announced' as the block's eyebrow label", () => {
    const items = [item({ submissionId: "s1", roomId: null, roomName: null, roomPosition: null })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain('<span class="chq-pub-agenda-block-room">To be announced</span>');
  });

  it("TrackChips and FormatChip render as inline pills inside one chq-pub-agenda-block-meta row, trailing the block", () => {
    const items = [item({ submissionId: "s1", tracks: [{ id: "t1", name: "Track One", color: "#123456" }], format: "Workshop" })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    const metaMatch = html.match(/<div class="chq-pub-agenda-block-meta">([\s\S]*?)<\/div>\s*<\/div>/);
    expect(metaMatch).toBeTruthy();
    expect(metaMatch![1]).toContain('class="chq-pub-track-chip"');
    expect(metaMatch![1]).toContain('class="chq-pub-format-chip"');
    // the meta row is the LAST thing in the block -- title/speakers appear
    // before it in document order.
    const blockOrder = html.indexOf("chq-pub-agenda-block-title") < html.indexOf("chq-pub-agenda-block-meta");
    expect(blockOrder).toBe(true);
  });

  it("the block carries the Save/Saved ItineraryToggle top-right in its head row, alongside the room eyebrow", () => {
    const items = [item({ submissionId: "s1" })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    const headMatch = html.match(/<div class="chq-pub-agenda-block-head">([\s\S]*?)<\/div>\s*<div class="chq-pub-agenda-block-title">/);
    expect(headMatch).toBeTruthy();
    expect(headMatch![1]).toContain("chq-pub-agenda-block-room");
    expect(headMatch![1]).toContain('class="chq-itinerary-toggle" value="s1"');
  });

  it("the block keeps the chq-pub-agenda-block class (public.css.ts's ACCENT_BOUND_CLASSES accent binding)", () => {
    const items = [item({ submissionId: "s1" })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain('<div class="chq-pub-agenda-block" id="chq-agenda-s1">');
  });
});
