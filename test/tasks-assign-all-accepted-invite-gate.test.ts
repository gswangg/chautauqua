// DEC-283: closes the DEC-278 twin gate on the task-creation roster
// expansion. ensureOnboardingTasks (src/server/repo/submissions/status.ts)
// already filters a submission's participants through isActiveParticipant,
// but listAcceptedContactIds (src/server/repo/tasks.ts) — the function
// createTask's assignToAllAccepted expansion uses — had no such filter, so
// the first event-wide task a producer created re-added a declined/invited
// co-speaker to the onboarding grid. Uses the same in-memory table-double
// fakeDb pattern as test/onboarding-late-participant.test.ts /
// test/tasks-assign-org-scope.test.ts (no real-D1 harness in stage 1, per
// DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { createTask, listAcceptedContactIds } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

function fakeDb(seed: { participant?: unknown[]; submission?: unknown[]; task?: unknown[]; taskAssignment?: unknown[] }) {
  const state = {
    participant: [...(seed.participant ?? [])] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    task: [...(seed.task ?? [])] as any[],
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.participant) return state.participant;
    if (table === schema.submission) return state.submission;
    if (table === schema.task) return state.task;
    if (table === schema.taskAssignment) return state.taskAssignment;
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
      from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
    }),
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        const arr = stateArrayFor(table);
        if (arr) arr.push({ ...(vals as object) });
      },
    }),
  };
  return { db: db as unknown as Db, state };
}

const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-1";

function participantRow(contactId: string, inviteStatus: string) {
  return { id: `p-${contactId}`, submissionId: SUBMISSION_ID, contactId, inviteStatus };
}

function acceptedSubmission() {
  return { id: SUBMISSION_ID, eventId: EVENT_ID, status: "accepted" };
}

describe("DEC-283: listAcceptedContactIds excludes invited/declined co-speakers", () => {
  it("returns only 'none'/'accepted' contact ids, deduped and order-preserving", async () => {
    const { db } = fakeDb({
      submission: [acceptedSubmission()],
      participant: [
        participantRow("contact-none", "none"),
        participantRow("contact-accepted", "accepted"),
        participantRow("contact-invited", "invited"),
        participantRow("contact-declined", "declined"),
        // a duplicate participant row for contact-none (e.g. a second
        // submission) to prove dedup still applies after filtering.
        { id: "p-contact-none-2", submissionId: "sub-2", contactId: "contact-none", inviteStatus: "none" },
      ],
    });

    const ids = await listAcceptedContactIds(db, EVENT_ID);

    expect(ids).toEqual(["contact-none", "contact-accepted"]);
  });

  it("createTask({assignToAllAccepted:true}) inserts task_assignment rows for exactly the active contacts", async () => {
    const { db, state } = fakeDb({
      submission: [acceptedSubmission()],
      participant: [
        participantRow("contact-none", "none"),
        participantRow("contact-accepted", "accepted"),
        participantRow("contact-invited", "invited"),
        participantRow("contact-declined", "declined"),
      ],
      task: [],
    });

    const record = await createTask(db, EVENT_ID, {
      kind: "general",
      title: "Announce participation",
      required: false,
      assignToAllAccepted: true,
    });

    expect(record.id).toBeTruthy();
    // createTask re-reads schema.task after insert; the fakeDb `from`
    // returns whatever is currently in state.task, so seed it via the
    // insert path itself (already exercised above) — assert on
    // taskAssignment instead, which is what this gate protects.
    const assignedContactIds = new Set(state.taskAssignment.map((a: any) => a.contactId));
    expect(assignedContactIds.has("contact-none")).toBe(true);
    expect(assignedContactIds.has("contact-accepted")).toBe(true);
    expect(assignedContactIds.has("contact-invited")).toBe(false);
    expect(assignedContactIds.has("contact-declined")).toBe(false);
    expect(state.taskAssignment.length).toBe(2);
  });

  it("an all-declined roster inserts zero assignments and still returns the created TaskRecord", async () => {
    const { db, state } = fakeDb({
      submission: [acceptedSubmission()],
      participant: [participantRow("contact-declined-1", "declined"), participantRow("contact-invited-1", "invited")],
      task: [],
    });

    const record = await createTask(db, EVENT_ID, {
      kind: "general",
      title: "Finalize talk description",
      required: false,
      assignToAllAccepted: true,
    });

    expect(record).toMatchObject({
      eventId: EVENT_ID,
      kind: "general",
      title: "Finalize talk description",
      required: false,
    });
    expect(state.taskAssignment.length).toBe(0);
  });
});
