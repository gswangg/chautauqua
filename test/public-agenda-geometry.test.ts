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

// task-w1-d (DEC-555 amendment, wave 1): /schedule rebuilt to frame 10--12
// -- the saved-sessions list (Remove, never Save/Saved -- every row here IS
// a saved session once revealed) + rail, never the day-grid or the phone
// list AgendaItemList renders for /agenda.
describe("DEC-602/DEC-555 (task w1-d): /schedule renders its OWN saved-list markup, never the grid or the day-list", () => {
  it("ScheduleContent's HTML contains no .chq-pub-agenda-day grid markup", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).not.toContain('class="chq-pub-agenda-day"');
    expect(html).not.toContain("chq-pub-agenda-desktop");
    expect(html).toContain("chq-pub-schedule-row");
  });

  it("a schedule row carries title, full day, start-end time, room, and speaker name", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain("Opening Talk");
    // full day text (formatDay output, DEC-768 wave 7 amendment: formatDayLong)
    // is on the day-group heading.
    expect(html).toMatch(/Monday 10 August/);
    expect(html).toContain("8:00 AM");
    expect(html).toContain("9:30 AM");
    expect(html).toContain("Alpha Hall");
    expect(html).toContain("Ada");
  });

  it("a schedule row carries the itinerary checkbox, labelled Remove", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain('<label class="chq-pub-schedule-remove">');
    expect(html).toContain("Remove");
  });

  it("/embed carries the itinerary toggle and its script too (unlike /agenda)", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length, embed: true }));
    expect(html).toContain('class="chq-itinerary-toggle" value="s1"');
    expect(html).toContain("chq_itinerary_ev");
  });
});

describe("task-w1-d (DEC-555 amendment): the saved-only view + honest empty state", () => {
  it("renders every candidate row hidden by default, a subtitle placeholder, and an honest empty state (hidden by default)", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain('id="chq-schedule-subtitle"');
    expect(html).toContain("0 saved · 0 overlaps");
    expect(html).toMatch(/id="chq-schedule-empty"[^>]*hidden/);
    expect(html).toMatch(/class="chq-pub-schedule-row"[^>]*style="display:none"/);
  });

  it("does not render the dropped day-pill row, picks-only checkbox or highlight control on /schedule", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).not.toContain("chq-pub-day-switcher");
    expect(html).not.toContain('id="chq-picks-only"');
    expect(html).not.toContain('id="chq-pub-highlight-track"');
  });

  it("/agenda never renders any .chq-pub-schedule-row element (that markup is /schedule's alone)", () => {
    const html = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    // The shared ItineraryScript's inlined source mentions the selector as a
    // no-op query (getElementsByClassName returns empty here), so assert on
    // the ELEMENT markup, never a bare substring of the script.
    expect(html).not.toContain('class="chq-pub-schedule-row"');
    expect(html).not.toContain('id="chq-schedule-empty"');
  });
});
