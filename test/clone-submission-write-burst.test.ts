// DEC-542: cloneSubmission's per-row insert loops (submission_track,
// submission_answer, participant) are now set-based via chunkRowsForInsert
// — one insert statement per child table (given the batch fits one chunk),
// not one per copied row. Fake-db pattern follows
// test/clone-participants.test.ts (no real-D1/sqlite harness in this repo —
// DEC-266); insert(table).values() is extended to accept either a single
// row object or an array of rows, since chunkRowsForInsert now emits arrays.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { cloneSubmission } from "../src/server/repo/submissions/create";
import { MAX_D1_BOUND_PARAMS } from "../src/lib/chunk";
import type { Db } from "../src/server/context";

// DEC-528's chunkRowsForInsert derives rows-per-chunk from columns-per-row
// (see src/lib/chunk.ts), not a fixed row count — mirror that formula here
// (same pattern as test/acceptance-write-burst.test.ts) rather than
// hardcoding "fits in one chunk", since it doesn't for every table: a
// submission_track copy row has 3 columns (submissionId, trackId,
// createdAt), a submission_answer copy row has 6 (id, submissionId,
// formFieldId, valueJson, createdAt, updatedAt), and a participant copy row
// has 11 (id, submissionId, contactId, role, order, visible, inviteStatus,
// titleAtTime, orgAtTime, createdAt, updatedAt).
function rowsPerChunk(columns: number): number {
  return Math.max(1, Math.floor((MAX_D1_BOUND_PARAMS - 10) / columns));
}
const TRACK_ROWS_PER_CHUNK = rowsPerChunk(3);
const ANSWER_ROWS_PER_CHUNK = rowsPerChunk(6);
const PARTICIPANT_ROWS_PER_CHUNK = rowsPerChunk(11);

function thenable<T>(rows: T[]) {
  return {
    limit(n: number) {
      return Promise.resolve(rows.slice(0, n));
    },
    then(onFulfilled: (v: T[]) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
}

interface Seed {
  submission: { id: string; eventId: string; formId: string | null; title: string; description: string | null; trackId: string | null };
  tracks: Array<{ trackId: string }>;
  answers: Array<{ formFieldId: string; valueJson: string }>;
  participants: Array<{
    id: string;
    contactId: string;
    role: string;
    order: number;
    visible: boolean;
    inviteStatus: string;
    titleAtTime: string | null;
    orgAtTime: string | null;
  }>;
}

function fakeDb(seed: Seed) {
  // Each recorded "call" is one insert(table).values(...) invocation; `rows`
  // is always normalized to an array so call-count and row-content can both
  // be asserted regardless of whether the production code passed a single
  // object (old behavior) or an array (new, chunked behavior).
  const calls: Array<{ table: unknown; rows: unknown[] }> = [];

  const db = {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond?: unknown) {
              if (table === schema.submission) return thenable([seed.submission]);
              if (table === schema.submissionTrack) return thenable(seed.tracks);
              if (table === schema.submissionAnswer) return thenable(seed.answers);
              if (table === schema.participant) return thenable(seed.participants);
              if (table === schema.formField) return thenable([]);
              throw new Error(`fakeDb: unexpected table in select().from(): ${String(table)}`);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: unknown) {
          const rows = Array.isArray(values) ? values : [values];
          calls.push({ table, rows });
          return Promise.resolve(undefined);
        },
      };
    },
  };

  return { db: db as unknown as Db, calls };
}

function callsFor(calls: Array<{ table: unknown; rows: unknown[] }>, table: unknown) {
  return calls.filter((c) => c.table === table);
}

