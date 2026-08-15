import { describe, expect, it } from "vitest";
import { getAgendaPayload } from "../src/server/repo/agenda";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { SCHEDULING_PARTICIPANT_STATUSES, ACTIVE_INVITE_STATUSES } from "../src/domain/acceptance";

/**
 * DEC-974 amendment (w49-a): an organiser-added co-presenter is minted at
 * inviteStatus 'invited' (src/server/repo/participants.ts). Organiser
 * surfaces — the conflict engine's speaker set / the admin agenda card / the
 * results page & export — must count them (SCHEDULING_PARTICIPANT_STATUSES:
 * 'none'/'invited'/'accepted'), NOT just ACTIVE_INVITE_STATUSES
 * ('none'/'accepted'), which gates write/public surfaces only.
 */

describe("SCHEDULING_PARTICIPANT_STATUSES (DEC-974 amendment)", () => {
  it("includes 'invited' and is a strict superset of ACTIVE_INVITE_STATUSES, excluding only 'declined'", () => {
    expect(SCHEDULING_PARTICIPANT_STATUSES).toEqual(["none", "invited", "accepted"]);
    for (const s of ACTIVE_INVITE_STATUSES) {
      expect(SCHEDULING_PARTICIPANT_STATUSES as readonly string[]).toContain(s);
    }
    expect(SCHEDULING_PARTICIPANT_STATUSES as readonly string[]).not.toContain("declined");
  });

  it("getAgendaPayload flags a speaker_overlap conflict and shows the co-presenter on BOTH cards when their inviteStatus is 'invited'", async () => {
    const rooms = [{ id: "room-a", name: "Room A" }, { id: "room-b", name: "Room B" }];
    const submissions = [
      { id: "sub-1", seq: 1, title: "Talk One" },
      { id: "sub-2", seq: 2, title: "Talk Two" },
    ];
    // The shared co-presenter is 'invited' (organiser-added, not yet
    // accepted) on both sessions — the exact runtime shape participants.ts
    // mints.
    const participants = [
      { submissionId: "sub-1", contactId: "primary-1", firstName: "Primo", lastName: "Presenter", order: 0, inviteStatus: "accepted" },
      { submissionId: "sub-1", contactId: "shared-copresenter", firstName: "Casey", lastName: "CoPresenter", order: 1, inviteStatus: "invited" },
      { submissionId: "sub-2", contactId: "primary-2", firstName: "Secondo", lastName: "Presenter", order: 0, inviteStatus: "accepted" },
      { submissionId: "sub-2", contactId: "shared-copresenter", firstName: "Casey", lastName: "CoPresenter", order: 1, inviteStatus: "invited" },
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

    const speakerOverlaps = payload.conflicts.filter((c) => c.kind === "speaker_overlap");
    expect(speakerOverlaps.length).toBeGreaterThan(0);
    expect(speakerOverlaps[0]?.submissionIds).toEqual(["sub-1", "sub-2"]);

    const sub1 = payload.placed.find((p) => p.submissionId === "sub-1");
    const sub2 = payload.placed.find((p) => p.submissionId === "sub-2");
    expect(sub1?.speakers.map((s) => s.contactId)).toContain("shared-copresenter");
    expect(sub2?.speakers.map((s) => s.contactId)).toContain("shared-copresenter");
  });
});
