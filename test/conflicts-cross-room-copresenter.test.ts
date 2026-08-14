import { describe, expect, it } from "vitest";
import { getAgendaPayload } from "../src/server/repo/agenda";
import { findConflicts, type PlacedSession } from "../src/domain/schedule";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

/**
 * SBEK-RUN-3 (P1 Conflict engine gaps, AIA): a speaker double-booking must
 * still be caught when the two clashing sessions are in DIFFERENT rooms and
 * the shared person is a CO-PRESENTER (participant.order > 0, not the
 * primary speaker at order 0). Fixture idiom copied from
 * test/schedule-conflicts-equivalence.test.ts (pure findConflicts check) and
 * the DEC-974 fake-db block in test/agenda-repo.test.ts (getAgendaPayload
 * assembly check), so both the pure engine and the wired repo function are
 * proven against the same shape of input.
 */

describe("cross-room co-presenter double-booking (SBEK-RUN-3 P1)", () => {
  it("findConflicts emits exactly one speaker_overlap naming both submissionIds for a same-slot different-room co-presenter clash", () => {
    const placed: PlacedSession[] = [
      {
        submissionId: "sub-1",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 540,
        endMin: 600,
        speakerContactIds: ["primary-1", "shared-copresenter"],
      },
      {
        submissionId: "sub-2",
        roomId: "room-b",
        day: "2026-08-10",
        startMin: 570,
        endMin: 630,
        speakerContactIds: ["primary-2", "shared-copresenter"],
      },
    ];

    const conflicts = findConflicts(placed);
    const speakerOverlaps = conflicts.filter((c) => c.kind === "speaker_overlap");
    expect(speakerOverlaps).toHaveLength(1);
    expect(speakerOverlaps[0]?.submissionIds).toEqual(["sub-1", "sub-2"]);
    expect(speakerOverlaps[0]?.speakerContactIds).toEqual(["shared-copresenter"]);
    // No room_overlap: the two rooms differ.
    expect(conflicts.filter((c) => c.kind === "room_overlap")).toHaveLength(0);
  });

  it("getAgendaPayload carries the conflict AND both sessions' speakers arrays include the co-presenter", async () => {
    const rooms = [{ id: "room-a", name: "Room A" }, { id: "room-b", name: "Room B" }];
    const submissions = [
      { id: "sub-1", seq: 1, title: "Talk One" },
      { id: "sub-2", seq: 2, title: "Talk Two" },
    ];
    // Both sessions have a primary speaker (order 0) and share a
    // co-presenter (order 1, invite_status 'accepted') across rooms.
    const participants = [
      { submissionId: "sub-1", contactId: "primary-1", firstName: "Primo", lastName: "Presenter", order: 0, inviteStatus: "accepted" },
      { submissionId: "sub-1", contactId: "shared-copresenter", firstName: "Casey", lastName: "CoPresenter", order: 1, inviteStatus: "accepted" },
      { submissionId: "sub-2", contactId: "primary-2", firstName: "Secondo", lastName: "Presenter", order: 0, inviteStatus: "accepted" },
      { submissionId: "sub-2", contactId: "shared-copresenter", firstName: "Casey", lastName: "CoPresenter", order: 1, inviteStatus: "accepted" },
    ];
    const slots = [
      { submissionId: "sub-1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600 },
      { submissionId: "sub-2", roomId: "room-b", day: "2026-08-10", startMin: 570, endMin: 630 },
    ];

    function rowsFor(table: unknown): unknown[] {
      if (table === schema.room) return rooms;
      if (table === schema.track) return [];
      if (table === schema.submission) return submissions;
      if (table === schema.submissionTrack) return [];
      if (table === schema.participant) return participants;
      if (table === schema.scheduleSlot) return slots;
      if (table === schema.submissionAnswer) return [];
      return [];
    }

    const db = {
      select: () => {
        let table: unknown;
        const chain: any = {
          from: (t: unknown) => {
            table = t;
            return chain;
          },
          innerJoin: () => chain,
          leftJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: async () => rowsFor(table),
          then: (resolve: (v: unknown[]) => void) => resolve(rowsFor(table)),
        };
        return chain;
      },
    } as unknown as Db;

    const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };
    const payload = await getAgendaPayload(db, "event1", event);

    expect(payload.conflicts.length).toBeGreaterThan(0);
    const sub1 = payload.placed.find((p) => p.submissionId === "sub-1");
    const sub2 = payload.placed.find((p) => p.submissionId === "sub-2");
    expect(sub1?.speakers.map((s) => s.contactId)).toContain("shared-copresenter");
    expect(sub2?.speakers.map((s) => s.contactId)).toContain("shared-copresenter");
    // Both sessions in different rooms — this is the speaker_overlap case,
    // not a room double-booking.
    expect(sub1?.roomId).toBe("room-a");
    expect(sub2?.roomId).toBe("room-b");
  });
});
