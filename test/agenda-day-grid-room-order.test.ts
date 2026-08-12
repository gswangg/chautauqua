// DEC-563: AgendaDayGrid must not invent a room column order from first
// appearance in the items array — that made a room's day-grid column
// position depend on which sessions happened to land in the array first,
// so it could shuffle from day to day. Columns are ordered by the
// producer-owned (roomPosition asc, roomName asc, roomId asc), with the
// TBD/null-room column always last, regardless of item array order.

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

/** Extracts the header row's room-column labels in rendered (left-to-right)
 * order by reading the grid-column index each header div was assigned. */
function headerOrder(html: string): string[] {
  const headerCells = [...html.matchAll(/grid-column:(\d+);grid-row:1;font-weight:600[^>]*>([^<]*)</g)];
  return headerCells
    .map((m) => ({ col: Number(m[1]), label: m[2]! }))
    .sort((a, b) => a.col - b.col)
    .map((c) => c.label);
}

describe("DEC-563: AgendaDayGrid room column order is producer-owned, not array order", () => {
  const roomA = { roomId: "room-a", roomName: "Alpha Hall", roomPosition: 2 };
  const roomB = { roomId: "room-b", roomName: "Beta Hall", roomPosition: 0 };
  const roomC = { roomId: "room-c", roomName: "Gamma Hall", roomPosition: 1 };

  it("orders columns by roomPosition regardless of item array order, identically for two shuffled arrays", () => {
    const itemsInOrder: PublicAgendaItem[] = [
      item({ submissionId: "s1", ...roomA, startMin: 540, endMin: 600 }),
      item({ submissionId: "s2", ...roomB, startMin: 540, endMin: 600 }),
      item({ submissionId: "s3", ...roomC, startMin: 540, endMin: 600 }),
    ];
    const itemsShuffled: PublicAgendaItem[] = [itemsInOrder[2]!, itemsInOrder[0]!, itemsInOrder[1]!];

    const htmlInOrder = String(AgendaDayGrid({ day: "2026-08-10", items: itemsInOrder, event: EVENT, from: "agenda" }));
    const htmlShuffled = String(AgendaDayGrid({ day: "2026-08-10", items: itemsShuffled, event: EVENT, from: "agenda" }));

    const expected = ["Beta Hall", "Gamma Hall", "Alpha Hall"]; // positions 0,1,2
    expect(headerOrder(htmlInOrder)).toEqual(expected);
    expect(headerOrder(htmlShuffled)).toEqual(expected);
  });

  it("sorts a TBD/null-room column last even when it appears first in the item array", () => {
    const items: PublicAgendaItem[] = [
      item({ submissionId: "s0", roomId: null, roomName: null, roomPosition: null, startMin: 540, endMin: 600 }),
      item({ submissionId: "s1", ...roomB, startMin: 540, endMin: 600 }),
      item({ submissionId: "s2", ...roomA, startMin: 540, endMin: 600 }),
    ];

    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    // DEC-666: sort key is still the internal "tbd" bucket (always last);
    // only the RENDERED word changed to "To be announced".
    expect(headerOrder(html)).toEqual(["Beta Hall", "Alpha Hall", "To be announced"]);
  });
});
