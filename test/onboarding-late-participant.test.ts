// DEC-278: a participant added to (or accepting an invitation on) an
// ALREADY-'accepted' submission must still get onboarding tasks planned —
// previously runAcceptancePlanning only ever fired once, inside
// updateSubmissionStatuses' fireAcceptance branch, and planned for EVERY
// participant regardless of invite state. This exercises the renamed/
// exported ensureOnboardingTasks (src/server/repo/submissions/status.ts)
// directly, using the in-memory table-double fakeDb pattern from
// test/contacts-add-to-event.test.ts / test/spec9-invariants.test.ts (no
// real-D1 harness exists in stage 1 per DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { ensureOnboardingTasks, getSubmissionStatusForParticipant } from "../src/server/repo/submissions";
import { DEFAULT_ONBOARDING_TASKS, isActiveParticipant } from "../src/domain/acceptance";
import type { Db } from "../src/server/context";

/** Table-identity-aware in-memory double. WHERE/JOIN conditions are ignored
 * (every table here only ever holds rows relevant to the single
 * event/submission/participants under test) — same simplification as
 * test/contacts-add-to-event.test.ts's fakeDb. Rows are denormalized so a
 * projection reading a joined column (e.g. orgId, eventId, status) finds it
 * directly on the base row. */
function fakeDb(seed: {
  participant?: unknown[];
  submission?: unknown[];
  task?: unknown[];
  taskAssignment?: unknown[];
  form?: unknown[];
  formField?: unknown[];
  event?: unknown[];
}) {
  const state = {
    participant: [...(seed.participant ?? [])] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    task: [...(seed.task ?? [])] as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    form: [...(seed.form ?? [])] as any[],
    formField: [...(seed.formField ?? [])] as any[],
    emailLog: [] as any[],
    event: [...(seed.event ?? [{ id: "event-1", startDate: "2026-06-01" }])] as any[],
  };
  const touchedTables: unknown[] = [];

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.participant) return state.participant;
    if (table === schema.submission) return state.submission;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.form) return state.form;
    if (table === schema.formField) return state.formField;
    if (table === schema.emailLog) return state.emailLog;
    if (table === schema.event) return state.event;
    return undefined;
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: () => chain,
      limit: () => chain,
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
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        for (const row of rows) {
          touchedTables.push(table);
          const arr = stateArrayFor(table);
          if (arr) arr.push({ ...(row as object) });
        }
      },
    }),
    update: (table: unknown) => ({
      set: (setVals: unknown) => ({
        where: async () => {
          touchedTables.push(table);
          const arr = stateArrayFor(table);
          if (arr && arr[0]) Object.assign(arr[0], setVals as object);
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state, touchedTables };
}

const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-1";

function participantRow(contactId: string, inviteStatus: string) {
  return {
    id: `p-${contactId}`,
    submissionId: SUBMISSION_ID,
    contactId,
    inviteStatus,
    visible: true,
    orgId: "org-a",
    eventId: EVENT_ID,
    status: "accepted",
  };
}

describe("DEC-278 ensureOnboardingTasks plans only for active participants", () => {
  it("plans for 'none' and 'accepted' participants, not 'invited'/'declined' (contactIds=null path)", async () => {
    const { db, state } = fakeDb({
      participant: [
        participantRow("contact-none", "none"),
        participantRow("contact-accepted", "accepted"),
        participantRow("contact-invited", "invited"),
        participantRow("contact-declined", "declined"),
      ],
    });

    await ensureOnboardingTasks(db, EVENT_ID, SUBMISSION_ID, null, new Date());

    const plannedContactIds = new Set(state.taskAssignment.map((a: any) => a.contactId));
    expect(plannedContactIds.has("contact-none")).toBe(true);
    expect(plannedContactIds.has("contact-accepted")).toBe(true);
    expect(plannedContactIds.has("contact-invited")).toBe(false);
    expect(plannedContactIds.has("contact-declined")).toBe(false);

    // Every default onboarding task got assigned to both active contacts.
    expect(state.taskAssignment.filter((a: any) => a.contactId === "contact-none").length).toBe(
      DEFAULT_ONBOARDING_TASKS.length,
    );
    expect(state.taskAssignment.filter((a: any) => a.contactId === "contact-accepted").length).toBe(
      DEFAULT_ONBOARDING_TASKS.length,
    );
  });

  it("isActiveParticipant matches exactly the DEC-274 SQL twin literals", () => {
    expect(isActiveParticipant("none")).toBe(true);
    expect(isActiveParticipant("accepted")).toBe(true);
    expect(isActiveParticipant("invited")).toBe(false);
    expect(isActiveParticipant("declined")).toBe(false);
  });

  it("zero eligible participants is a silent no-op", async () => {
    const { db, state } = fakeDb({ participant: [participantRow("contact-invited", "invited")] });
    await ensureOnboardingTasks(db, EVENT_ID, SUBMISSION_ID, null, new Date());
    expect(state.taskAssignment.length).toBe(0);
    expect(state.task.length).toBe(0);
  });
});

describe("DEC-278 late participant on an already-accepted submission", () => {
  it("a portal invite-accept (contactIds=[contactId] path) inserts task_assignment rows for that contact", async () => {
    const { db, state } = fakeDb({
      participant: [participantRow("contact-late", "invited")],
      submission: [{ id: SUBMISSION_ID, eventId: EVENT_ID, status: "accepted" }],
    });

    // Mirrors the portal route: setInviteStatus already ran (invite_status
    // now 'accepted'), then the handler resolves the submission's status
    // and, finding it already 'accepted', plans directly for this contact.
    state.participant[0].inviteStatus = "accepted";

    const info = await getSubmissionStatusForParticipant(db, "p-contact-late");
    expect(info).not.toBeNull();
    expect(info!.status).toBe("accepted");

    await ensureOnboardingTasks(db, info!.eventId, info!.submissionId, ["contact-late"], new Date());

    const assignments = state.taskAssignment.filter((a: any) => a.contactId === "contact-late");
    expect(assignments.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
  });

  it("organizer add-participant path (contactIds=[contactId]) also plans for a late-added contact", async () => {
    const { db, state } = fakeDb({});
    await ensureOnboardingTasks(db, EVENT_ID, SUBMISSION_ID, ["contact-organizer-added"], new Date());
    const assignments = state.taskAssignment.filter((a: any) => a.contactId === "contact-organizer-added");
    expect(assignments.length).toBe(DEFAULT_ONBOARDING_TASKS.length);
  });
});

describe("DEC-278 / DEC-009: neither planning path ever touches email_log", () => {
  it("ensureOnboardingTasks(null) never reads/writes schema.emailLog", async () => {
    const { db, state, touchedTables } = fakeDb({
      participant: [participantRow("contact-a", "none")],
    });
    await ensureOnboardingTasks(db, EVENT_ID, SUBMISSION_ID, null, new Date());
    expect(touchedTables).not.toContain(schema.emailLog);
    expect(state.emailLog.length).toBe(0);
  });

  it("ensureOnboardingTasks([contactId]) never reads/writes schema.emailLog", async () => {
    const { db, state, touchedTables } = fakeDb({});
    await ensureOnboardingTasks(db, EVENT_ID, SUBMISSION_ID, ["contact-b"], new Date());
    expect(touchedTables).not.toContain(schema.emailLog);
    expect(state.emailLog.length).toBe(0);
  });
});
