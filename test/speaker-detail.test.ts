// DEC-930 repo-level regression: getSpeakerDetail (src/server/repo/tasks/
// speaker-detail.ts) is the ONE bounded read behind
// GET /api/v1/events/:eventId/speakers/:contactId — returns null (route
// 404s) when the contact is not on this event's roster, and its query count
// is independent of how many sessions/tasks the contact has. In-memory
// table-double fakeDb pattern from test/onboarding-late-participant.test.ts
// (WHERE/JOIN ignored — every table here only ever holds rows relevant to
// the contact/event under test; no real-D1 harness exists in stage 1 per
// DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { getSpeakerDetail } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

function fakeDb(seed: {
  contact?: unknown[];
  user?: unknown[];
  participant?: unknown[];
  submission?: unknown[];
  event?: unknown[];
  scheduleSlot?: unknown[];
  room?: unknown[];
  taskAssignment?: unknown[];
  task?: unknown[];
  file?: unknown[];
}) {
  const state = {
    contact: [...(seed.contact ?? [])] as any[],
    user: [...(seed.user ?? [])] as any[],
    participant: [...(seed.participant ?? [])] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    event: [...(seed.event ?? [])] as any[],
    scheduleSlot: [...(seed.scheduleSlot ?? [])] as any[],
    room: [...(seed.room ?? [])] as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    task: [...(seed.task ?? [])] as any[],
    file: [...(seed.file ?? [])] as any[],
  };
  const touchedTables: unknown[] = [];

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.contact) return state.contact;
    if (table === schema.user) return state.user;
    if (table === schema.participant) return state.participant;
    if (table === schema.submission) return state.submission;
    if (table === schema.event) return state.event;
    if (table === schema.scheduleSlot) return state.scheduleSlot;
    if (table === schema.room) return state.room;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.task) return state.task;
    if (table === schema.file) return state.file;
    return undefined;
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => {
        touchedTables.push(table);
        return makeChain([...(stateArrayFor(table) ?? [])]);
      },
    }),
  };
  return { db: db as unknown as Db, touchedTables };
}

const EVENT_ID = "event-1";
const CONTACT_ID = "contact-1";

function contactRow(opts: Partial<Record<string, unknown>> = {}) {
  return {
    id: CONTACT_ID,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines Inc",
    title: "Engineer",
    phone: null,
    notes: null,
    headshotUrl: null,
    headshotFileId: null,
    userId: null,
    ...opts,
  };
}

function otherEventRow(eventId: string, name: string, startDate: string) {
  return { eventId, eventName: name, eventStartDate: startDate };
}

function eventRow() {
  // DEC-801 (wave 58 amendment): getSpeakerDetail's event lookup now also
  // resolves the owning event's timezone for the day-label-aware overdue
  // predicate (overdueAssignmentConditions).
  return { recordPrefix: "SES", timezone: "America/New_York" };
}

function participantRow(submissionId: string, seq: number, opts: Partial<Record<string, unknown>> = {}) {
  return {
    participantId: `p-${submissionId}`,
    submissionId,
    inviteStatus: "accepted",
    role: "speaker",
    submissionSeq: seq,
    submissionTitle: `Talk ${seq}`,
    submissionStatus: "accepted",
    submissionContentStatus: "approved",
    ...opts,
  };
}

function assignmentRow(assignmentId: string, taskId: string, opts: Partial<Record<string, unknown>> = {}) {
  return {
    assignmentId,
    taskId,
    taskTitle: `Task ${taskId}`,
    taskKind: "general",
    required: true,
    dueDate: null,
    status: "pending",
    completedAt: null,
    fileId: null,
    fileName: null,
    fileSizeBytes: null,
    fileVersionNo: null,
    ...opts,
  };
}

