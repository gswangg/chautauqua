// DEC-919 (wave 44 amendment): "the public sessions list stops restating its
// count, and its rail earns its width". SessionsContent is exercised
// directly (mirrors test/public-row-ceiling.test.ts's `String(SessionsContent(...))`
// convention) rather than through a full HTTP mock, since every fact under
// test (the count row, the CFP block, the day block) lives entirely in this
// pure render function's own branching on its props.

import { describe, expect, it } from "vitest";
import { SessionsContent } from "../src/routes/public/sessions";
import type { PublicEvent, PublicSession } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "DevFlow Conf",
  slug: "devflow",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function session(i: number): PublicSession {
  return {
    id: `s${i}`,
    ref: `s${i}`,
    title: `Session ${i}`,
    description: null,
    icsSequence: 1,
    tracks: [],
    speakers: [],
    day: null,
    startMin: null,
    endMin: null,
    roomName: null,
    format: null,
  };
}

function render(overrides: Partial<Parameters<typeof SessionsContent>[0]> = {}): string {
  const items = overrides.items ?? [session(1), session(2)];
  return String(
    SessionsContent({
      event: EVENT,
      tracks: [],
      activeTrackId: null,
      q: null,
      items,
      total: items.length,
      page: 1,
      ...overrides,
    }),
  );
}

describe("DEC-919 (wave 44): sessions surface stops restating its count", () => {
  it("does not print an 'N of M sessions' line on the default view", () => {
    const html = render();
    expect(html).not.toMatch(/\d+ of \d+ sessions?/);
  });

  it("an empty (filtered) result still states its emptiness honestly", () => {
    const html = render({ items: [], total: 0, q: "no-match-query" });
    expect(html).toContain("No sessions match your search.");
    // v7 supersedes DEC-919's blanket no-count rule for FILTERED views: the
    // active-filter line states "0 of N sessions" precisely because a filter
    // is set ("the count answers the question filtering raises"). The
    // no-count rule still holds at rest (test above).
    expect(html).toContain('class="chq-pub-activefilters"');
    expect(html).toMatch(/0 of \d+ sessions/);
  });

  it("an empty result with no filter active states emptiness without implying a search was run", () => {
    // DEC-919 (wave 47 amendment): a filter-free zero result is 'fresh' --
    // PublicEmptyState now names the actual reason (nothing published yet)
    // instead of the old generic "No sessions to show yet." sentence.
    const html = render({ items: [], total: 0 });
    expect(html).toContain("The programme is not out yet");
    expect(html).not.toContain("No sessions to show yet.");
  });
});

