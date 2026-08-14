// DEC-022 amendment (wave 63): a break renders as ONE full-width spanning
// row in AgendaDayGrid (desktop) and one row in AgendaItemList (phone/
// schedule) -- on the day it belongs to, and on no other. Mirrors the
// render-only unit-test style of test/public-agenda-geometry.test.ts (no
// db, plain function calls returning JSX-as-string).

import { describe, expect, it } from "vitest";
import { AgendaContent, ScheduleContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";
import type { ScheduleBreak } from "../src/server/repo/breaks";

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
    endMin: 600,
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
    label: "Lunch",
    location: "Foyer",
    startMin: 720,
    durationMin: 60,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const ITEMS: PublicAgendaItem[] = [
  item({ submissionId: "s1", day: "2026-08-10", startMin: 540, endMin: 600, title: "Day 1 talk" }),
  item({ submissionId: "s2", day: "2026-08-11", startMin: 540, endMin: 600, title: "Day 2 talk" }),
];

describe("DEC-022 amendment: AgendaContent (desktop grid) break rendering", () => {
  it("renders the break as a full-width spanning row on the day it belongs to", () => {
    const breaksByDay = new Map([["2026-08-10", [brk({})]]]);
    const html = String(
      AgendaContent({ event: EVENT, items: ITEMS, total: 2, breaksByDay }),
    );
    expect(html).toContain('class="chq-pub-agenda-break"');
    expect(html).toContain("Lunch");
    expect(html).toContain("Foyer");
    expect(html).toContain("60 min");
    // DEC-584 (wave 64 amendment) replaced the room-lane grid with a time-row
    // sequence, so "spans the full width" is no longer an inline
    // grid-column:1/-1 -- it is the break being a DIRECT child of the day's
    // column flexbox (.chq-pub-agenda-day) rather than sitting inside a
    // .chq-pub-agenda-day-row's blocks container next to session cards.
    const day = html.slice(html.indexOf('class="chq-pub-agenda-day"'));
    expect(day).toContain('</div><div class="chq-pub-agenda-break">');
    expect(html).not.toContain('chq-pub-agenda-day-blocks"><div class="chq-pub-agenda-break"');
    // ...and it carries no inline geometry at all anymore.
    expect(html).not.toContain("grid-column:1 / -1");
  });

  it("sequences the break by start time, between the session rows it separates", () => {
    // A break at 12:00 must fall AFTER the 9:00 row and BEFORE the 13:00 row:
    // the row sequence is the only thing conveying when a break happens now
    // that there is no clock axis to position against.
    const items: PublicAgendaItem[] = [
      item({ submissionId: "a", day: "2026-08-10", startMin: 540, endMin: 600, title: "Morning" }),
      item({ submissionId: "z", day: "2026-08-10", startMin: 780, endMin: 840, title: "Afternoon" }),
    ];
    const breaksByDay = new Map([["2026-08-10", [brk({})]]]);
    const html = String(AgendaContent({ event: EVENT, items, total: 2, breaksByDay }));
    const morning = html.indexOf("Morning");
    const breakAt = html.indexOf('class="chq-pub-agenda-break"');
    const afternoon = html.indexOf("Afternoon");
    expect(morning).toBeGreaterThan(-1);
    expect(breakAt).toBeGreaterThan(morning);
    expect(afternoon).toBeGreaterThan(breakAt);
  });

  it("a break sharing a start minute with a session sorts first, matching the phone list", () => {
    const items: PublicAgendaItem[] = [
      item({ submissionId: "a", day: "2026-08-10", startMin: 720, endMin: 780, title: "Noon talk" }),
    ];
    const breaksByDay = new Map([["2026-08-10", [brk({ startMin: 720 })]]]);
    const html = String(AgendaContent({ event: EVENT, items, total: 1, breaksByDay }));
    const desktop = html.slice(html.indexOf('class="chq-pub-agenda-day"'), html.indexOf("chq-pub-agenda-list-wrap"));
    expect(desktop.indexOf('class="chq-pub-agenda-break"')).toBeLessThan(desktop.indexOf("Noon talk"));
  });

  it("does not count a break as a session or a room in the day heading (a break is not a submission)", () => {
    const items: PublicAgendaItem[] = [item({ submissionId: "a", day: "2026-08-10", startMin: 540, endMin: 600 })];
    const breaksByDay = new Map([["2026-08-10", [brk({})]]]);
    const html = String(AgendaContent({ event: EVENT, items, total: 1, breaksByDay }));
    expect(html).toContain("1 session · 1 room");
    expect(html).not.toContain("2 sessions");
  });

  it("never renders the break on a day it does not belong to", () => {
    const breaksByDay = new Map([["2026-08-10", [brk({})]]]);
    const html = String(
      AgendaContent({ event: EVENT, items: ITEMS, total: 2, breaksByDay }),
    );
    const day1Section = html.slice(html.indexOf('id="chq-day-2026-08-10"'), html.indexOf('id="chq-day-2026-08-11"'));
    const day2Section = html.slice(html.indexOf('id="chq-day-2026-08-11"'));
    expect(day1Section).toContain('class="chq-pub-agenda-break"');
    expect(day2Section).not.toContain('class="chq-pub-agenda-break"');
  });

  it("renders no break markup at all when breaksByDay is absent", () => {
    const html = String(AgendaContent({ event: EVENT, items: ITEMS, total: 2 }));
    expect(html).not.toContain("chq-pub-agenda-break");
  });
});

describe("DEC-022 amendment: ScheduleContent (phone list) break rendering", () => {
  it("renders the break as a list row on the day it belongs to, and only that day", () => {
    const breaksByDay = new Map([["2026-08-10", [brk({})]]]);
    const html = String(
      ScheduleContent({ event: EVENT, items: ITEMS, total: 2, breaksByDay }),
    );
    const day1Section = html.slice(html.indexOf('id="chq-day-2026-08-10"'), html.indexOf('id="chq-day-2026-08-11"'));
    const day2Section = html.slice(html.indexOf('id="chq-day-2026-08-11"'));
    expect(day1Section).toContain('class="chq-pub-agenda-break"');
    expect(day1Section).toContain("Lunch");
    expect(day2Section).not.toContain("chq-pub-agenda-break");
  });
});
