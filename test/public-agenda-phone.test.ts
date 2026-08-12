// DEC-584: public agenda / schedule at 390px. AgendaDayGrid keeps its
// absolutely-positioned room-column grid unchanged, wrapped in a
// display:none-below-700px container; a phone <ol class="chq-pub-agenda-
// list"> renders the SAME items array as a vertical list. Both markups
// exist in the DOM at once (CSS switches which is visible), so a session
// renders TWO .chq-itinerary-toggle inputs sharing the same value — the
// change handler must mirror a check/uncheck across both copies before
// recomputing the selection, or the hidden copy silently keeps the id
// selected (see mirrorItineraryCheckboxes unit tests below).

import { describe, expect, it } from "vitest";
import { AgendaContent, AgendaDayGrid, ScheduleContent } from "../src/routes/public/agenda";
import { mirrorItineraryCheckboxes } from "../src/lib/itinerary";
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
    format: null,
    ...overrides,
  };
}

const ITEMS: PublicAgendaItem[] = [
  item({ submissionId: "s1", startMin: 540, endMin: 600, title: "Opening Talk" }),
  item({
    submissionId: "s2",
    startMin: 480,
    endMin: 530,
    title: "Early Bird",
    roomId: "room-b",
    roomName: "Beta Hall",
    roomPosition: 1,
    speakers: [{ contactId: "sp2", firstName: "Grace", lastName: "Hopper", title: null, company: null, headshotUrl: null, bio: null }],
  }),
];

describe("DEC-584: public agenda phone list + desktop grid dual markup", () => {
  it("AgendaContent renders both the desktop grid wrapper and the phone list for one day", () => {
    const html = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(html).toContain('class="chq-pub-agenda-desktop"');
    expect(html).toContain('class="chq-pub-agenda-list"');
    // desktop grid markup untouched: still a CSS grid with grid-template-columns
    expect(html).toContain("chq-pub-agenda-day-scroll");
    expect(html).toContain("chq-pub-agenda-day\"");
  });

  it("the phone list carries time, room name (as text) and speaker names as text, in start-time order", () => {
    const html = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    const listMatch = html.match(/<ol class="chq-pub-agenda-list">([\s\S]*?)<\/ol>/);
    expect(listMatch).toBeTruthy();
    const listHtml = listMatch![1]!;
    // start-time order: Early Bird (480) before Opening Talk (540)
    expect(listHtml.indexOf("Early Bird")).toBeLessThan(listHtml.indexOf("Opening Talk"));
    expect(listHtml).toContain("8:00 AM");
    expect(listHtml).toContain("9:00 AM");
    expect(listHtml).toContain("Beta Hall");
    expect(listHtml).toContain("Alpha Hall");
    expect(listHtml).toContain("Grace");
    expect(listHtml).toContain("Hopper");
    expect(listHtml).toContain("Ada");
    expect(listHtml).toContain("Lovelace");
    expect(listHtml).toContain("Track One");
    // desktop grid's own duplicate-value inputs shouldn't be inside the list
    expect(listHtml).not.toContain("grid-column");
  });

  it("desktop AgendaDayGrid markup is unchanged by the surrounding wrapper", () => {
    const bareHtml = String(AgendaDayGrid({ day: "2026-08-10", items: ITEMS, event: EVENT, from: "agenda" }));
    const wrappedHtml = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(wrappedHtml).toContain(bareHtml);
  });

  // DEC-602: ScheduleContent no longer renders AgendaDayGrid's room-column
  // grid at any width (EMB-09), so /schedule renders exactly ONE
  // .chq-itinerary-toggle per session now, not the dual-markup trap the
  // old desktop-grid + phone-list wrapper produced.
  it("ScheduleContent renders exactly ONE .chq-itinerary-toggle input per session (no dual grid+list markup)", () => {
    const html = String(ScheduleContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    const matches = [...html.matchAll(/class="chq-itinerary-toggle" value="s1"/g)];
    expect(matches.length).toBe(1);
    expect(html).not.toContain('class="chq-pub-agenda-day"');
  });

  it("the phone list itinerary row exists only on /schedule (ScheduleContent), not /agenda (AgendaContent)", () => {
    const agendaHtml = String(AgendaContent({ event: EVENT, items: ITEMS, total: ITEMS.length }));
    expect(agendaHtml).not.toContain("chq-itinerary-toggle");
  });
});

describe("mirrorItineraryCheckboxes (DEC-584 checkbox-mirroring, the actual function ItineraryScript calls)", () => {
  it("sets every box sharing the changed value to the new checked state", () => {
    const boxes = [
      { value: "s1", checked: true },
      { value: "s2", checked: false },
      { value: "s1", checked: true }, // the hidden duplicate copy
    ];
    const result = mirrorItineraryCheckboxes(boxes, "s1", false);
    expect(result).toEqual([
      { value: "s1", checked: false },
      { value: "s2", checked: false },
      { value: "s1", checked: false },
    ]);
  });

  it("leaves boxes with a different value untouched", () => {
    const boxes = [
      { value: "s1", checked: false },
      { value: "s2", checked: true },
    ];
    const result = mirrorItineraryCheckboxes(boxes, "s1", true);
    expect(result).toEqual([
      { value: "s1", checked: true },
      { value: "s2", checked: true },
    ]);
  });

  it("checking one copy checks the other, so a merge over currentIds() includes the id", () => {
    const boxes = [
      { value: "s1", checked: false },
      { value: "s1", checked: false },
    ];
    const mirrored = mirrorItineraryCheckboxes(boxes, "s1", true);
    const currentIds = mirrored.filter((b) => b.checked).map((b) => b.value);
    expect(currentIds).toEqual(["s1", "s1"]);
  });
});
