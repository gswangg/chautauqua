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
  emailLog?: unknown[];
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
    // Design pack v12 (wave 118 amendment): getSpeakerDetail now issues one
    // plain select+where over email_log (fetchReminderSendInstants,
    // task-view.ts) -- no join, no groupBy, so this double's existing
    // no-op WHERE/JOIN convention (seed exactly the rows the real WHERE
    // would leave) applies unchanged.
    emailLog: [...(seed.emailLog ?? [])] as any[],
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
    if (table === schema.emailLog) return state.emailLog;
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
    bio: null,
    socialLinksJson: null,
    userId: null,
    ...opts,
  };
}

function otherEventRow(
  eventId: string,
  name: string,
  startDate: string,
  opts: { submissionTitle?: string; submissionStatus?: string } = {},
) {
  return { eventId, eventName: name, eventStartDate: startDate, ...opts };
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
    // The overdue query selects task_assignment.id (aliased `id`), while the
    // task join selects it as `assignmentId` — one seeded row stands in for
    // both projections so the per-row overdue flag's id match is exercised
    // rather than silently matching nothing.
    id: assignmentId,
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
    // DEC-930 (amendment, wave 115): every Files row names its uploader and
    // its timestamp, so the join now carries both off schema.file.
    fileUploadedAt: null,
    fileUploadedByContactId: null,
    // Design pack v12 (wave 118 amendment): the per-task remindCount is
    // windowed by [createdAt, completedAt) -- a real Date, since the row
    // this stands in for is a genuine timestamp_ms column.
    createdAt: new Date(0),
    ...opts,
  };
}

function emailLogRow(sentAt: number) {
  // Design pack v12 (wave 118 amendment): fetchReminderSendInstants selects
  // only sentAt (task-view.ts) -- a real Date, matching the real
  // timestamp_ms column's returned type.
  return { sentAt: new Date(sentAt) };
}

const UPLOADED_AT = Date.UTC(2026, 3, 8, 14, 5);

