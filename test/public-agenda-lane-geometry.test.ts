// task-w34-f (DEC-999): a public agenda block is a content-sized box in its
// own lane, and nothing clips or overruns. Lane geometry moved out of an
// inline width/margin-left template string (a percentage margin-left on a
// grid ITEM does not compose with a percentage width the way the old
// formula intended) into two custom properties (--chq-lane/--chq-lane-count)
// consumed by a single public.css.ts rule.

import { describe, expect, it } from "vitest";
import { AgendaDayGrid, laneStyleFor } from "../src/routes/public/agenda";
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

describe("laneStyleFor (DEC-999): pure lane-geometry helper", () => {
  it("returns an empty string for laneCount 1 (no inline style needed at all)", () => {
    expect(laneStyleFor(0, 1)).toBe("");
  });

  it("publishes both custom properties for a two-lane cluster", () => {
    expect(laneStyleFor(0, 2)).toBe("--chq-lane:0;--chq-lane-count:2");
    expect(laneStyleFor(1, 2)).toBe("--chq-lane:1;--chq-lane-count:2");
  });

  it("publishes both custom properties for every lane in a three-lane cluster", () => {
    expect(laneStyleFor(0, 3)).toBe("--chq-lane:0;--chq-lane-count:3");
    expect(laneStyleFor(1, 3)).toBe("--chq-lane:1;--chq-lane-count:3");
    expect(laneStyleFor(2, 3)).toBe("--chq-lane:2;--chq-lane-count:3");
  });
});

describe("AgendaDayGrid (DEC-999): a block is a content-sized box in its own lane", () => {
  it("a 15-minute session's full title and every speaker name are present, with no truncation class", () => {
    const items = [
      item({
        submissionId: "s1",
        title: "A Very Short Fifteen Minute Lightning Talk About Something Long",
        startMin: 540,
        endMin: 555,
        speakers: [
          { contactId: "sp1", firstName: "Ada", lastName: "Lovelace", title: "Engineer", company: "Acme", headshotUrl: null, bio: null },
          { contactId: "sp2", firstName: "Grace", lastName: "Hopper", title: null, company: "Navy", headshotUrl: null, bio: null },
        ],
      }),
    ];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    expect(html).toContain("A Very Short Fifteen Minute Lightning Talk About Something Long");
    expect(html).toContain("Ada");
    expect(html).toContain("Grace");
    expect(html).not.toMatch(/line-clamp/);
    expect(html).not.toMatch(/class="[^"]*truncat/i);
  });

  it("a two-lane overlap carries different --chq-lane values and no inline width:/margin-left:", () => {
    const items = [
      item({ submissionId: "s1", startMin: 540, endMin: 600, title: "First Overlapping Talk" }),
      item({ submissionId: "s2", startMin: 570, endMin: 630, title: "Second Overlapping Talk" }),
    ];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));

    const block1 = html.match(/<div class="chq-pub-agenda-block" style="([^"]*)" id="chq-agenda-s1">/);
    const block2 = html.match(/<div class="chq-pub-agenda-block" style="([^"]*)" id="chq-agenda-s2">/);
    expect(block1).toBeTruthy();
    expect(block2).toBeTruthy();
    const style1 = block1![1];
    const style2 = block2![1];

    expect(style1).toContain("--chq-lane-count:2");
    expect(style2).toContain("--chq-lane-count:2");
    const laneOf = (style: string) => style.match(/--chq-lane:(\d+)/)?.[1];
    expect(laneOf(style1)).toBeTruthy();
    expect(laneOf(style2)).toBeTruthy();
    expect(laneOf(style1)).not.toBe(laneOf(style2));

    for (const style of [style1, style2]) {
      expect(style).not.toMatch(/(^|;)width:/);
      expect(style).not.toMatch(/(^|;)margin-left:/);
    }
  });

  it("a single-lane (non-overlapping) block carries no lane custom properties at all", () => {
    const items = [item({ submissionId: "s1", startMin: 540, endMin: 555 })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    const block = html.match(/<div class="chq-pub-agenda-block" style="([^"]*)" id="chq-agenda-s1">/);
    expect(block).toBeTruthy();
    expect(block![1]).not.toContain("--chq-lane");
  });
});
