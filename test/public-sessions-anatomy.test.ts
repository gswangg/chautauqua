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
    expect(html).not.toMatch(/\d+ of \d+ sessions?/);
  });

  it("an empty result with no filter active states emptiness without implying a search was run", () => {
    const html = render({ items: [], total: 0 });
    expect(html).toContain("No sessions to show yet.");
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