describe("DEC-919 (wave 44): the CFP rail block reads the SAME formWindowState the /submit route uses", () => {
  it("is present while the CFP window is open", () => {
    const openWindow = {
      openDate: Date.now() - 1000 * 60 * 60 * 24 * 7,
      closeDate: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    const html = render({ cfpWindow: openWindow });
    expect(html).toContain("Call for papers");
    expect(html).toContain("Submit a talk");
  });

  it("is absent when the CFP window has not yet opened", () => {
    const farFuture = { openDate: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, closeDate: null };
    const html = render({ cfpWindow: farFuture });
    expect(html).not.toContain("Call for papers");
    expect(html).not.toContain("Submit a talk");
  });

  it("is absent when the CFP window has already closed", () => {
    const closed = { openDate: Date.UTC(2020, 0, 1), closeDate: Date.UTC(2020, 0, 31) };
    const html = render({ cfpWindow: closed });
    expect(html).not.toContain("Call for papers");
    expect(html).not.toContain("Submit a talk");
  });

  it("is absent when there is no CFP window at all", () => {
    const html = render({ cfpWindow: null });
    expect(html).not.toContain("Call for papers");
  });
});

describe("DEC-919 (wave 44): the day block lists every event day, and spells its own count", () => {
  it("lists all 3 days of a 3-day event even when dayCounts only carries days with sessions", () => {
    const html = render({ dayCounts: [{ day: "2026-08-11", count: 4 }] });
    expect(html).toContain("Three days");
    expect(html).toContain(`/e/${EVENT.slug}/agenda?day=2026-08-10`);
    expect(html).toContain(`/e/${EVENT.slug}/agenda?day=2026-08-11`);
    expect(html).toContain(`/e/${EVENT.slug}/agenda?day=2026-08-12`);
  });

  it("a day absent from dayCounts still renders, with a 0 count", () => {
    const html = render({ dayCounts: [] });
    expect(html).toContain(`/e/${EVENT.slug}/agenda?day=2026-08-10`);
    expect(html).toContain("0 sessions");
  });

  it("a single-day event spells 'One day'", () => {
    const oneDayEvent: PublicEvent = { ...EVENT, startDate: "2026-08-10", endDate: "2026-08-10" };
    const html = String(
      SessionsContent({
        event: oneDayEvent,
        tracks: [],
        activeTrackId: null,
        q: null,
        items: [session(1)],
        total: 1,
        page: 1,
        dayCounts: [],
      }),
    );
    expect(html).toContain("One day");
  });
});

// w1-c (DEC-534): the gutter drops the day (now start time + room, two
// lines) and the day moves out to a per-day heading rendered by
// SessionsContent itself when the page spans more than one scheduled day.
describe("w1-c (DEC-534): sessions-list gutter shape + day headings", () => {
  function scheduled(i: number, day: string, startMin: number, endMin: number, roomName: string | null = "Room A"): PublicSession {
    return { ...session(i), day, startMin, endMin, roomName };
  }

  it("a scheduled row's gutter shows start time (24h, no zero pad) and room, never the old range/date text", () => {
    const html = render({ items: [scheduled(1, "2026-08-10", 9 * 60, 9 * 60 + 30, "Room 2A")] });
    expect(html).toContain('<span class="chq-pub-session-time">9:00</span>');
    expect(html).toContain('<span class="chq-pub-session-room">Room 2A</span>');
    // The old three-line "9:00 AM–9:30 AM" / "Fri, ... · Room 2A" text is gone.
    expect(html).not.toMatch(/9:00 AM.*9:30 AM/);
  });

  it("an unroomed scheduled row still reads a room label (publicRoomLabel's TBA fallback), never a blank line 2", () => {
    const html = render({ items: [scheduled(1, "2026-08-10", 9 * 60, 9 * 60 + 30, null)] });
    expect(html).toMatch(/<span class="chq-pub-session-room">[^<]+<\/span>/);
  });

  it("an unscheduled row keeps the EMPTY gutter cell (DEC-698 — the column is never collapsed)", () => {
    const html = render({ items: [session(1)] });
    expect(html).toContain('<div class="chq-pub-session-when"');
  });

  it("no day heading when the page's items are all on the same scheduled day", () => {
    const html = render({
      items: [scheduled(1, "2026-08-10", 540, 570), scheduled(2, "2026-08-10", 600, 630)],
    });
    expect(html).not.toContain("chq-pub-sessions-day-heading");
  });

  it("a day heading appears once before the first card of each day when the page spans days", () => {
    const html = render({
      items: [
        scheduled(1, "2026-08-10", 540, 570),
        scheduled(2, "2026-08-10", 600, 630),
        scheduled(3, "2026-08-11", 540, 570),
      ],
    });
    const headingCount = (html.match(/chq-pub-sessions-day-heading/g) ?? []).length;
    expect(headingCount).toBe(2);
    // The second day's heading appears after session 2's title and before
    // session 3's — i.e. it sits directly ahead of the row it introduces.
    const idx2 = html.indexOf("Session 2");
    const idxHeading2 = html.lastIndexOf("chq-pub-sessions-day-heading", html.indexOf("Session 3"));
    const idx3 = html.indexOf("Session 3");
    expect(idx2).toBeLessThan(idxHeading2);
    expect(idxHeading2).toBeLessThan(idx3);
  });

  it("no day headings when a ?day= filter narrows the page to a single day, even if items were multi-day", () => {
    const html = render({
      items: [scheduled(1, "2026-08-10", 540, 570), scheduled(2, "2026-08-11", 540, 570)],
      activeDay: "2026-08-10",
    });
    expect(html).not.toContain("chq-pub-sessions-day-heading");
  });

  it("unscheduled rows never get a day heading ahead of them, even on a multi-day page", () => {
    const html = render({
      items: [scheduled(1, "2026-08-10", 540, 570), scheduled(2, "2026-08-11", 540, 570), session(3)],
    });
    const headingCount = (html.match(/chq-pub-sessions-day-heading/g) ?? []).length;
    expect(headingCount).toBe(2);
  });
});
