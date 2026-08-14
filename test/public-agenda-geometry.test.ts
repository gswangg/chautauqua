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

describe("DEC-584 (wave 64 amendment): AgendaDayGrid time-row sequence replaces the hour-label grid column", () => {
  it("renders exactly one time-row per distinct start minute, ascending", () => {
    const html = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda" }));
    const times = [...html.matchAll(/<div class="chq-pub-agenda-day-time">([^<]+)<\/div>/g)].map((m) => m[1]);
    expect(times).toEqual(["8:00 AM", "10:00 AM"]);
  });

  it("a block now carries the Save/Saved itinerary toggle in its head row (DEC-584 wave 64 supersedes the prior no-checkbox rule)", () => {
    const html = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda" }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain('class="chq-itinerary-toggle" value="s2"');
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

  it("a schedule card still carries the itinerary checkbox, now naming its Save/Saved state", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain('class="chq-pub-save-off"');
    expect(html).toContain('class="chq-pub-save-on"');
    expect(html).toContain("Saved");
    expect(html).not.toContain("Add to itinerary");
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
