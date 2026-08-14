// DEC-851 amendment (wave 45): ONE READER for "rooms in use" -- prior to
// this task, AgendaContent's <h1> (roomsInUse().filter(!=tbd)), the rail's
// RoomsRailSection (every roomsInUse() row, tbd included) and AgendaDay's
// <h3> (a THIRD, independent Set(roomId ?? "tbd") count that never went
// through roomsInUse() at all) could each report a different room count for
// the same day. This test pins all three readers to realRoomsInUse() and
// confirms the roomless SESSION itself still renders in the grid/list (only
// the room *vocabulary* drops the "tbd" bucket -- DEC-851's own scope, SPEC
// §1 J10 forbids hiding a scheduled/accepted/approved session).

import { describe, expect, it } from "vitest";
import { AgendaContent, AgendaDay } from "../src/routes/public/agenda";
import { realRoomsInUse, roomsInUse } from "../src/routes/public/agenda-rail";
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
    roomId: null,
    roomName: null,
    roomPosition: null,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

const roomA = { roomId: "room-a", roomName: "Alpha Hall", roomPosition: 0 };
const roomB = { roomId: "room-b", roomName: "Beta Hall", roomPosition: 1 };

const TWO_ROOMS_PLUS_UNROOMED: PublicAgendaItem[] = [
  item({ submissionId: "s1", ...roomA, startMin: 540, endMin: 600, title: "Room A talk" }),
  item({ submissionId: "s2", ...roomB, startMin: 540, endMin: 600, title: "Room B talk" }),
  item({ submissionId: "s3", roomId: null, roomName: null, roomPosition: null, startMin: 600, endMin: 630, title: "Unroomed talk" }),
];

describe("DEC-851 amendment (wave 45): realRoomsInUse is the one reader for room counts", () => {
  it("realRoomsInUse excludes the tbd bucket while roomsInUse keeps it (grid ordering contract)", () => {
    expect(realRoomsInUse(TWO_ROOMS_PLUS_UNROOMED).length).toBe(2);
    expect(roomsInUse(TWO_ROOMS_PLUS_UNROOMED).length).toBe(3);
    expect(realRoomsInUse(TWO_ROOMS_PLUS_UNROOMED).some((r) => r.roomKey === "tbd")).toBe(false);
  });

  it("AgendaContent's <h1>, AgendaDay's <h3>, and the rail's room list all agree: 2 rooms, not 3", () => {
    const html = String(
      AgendaContent({
        event: EVENT,
        items: TWO_ROOMS_PLUS_UNROOMED,
        total: TWO_ROOMS_PLUS_UNROOMED.length,
        allDays: ["2026-08-10"],
        activeDay: "2026-08-10",
      }),
    );

    // <h1> room count.
    expect(html).toContain("2 rooms");
    expect(html).not.toContain("3 rooms");

    // "Rooms in use today" lists exactly 2 rows, never the unroomed bucket.
    expect(html).toContain("Rooms in use today");
    const railSectionMatch = html.match(/<h2 class="chq-pub-rail-heading">Rooms in use today<\/h2>([\s\S]*?)<\/section>/);
    expect(railSectionMatch).toBeTruthy();
    const railBody = railSectionMatch![1]!;
    expect((railBody.match(/chq-pub-rail-day-row/g) ?? []).length).toBe(2);
    expect(railBody).not.toContain("To be announced");

    // The grid/list surface still renders the roomless session and its
    // trailing "To be announced" room label (DEC-851's scope note: the
    // column stays -- only the room vocabulary drops the bucket).
    expect(html).toContain("Unroomed talk");
    expect(html).toContain("To be announced");
  });

  it("AgendaDay's own <h3> (hideHeading=false) reports the same 2-room count through realRoomsInUse, never a Set(roomId) count", () => {
    const html = String(
      AgendaDay({
        day: "2026-08-10",
        items: TWO_ROOMS_PLUS_UNROOMED,
        event: EVENT,
        from: "agenda",
        hideHeading: false,
      }),
    );
    expect(html).toContain("2 rooms");
    expect(html).not.toContain("3 rooms");
  });

  it("a day with only unroomed sessions renders no 'Rooms in use today' section", () => {
    const onlyUnroomed: PublicAgendaItem[] = [
      item({ submissionId: "s1", roomId: null, roomName: null, roomPosition: null, startMin: 540, endMin: 600 }),
      item({ submissionId: "s2", roomId: null, roomName: null, roomPosition: null, startMin: 600, endMin: 630 }),
    ];
    const html = String(
      AgendaContent({
        event: EVENT,
        items: onlyUnroomed,
        total: onlyUnroomed.length,
        allDays: ["2026-08-10"],
        activeDay: "2026-08-10",
      }),
    );
    expect(html).not.toContain("Rooms in use today");
    expect(html).toContain("0 rooms");
  });
});