describe("DEC-930 getSpeakerDetail", () => {
  it("returns the exact payload shape for a roster contact with a session and a task", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 14)],
      scheduleSlot: [{ submissionId: "sub-1", day: "2026-06-01", startMin: 540, endMin: 600, roomName: "Ballroom A" }],
      taskAssignment: [
        assignmentRow("assign-1", "task-1", {
          fileId: "file-1",
          fileName: "slides.pdf",
          fileSizeBytes: 1024,
          fileVersionNo: 2,
          fileUploadedAt: new Date(UPLOADED_AT),
          fileUploadedByContactId: CONTACT_ID,
        }),
      ],
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
        bio: null,
        socialLinks: [],
      },
      // DEC-930 (amendment, wave 115): no headshot on this contact, so no
      // file row is read for one and the Files section has nothing to add.
      headshotFile: null,
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
          file: {
            id: "file-1",
            filename: "slides.pdf",
            sizeBytes: 1024,
            versionNo: 2,
            // DEC-930 (amendment, wave 115): the speaker uploaded it, so the
            // uploader resolves from the contact row already in hand -- no
            // extra query is issued for the speaker themselves.
            uploadedAt: UPLOADED_AT,
            uploaderName: "Ada Lovelace",
          },
          // Design pack v12: the detail's Remind link states this speaker's
          // reminder history for THIS task. null = never reminded, which is
          // the only reminder fact the schema records per assignment (there
          // is no per-task send COUNT anywhere).
          lastRemindedAt: null,
          // User-filed (speaker detail): lateness now rides on the ROW, from
          // the same overdue query the counts line below is read from — this
          // fakeDb's no-op WHERE makes that query return every seeded
          // assignment, so the flag and the count of 1 are the same fact.
          overdue: true,
          // Design pack v12 (wave 118 amendment): no email_log rows seeded,
          // so never reminded.
          remindCount: 0,
        },
      ],
      // The fakeDb's WHERE/JOIN no-op means the overdue query (which is
      // driven entirely by SQL conditions on taskAssignment/task/contact —
      // DEC-801's overdueAssignmentConditions) returns every seeded
      // taskAssignment row rather than actually evaluating overdueness; the
      // real predicate is exercised by test/onboarding-late-participant.test.ts
      // and the D1-equivalent grid tests. This test only asserts the shape
      // and that `overdue` is wired from that query's row count.
      counts: { outstandingRequired: 1, overdue: 1, remindCount: 0 },
      otherEvents: [],
      otherEventsCount: 0,
    });
  });

  // User-filed (speaker detail, "1 OVERDUE" with no row marked): the header
  // count and the rows beneath it are read from the ONE overdue query, so
  // the number of rows flagged overdue is the count — never a count the
  // reader cannot point at.
  it("flags overdue per task from the same query the overdue count is read from", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 14)],
      taskAssignment: [assignmentRow("assign-1", "task-1"), assignmentRow("assign-2", "task-2")],
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail!.tasks.filter((t) => t.overdue)).toHaveLength(detail!.counts.overdue);
    expect(detail!.tasks.map((t) => t.assignmentId)).toEqual(["assign-1", "assign-2"]);
  });

  // Design pack v12 (wave 118 amendment): the per-task remindCount is
  // windowed by [createdAt, completedAt); the header's person-level
  // counts.remindCount is the raw count of qualifying sends, unwindowed --
  // one email naming two outstanding tasks must not double-count.
  it("wave 118: derives remindCount per task (windowed) and person-level (unwindowed, un-summed)", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 14)],
      taskAssignment: [
        assignmentRow("assign-1", "task-1", { createdAt: new Date(Date.UTC(2026, 0, 1)), completedAt: null }),
        assignmentRow("assign-2", "task-2", { createdAt: new Date(Date.UTC(2026, 0, 1)), completedAt: null }),
      ],
      emailLog: [
        // Both sends land inside both assignments' still-open windows --
        // one email named both outstanding tasks.
        emailLogRow(Date.UTC(2026, 1, 1)),
        emailLogRow(Date.UTC(2026, 1, 15)),
      ],
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail!.tasks.find((t) => t.assignmentId === "assign-1")!.remindCount).toBe(2);
    expect(detail!.tasks.find((t) => t.assignmentId === "assign-2")!.remindCount).toBe(2);
    // Person-level total is 2 (the two real sends), never 4 (2 tasks x 2
    // sends) -- summing the per-task counts would double-count one email.
    expect(detail!.counts.remindCount).toBe(2);
  });

  it("wave 118: a send before an assignment's createdAt window doesn't count toward that task", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 14)],
      taskAssignment: [assignmentRow("assign-1", "task-1", { createdAt: new Date(Date.UTC(2026, 5, 1)), completedAt: null })],
      emailLog: [emailLogRow(Date.UTC(2026, 0, 1))], // before the assignment existed
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail!.tasks[0]!.remindCount).toBe(0);
    // But the person-level total still counts it -- it's a real send on
    // this event to this contact, unwindowed.
    expect(detail!.counts.remindCount).toBe(1);
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
    // DEC-829 (wave-110 amendment): the rail row now carries a second line,
    // `participation`, derived from the SAME grouped submission row. These
    // fixture rows carry no submissionStatus, i.e. no decided outcome, so
    // the amendment's "rather than inventing a line for an undecided
    // outcome" clause makes it null -- the dedup itself is what this it()
    // pins, and it still collapses two rows to one.
    expect(detail?.otherEvents).toEqual([{ eventId: "event-2020", name: "DevFlow 2020", participation: null }]);
  });

  it("pins the positive participation line: an accepted other-event submission yields 'Spoke · <title>'", async () => {
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
      submission: [
        otherEventRow("event-2020", "DevFlow 2020", "2020-06-01", {
          submissionTitle: "Scaling Postgres",
          submissionStatus: "accepted",
        }),
      ],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.otherEvents).toEqual([
      { eventId: "event-2020", name: "DevFlow 2020", participation: "Spoke · Scaling Postgres" },
    ]);
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

  // DEC-738 amendment (wave 75): the bio and social links the speaker wrote
  // through their portal profile (repo/profile.ts's updateProfile) are
  // projected onto the same organizer-facing SpeakerDetailContact the CRM
  // logistics fields already live on -- built the SAME way
  // repo/public/detail.ts's getPublicSpeakerDetail does (parseSocialLinks +
  // safeExternalUrl, fixed label order), dropping any unsafe URL.
  it("DEC-738: projects the portal-written bio and social links, dropping an unsafe URL", async () => {
    const { db } = fakeDb({
      contact: [
        contactRow({
          bio: "PORTAL_BIO_SENTINEL: writes optimizing compilers for analytical engines.",
          socialLinksJson: JSON.stringify({
            twitter: "https://twitter.com/ada",
            linkedin: "javascript:alert(1)", // unsafe -- dropped
            github: "https://github.com/ada",
            website: "",
          }),
        }),
      ],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
    });

    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail?.contact.bio).toBe("PORTAL_BIO_SENTINEL: writes optimizing compilers for analytical engines.");
    expect(detail?.contact.socialLinks).toEqual([
      { label: "Twitter", url: "https://twitter.com/ada" },
      { label: "GitHub", url: "https://github.com/ada" },
    ]);
  });

  // A DECLARED KNOB/SETTING WITH NO READER IS A LIE (DEC-851 field guide):
  // enumerate every field updateProfile (repo/profile.ts) writes to the
  // portal-writable contact record and assert each has a reader on the
  // SpeakerDetailContact contract, so the next portal-writable field can't
  // be added here without a reader on the organizer's speaker record.
  it("ledger: every field updateProfile writes has a reader on SpeakerDetailContact", async () => {
    // updateProfile's UpdateProfileInput (repo/profile.ts) writes exactly
    // these contact fields; headshot is written separately by
    // setContactHeadshot but is still a portal-writable field on the same
    // contact record.
    const updateProfileWrittenFields = ["bio", "socialLinks", "title", "company", "headshot"] as const;
    const speakerDetailContactReaders: Record<(typeof updateProfileWrittenFields)[number], string> = {
      bio: "bio",
      socialLinks: "socialLinks",
      title: "title",
      company: "company",
      headshot: "headshotFileId",
    };
    const { db } = fakeDb({
      contact: [contactRow()],
      event: [eventRow()],
      participant: [participantRow("sub-1", 1)],
    });
    const detail = await getSpeakerDetail(db, EVENT_ID, CONTACT_ID);
    expect(detail).not.toBeNull();
    for (const field of updateProfileWrittenFields) {
      const readerKey = speakerDetailContactReaders[field];
      expect(Object.prototype.hasOwnProperty.call(detail!.contact, readerKey)).toBe(true);
    }
  });
});
