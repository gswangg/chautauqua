// DEC-602 (EMB-06 w3 / EMB-09 w2 / EMB-10 w1): AgendaDayGrid's hour-label
// column, block sizing, /schedule's list-at-every-width rendering, and the
// 'Show only my picks' toggle.

import { describe, expect, it } from "vitest";
import { AgendaContent, AgendaDayGrid, ScheduleContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";
import { AGENDA_CSS } from "../src/routes/public/css/agenda.css";

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

  // w69-d (DEC-584 amendment): the toggle now requires itinerary=true --
  // "a save control renders only where its script does" -- AgendaDayGrid
  // no longer renders it unconditionally.
  it("a block now carries the Save/Saved itinerary toggle in its head row when itinerary=true (DEC-584 wave 64 supersedes the prior no-checkbox rule)", () => {
    const html = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda", itinerary: true }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain('class="chq-itinerary-toggle" value="s2"');
  });
});

// DEC-683 amendment (wave 1, task w1-a): PUBLIC PAIR = 820 + 60 + 300 =
// 1180 of content -- the day-block grid's own gap moves 8 -> 16 alongside
// that column widen, and three 228px+ tracks still fit across the 820px
// list column (no degenerate 0px track on a one-session day).
describe("DEC-683 amendment (wave 1, task w1-a): agenda day-block grid gap is 16px inside the 820px list column", () => {
  it(".chq-pub-agenda-day-blocks keeps a 228px auto-fit floor with a 16px gap", () => {
    const rule = /\.chq-pub-agenda-day-blocks\s*\{([^}]*)\}/.exec(AGENDA_CSS);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(228px,\s*1fr\)\);/);
    expect(rule![1]).toMatch(/gap:\s*16px;/);
  });

  it("three 228px tracks + 16px gaps fit inside the 820px list column with no degenerate 0px track", () => {
    const listWidth = 820;
    const trackFloor = 228;
    const gap = 16;
    // auto-fit's implied track count: as many trackFloor-wide tracks (plus
    // one gap each) as fit in listWidth.
    const trackCount = Math.floor((listWidth + gap) / (trackFloor + gap));
    expect(trackCount).toBe(3);
    const minimumRequired = trackCount * trackFloor + (trackCount - 1) * gap;
    expect(minimumRequired).toBeLessThanOrEqual(listWidth);
    // Every track therefore gets a positive share of the leftover space
    // (1fr), never a 0px collapse.
    expect(listWidth - minimumRequired).toBeGreaterThan(0);
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

  // w69-d (DEC-584 amendment): unlike AgendaContent, ScheduleContent's Save
  // toggle and ItineraryScript are NOT gated on !embed -- /schedule renders
  // its own inline count and .ics link rather than relying on the rail
  // (task note: "Do NOT change ScheduleContent"), so /embed/:slug/schedule
  // keeps both at every width.
  it("/embed carries the itinerary toggle and its script too (unlike /agenda)", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length, embed: true }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain("chq_itinerary_ev");
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

  it("does not render the picks-only filter control on /agenda (that toggle is /schedule's alone)", () => {
    const html = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    // DEC-683 amendment (wave 67-d): AgendaContent now DOES emit
    // ItineraryScript so its Save/Saved toggles actually persist, and that
    // one shared script body mentions the picks-only ids it drives on
    // /schedule (getElementById returns null here -- a no-op). So assert on
    // the CONTROL's own markup, never a bare substring of the script.
    // (Not the label's copy: ItineraryScript's inlined source carries that
    // phrase in a source comment, so only the markup is a sound signal.)
    expect(html).not.toContain('id="chq-picks-only"');
    expect(html).not.toContain('id="chq-picks-only-count"');
    expect(html).not.toContain("chq-pub-picks-toggle");
    expect(html).not.toContain('id="chq-picks-empty"');
  });
});