describe("DEC-542: cloneSubmission is a set-based copy", () => {
  it("issues one insert per child table when the batch fits one chunk (tracks/participants here), and far fewer than 31 total statements, with byte-equal content to the old per-row shape", async () => {
    const tracks = Array.from({ length: 3 }, (_, i) => ({ trackId: `track-${i}` }));
    const answers = Array.from({ length: 25 }, (_, i) => ({ formFieldId: `field-${i}`, valueJson: `"answer-${i}"` }));
    const participants = Array.from({ length: 3 }, (_, i) => ({
      id: `p-${i}`,
      contactId: `contact-${i}`,
      role: i === 0 ? "moderator" : "speaker",
      order: i,
      visible: i % 2 === 0,
      inviteStatus: i === 0 ? "accepted" : "none",
      titleAtTime: `Title ${i}`,
      orgAtTime: `Org ${i}`,
    }));

    const { db, calls } = fakeDb({
      submission: { id: "sub-1", eventId: "event-1", formId: "form-1", title: "Talk", description: "desc", trackId: "track-0" },
      tracks,
      answers,
      participants,
    });

    const { id: newSubmissionId } = await cloneSubmission(db, "sub-1");

    const trackCalls = callsFor(calls, schema.submissionTrack);
    const answerCalls = callsFor(calls, schema.submissionAnswer);
    const participantCalls = callsFor(calls, schema.participant);

    // Tracks (3 rows) and participants (3 rows) each fit inside a single
    // chunk (30 and 8 rows-per-chunk respectively) -> one insert() call.
    // Answers (25 rows, 15 rows-per-chunk) need 2 chunks -> two insert()
    // calls. In every case, far fewer statements than the old one-per-row
    // loop (31 total row inserts).
    expect(trackCalls).toHaveLength(Math.ceil(tracks.length / TRACK_ROWS_PER_CHUNK));
    expect(trackCalls).toHaveLength(1);
    expect(answerCalls).toHaveLength(Math.ceil(answers.length / ANSWER_ROWS_PER_CHUNK));
    expect(participantCalls).toHaveLength(Math.ceil(participants.length / PARTICIPANT_ROWS_PER_CHUNK));
    expect(participantCalls).toHaveLength(1);
    const totalInsertStatements = trackCalls.length + answerCalls.length + participantCalls.length;
    expect(totalInsertStatements).toBeLessThan(31);
    const totalRows =
      trackCalls.reduce((s, c) => s + c.rows.length, 0) +
      answerCalls.reduce((s, c) => s + c.rows.length, 0) +
      participantCalls.reduce((s, c) => s + c.rows.length, 0);
    expect(totalRows).toBe(31);

    // submission_track rows: { submissionId, trackId, createdAt } — no id.
    const gotTracks = trackCalls[0]!.rows as Array<{ submissionId: string; trackId: string; createdAt: Date }>;
    expect(gotTracks.map((r) => "id" in r)).toEqual([false, false, false]);
    expect(gotTracks.map((r) => r.trackId)).toEqual(tracks.map((t) => t.trackId));
    for (const r of gotTracks) expect(r.submissionId).toBe(newSubmissionId);

    // submission_answer rows carry formFieldId/valueJson through unchanged,
    // each with a fresh id. Flatten across chunks (answers span 2 insert
    // calls) — order is preserved end-to-end since chunkRowsForInsert only
    // slices, never reorders.
    const gotAnswers = answerCalls.flatMap((c) => c.rows) as Array<{
      id: string;
      submissionId: string;
      formFieldId: string;
      valueJson: string;
    }>;
    expect(gotAnswers.map((r) => ({ formFieldId: r.formFieldId, valueJson: r.valueJson }))).toEqual(
      answers.map((a) => ({ formFieldId: a.formFieldId, valueJson: a.valueJson })),
    );
    const answerIds = new Set(gotAnswers.map((r) => r.id));
    expect(answerIds.size).toBe(25); // every row got a fresh, distinct id
    for (const r of gotAnswers) expect(r.submissionId).toBe(newSubmissionId);

    // participant rows: inviteStatus reset to 'none', titleAtTime/orgAtTime
    // carried through unchanged, fresh id per row.
    const gotParticipants = participantCalls[0]!.rows as Array<{
      id: string;
      submissionId: string;
      contactId: string;
      role: string;
      order: number;
      visible: boolean;
      inviteStatus: string;
      titleAtTime: string | null;
      orgAtTime: string | null;
    }>;
    expect(
      gotParticipants.map((r) => ({
        contactId: r.contactId,
        role: r.role,
        order: r.order,
        visible: r.visible,
        inviteStatus: r.inviteStatus,
        titleAtTime: r.titleAtTime,
        orgAtTime: r.orgAtTime,
      })),
    ).toEqual(
      participants.map((p) => ({
        contactId: p.contactId,
        role: p.role,
        order: p.order,
        visible: p.visible,
        inviteStatus: "none",
        titleAtTime: p.titleAtTime,
        orgAtTime: p.orgAtTime,
      })),
    );
    const participantIds = new Set(gotParticipants.map((r) => r.id));
    expect(participantIds.size).toBe(3);
    for (const r of gotParticipants) expect(r.submissionId).toBe(newSubmissionId);
  });

  it("issues zero child-table inserts for a submission with no tracks, answers, or active participants", async () => {
    const { db, calls } = fakeDb({
      submission: { id: "sub-2", eventId: "event-1", formId: null, title: "Empty Talk", description: null, trackId: null },
      tracks: [],
      answers: [],
      participants: [
        { id: "p-inv", contactId: "contact-inv", role: "speaker", order: 0, visible: true, inviteStatus: "invited", titleAtTime: null, orgAtTime: null },
      ],
    });

    await cloneSubmission(db, "sub-2");

    expect(callsFor(calls, schema.submissionTrack)).toHaveLength(0);
    expect(callsFor(calls, schema.submissionAnswer)).toHaveLength(0);
    expect(callsFor(calls, schema.participant)).toHaveLength(0);
  });
});
