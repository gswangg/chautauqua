/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { buildOverviewCards, type OverviewPayload } from "../app/src/pages/overview/cards";

function basePayload(overrides: Partial<OverviewPayload> = {}): OverviewPayload {
  return {
    triage: { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 0, conflicts: 0 },
    comms: { sentLast7Days: 0, lastSentAt: null },
    ...overrides,
  };
}

describe("buildOverviewCards (DEC-030 card-link mapping)", () => {
  it("returns six cards in nav order with the correct links", () => {
    const cards = buildOverviewCards(basePayload());
    expect(cards.map((c) => c.key)).toEqual([
      "triage",
      "review",
      "speakers",
      "content",
      "agenda",
      "comms",
    ]);
    expect(cards.map((c) => c.link)).toEqual([
      "/submissions?status=pending",
      "/review",
      "/speakers",
      "/content",
      "/agenda",
      "/comms",
    ]);
  });

  it("zero states name the next action", () => {
    const cards = buildOverviewCards(basePayload());
    for (const card of cards) {
      expect(card.count).toBe(0);
      expect(card.zeroSentence.length).toBeGreaterThan(0);
    }
  });

  it("triage count sums pending + accept_queue + decline_queue", () => {
    const cards = buildOverviewCards(
      basePayload({ triage: { pending: 3, accept_queue: 2, decline_queue: 1 } }),
    );
    const triage = cards.find((c) => c.key === "triage")!;
    expect(triage.count).toBe(6);
    expect(triage.sentence).toContain("3 submissions waiting for triage");
  });

  it("agenda count sums unplaced + conflicts", () => {
    const cards = buildOverviewCards(basePayload({ agenda: { unplaced: 2, conflicts: 1 } }));
    const agenda = cards.find((c) => c.key === "agenda")!;
    expect(agenda.count).toBe(3);
    expect(agenda.sentence).toContain("2 accepted sessions unplaced");
  });

  it("comms count reflects sentLast7Days", () => {
    const cards = buildOverviewCards(basePayload({ comms: { sentLast7Days: 5, lastSentAt: 123 } }));
    const comms = cards.find((c) => c.key === "comms")!;
    expect(comms.count).toBe(5);
    expect(comms.sentence).toContain("5 messages sent");
  });
});