describe("DEC-930 getSpeakerDetail", () => {
  it("returns the exact payload shape for a roster contact with a session and a task", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 14)],
      scheduleSlot: [{ submissionId: "sub-1", day: "2026-06-01", startMin: 540, endMin: 600, roomName: "Ballroom A" }],
      taskAssignment: [assignmentRow("assign-1", "task-1", { fileId: "file-1", fileName: "slides.pdf", fileSizeBytes: 1024, fileVersionNo: 2 })],
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail).toEqual({
      contact: {
        id: CONTACT_ID,
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines Inc",
        title: "Engineer",
        hasAccount: false,
        phone: null,
        notes: null,
        // DEC-738 amendment (wave 71): the person's org-wide logistics
        // facts; blank/absent customFieldsJson projects as {}, never null.
        customFields: {},
        headshotFileId: null,
      },
      participation: {
        participantId: "p-sub-1",
        submissionId: "sub-1",
        inviteStatus: "accepted",
      },
      participationRollup: {
        status: "accepted",
        bySubmission: [{ participantId: "p-sub-1", submissionId: "sub-1", ref: "SES-014", inviteStatus: "accepted" }],
      },
      sessions: [
        {
          submissionId: "sub-1",
          ref: "SES-014",
          title: "Talk 14",
          status: "accepted",
          contentStatus: "approved",
          role: "speaker",
          scheduled: { day: "2026-06-01", startMin: 540, endMin: 600, roomName: "Ballroom A" },
        },
      ],
      tasks: [
        {
          assignmentId: "assign-1",
          taskId: "task-1",
          title: "Task task-1",
          kind: "general",
          required: true,
          dueDate: null,
          status: "pending",
          completedAt: null,
          file: { id: "file-1", filename: "slides.pdf", sizeBytes: 1024, versionNo: 2 },
        },
      ],
      // The fakeDb's WHERE/JOIN no-op means the overdue query (which is
      // driven entirely by SQL conditions on taskAssignment/task/contact —
      // DEC-801's overdueAssignmentConditions) returns every seeded
      // taskAssignment row rather than actually evaluating overdueness; the
      // real predicate is exercised by test/onboarding-late-participant.test.ts
      // and the D1-equivalent grid tests. This test only asserts the shape
      // and that `overdue` is wired from that query's row count.
      counts: { outstandingRequired: 1, overdue: 1 },
      otherEvents: [],
      otherEventsCount: 0,
    });
  });

  it("reads headshotFileId straight off contact.headshot_file_id (DEC-773 amendment, w32-e)", async () => {
    const { db } = fakeDb({
      contact: [contactRow({ headshotUrl: "/headshots/file-abc", headshotFileId: "file-abc" })],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.contact.headshotFileId).toBe("file-abc");
  });

  it("throws loudly when headshotUrl is set but headshotFileId is null (single-home invariant violated)", async () => {
    const { db } = fakeDb({
      contact: [contactRow({ headshotUrl: "/headshots/file-abc", headshotFileId: null })],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
    });
    await expect(getSpeakerDetail(db, EVENT_ID, CONTACT_ID)).rejects.toThrow(/headshotFileId/);
  });

  it("carries phone/notes straight through from the contact row", async () => {
    const { db } = fakeDb({
      contact: [contactRow({ phone: "+1 415 555 0134", notes: "Prefers a morning slot." })],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.contact.phone).toBe("+1 415 555 0134");
    expect(detail?.contact.notes).toBe("Prefers a morning slot.");
  });

  it("reports cross-event history as a count plus up to 5 names, newest event first", async () => {
    const many = [
      otherEventRow("event-2020", "DevFlow 2020", "2020-06-01"),
      otherEventRow("event-2021", "DevFlow 2021", "2021-06-01"),
      otherEventRow("event-2022", "DevFlow 2022", "2022-06-01"),
      otherEventRow("event-2023", "DevFlow 2023", "2023-06-01"),
      otherEventRow("event-2024", "DevFlow 2024", "2024-06-01"),
      otherEventRow("event-2025", "DevFlow 2025", "2025-06-01"),
    ];
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
      submission: many,
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.otherEventsCount).toBe(6);
    expect(detail?.otherEvents).toHaveLength(5);
    expect(detail?.otherEvents.map((e) => e.eventId)).toEqual([
      "event-2025",
      "event-2024",
      "event-2023",
      "event-2022",
      "event-2021",
    ]);
  });

  it("de-duplicates multiple participations on the same other event into one entry", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
      submission: [
        otherEventRow("event-2020", "DevFlow 2020", "2020-06-01"),
        otherEventRow("event-2020", "DevFlow 2020", "2020-06-01"),
      ],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.otherEventsCount).toBe(1);
    expect(detail?.otherEvents).toEqual([{ eventId: "event-2020", name: "DevFlow 2020" }]);
  });

  it("returns a null scheduled slot and null file for a session/task without one", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-2", 1)],
      taskAssignment: [assignmentRow("assign-2", "task-2")],
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.sessions[0]?.scheduled).toBeNull();
    expect(detail?.tasks[0]?.file).toBeNull();
  });

  it("returns null (route 404s) for a contact not on this event's roster", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [], // no participant row for this event's roster
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail).toBeNull();
  });

  it("returns null when the contact does not exist at all", async () => {
    const { db } = fakeDb({ contact: [], event: [eventRow()], participant: [] });
    const detail = await getSpeakerDetail(db, EVENT_ID, "does-not-exist");
    expect(detail).toBeNull();
  });

  it("DEC-936: rolls up a two-participation contact with disagreeing statuses to 'mixed' naming both rows", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [
        participantRow("sub-1", 1, { participantId: "p-1", inviteStatus: "accepted" }),
        participantRow("sub-2", 14, { participantId: "p-2", inviteStatus: "none" }),
      ],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.participationRollup).toEqual({
      status: "mixed",
      bySubmission: [
        { participantId: "p-1", submissionId: "sub-1", ref: "SES-001", inviteStatus: "accepted" },
        { participantId: "p-2", submissionId: "sub-2", ref: "SES-014", inviteStatus: "none" },
      ],
    });
  });

  it("DEC-936: rolls up a two-participation contact with agreeing statuses to that shared status", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [
        participantRow("sub-1", 1, { participantId: "p-1", inviteStatus: "declined" }),
        participantRow("sub-2", 14, { participantId: "p-2", inviteStatus: "declined" }),
      ],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.participationRollup.status).toBe("declined");
    expect(detail?.participationRollup.bySubmission).toHaveLength(2);
  });

  it("issues the same number of queries regardless of session/task count (no per-row query)", async () => {
    const manySessions = Array.from({ length: 12 }, (_, i) => participantRow(`sub-${i}`, i + 1));
    const manyTasks = Array.from({ length: 20 }, (_, i) => assignmentRow(`assign-${i}`, `task-${i}`));

    const { db: smallDb, touchedTables: smallTouched } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
      taskAssignment: [assignmentRow("assign-1", "task-1")],
    });
    await getSpeakerDetail(smallDb, EVENT_ID, CONTACT_ID);

    const { db: bigDb, touchedTables: bigTouched } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: manySessions,
      scheduleSlot: manySessions.map((p) => ({ submissionId: p.submissionId, day: "2026-06-01", startMin: 0, endMin: 60, roomName: null })),
      taskAssignment: manyTasks,
    });
    await getSpeakerDetail(bigDb, EVENT_ID, CONTACT_ID);

    expect(smallTouched.length).toBe(bigTouched.length);
  });
});
