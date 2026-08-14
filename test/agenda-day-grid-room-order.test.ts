// DEC-563: AgendaDayGrid must not invent a room order from first
// appearance in the items array — that made a room's position among
// same-start-time blocks depend on which sessions happened to land in the
// array first, so it could shuffle from day to day. DEC-584 (wave 64
// amendment) replaced the room-COLUMN grid with a time-row sequence, but
// the underlying producer-owned order (roomPosition asc, roomName asc,
// roomId asc, TBD/null-room always last) still governs the left-to-right
// order of blocks that share a start time, regardless of item array order.

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

/** Extracts the room-eyebrow labels of blocks in a single time-row, in
 * rendered (document/left-to-right) order. */
function blockRoomOrder(html: string): string[] {
  return [...html.matchAll(/<span class="chq-pub-agenda-block-room">([^<]*)<\/span>/g)].map((m) => m[1]!);
}

describe("DEC-563: same-start-time block order is producer-owned, not array order (DEC-584 wave 64: rooms are eyebrow labels, not columns)", () => {
  const roomA = { roomId: "room-a", roomName: "Alpha Hall", roomPosition: 2 };
  const roomB = { roomId: "room-b", roomName: "Beta Hall", roomPosition: 0 };
  const roomC = { roomId: "room-c", roomName: "Gamma Hall", roomPosition: 1 };

  it("orders same-start-time blocks by roomPosition regardless of item array order, identically for two shuffled arrays", () => {
    const itemsInOrder: PublicAgendaItem[] = [
      item({ submissionId: "s1", ...roomA, startMin: 540, endMin: 600 }),
      item({ submissionId: "s2", ...roomB, startMin: 540, endMin: 600 }),
      item({ submissionId: "s3", ...roomC, startMin: 540, endMin: 600 }),
    ];
    const itemsShuffled: PublicAgendaItem[] = [itemsInOrder[2]!, itemsInOrder[0]!, itemsInOrder[1]!];

    const htmlInOrder = String(AgendaDayGrid({ day: "2026-08-10", items: itemsInOrder, event: EVENT, from: "agenda" }));
    const htmlShuffled = String(AgendaDayGrid({ day: "2026-08-10", items: itemsShuffled, event: EVENT, from: "agenda" }));

    const expected = ["Beta Hall", "Gamma Hall", "Alpha Hall"]; // positions 0,1,2
    expect(blockRoomOrder(htmlInOrder)).toEqual(expected);
    expect(blockRoomOrder(htmlShuffled)).toEqual(expected);
  });

  it("sorts a TBD/null-room block last even when it appears first in the item array", () => {
    const items: PublicAgendaItem[] = [
      item({ submissionId: "s0", roomId: null, roomName: null, roomPosition: null, startMin: 540, endMin: 600 }),
      item({ submissionId: "s1", ...roomB, startMin: 540, endMin: 600 }),
      item({ submissionId: "s2", ...roomA, startMin: 540, endMin: 600 }),
    ];

    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    // DEC-666: sort key is still the internal "tbd" bucket (always last);
    // only the RENDERED word changed to "To be announced".
    expect(blockRoomOrder(html)).toEqual(["Beta Hall", "Alpha Hall", "To be announced"]);
  });
});
