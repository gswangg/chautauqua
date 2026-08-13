// DEC-562: a submission's people and its answers get ONE declared order at
// every surface outside exports (DEC-560, owned elsewhere) and the reviewer
// detail (DEC-561, owned elsewhere).
//
//   - Speakers: (participant.order asc, contact.id asc) — pushed into the
//     SQL ORDER BY everywhere a single query can express it; where DEC-078
//     chunking dissolves the SQL order (list.ts, agenda.ts), the JS
//     re-aggregation sort gains the identical contact-id tiebreak.
//   - Answers: (form_field.position asc, form_field.id asc) — the speaker's
//     own portal submission-detail query.
//
// This file proves the rule twice over: (a) fake-db SQL-shape assertions
// that each touched query names both order columns, by identity, and
// (b) for the two JS sorts, byte-identical output under a shuffled feed.
// It also proves the rule end-to-end: two speakers sharing participant
// order 0 on one submission render in contact-id order on the public
// session detail path (hydrateSessions), given rows arrive in the SQL
// order this task wires in.

import { describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import { hydrateSessions } from "../src/server/repo/public/sessions";
import { getSubmissionDetail } from "../src/server/repo/submissions/detail";
import { getPublicSpeakerDetail } from "../src/server/repo/public/detail";
import { getPortalSubmissionDetail } from "../src/server/repo/portal";
import { listSubmissions } from "../src/server/repo/submissions/list";
import { getAgendaPayload } from "../src/server/repo/agenda";
import { listEventDeliverableFiles } from "../src/server/repo/files-library";

// Generic fake db double: records every chained call (including .orderBy()
// args) per db.select() call, replays queued row sets in call order — the
// same pattern established by test/exports-order.test.ts and
// test/api-submissions.test.ts's makeFakeDb.
function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  const calls: { method: string; args: unknown[] }[][] = [];
  function chain(): any {
    const log: { method: string; args: unknown[] }[] = [];
    calls.push(log);
    const obj: any = {};
    const passthrough = [
      "from",
      "where",
      "innerJoin",
      "leftJoin",
      "orderBy",
      "limit",
      "offset",
      "select",
      "groupBy",
    ];
    for (const m of passthrough) {
      obj[m] = (...args: unknown[]) => {
        log.push({ method: m, args });
        return obj;
      };
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[cursor] ?? [];
      cursor += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { select: () => chain(), selectDistinct: () => chain(), calls } as unknown as AppEnv["Variables"]["db"] & {
    calls: { method: string; args: unknown[] }[][];
  };
}

function orderByArgsOf(db: { calls: { method: string; args: unknown[] }[][] }, callIndex: number): unknown[] {
  const log = db.calls[callIndex];
  if (!log) throw new Error(`no select() call #${callIndex}`);
  const entry = log.find((c) => c.method === "orderBy");
  if (!entry) throw new Error(`select() call #${callIndex} never called .orderBy()`);
  return entry.args;
}

describe("DEC-562: SQL ORDER BY names both columns, by identity", () => {
  it("hydrateSessions speaker query — (participant.order asc, contact.id asc)", async () => {
    const db = makeFakeDb([
      [{ id: "sub-1", seq: 1, title: "T", description: null, icsSequence: 0 }], // subRows
      [], // trackRows
      [], // speakerRows
      [], // slotRows
    ]);
    await hydrateSessions(db, ["sub-1"], { id: "event-1", recordPrefix: "SES", startDate: "2026-01-01", endDate: "2026-01-02" });
    const args = orderByArgsOf(db as any, 2);
    expect(args).toEqual([asc(schema.participant.order), asc(schema.contact.id)]);
  });

  it("getSubmissionDetail participant query — (participant.order asc, contact.id asc)", async () => {
    const db = makeFakeDb([
      [{ id: "sub-1", eventId: "event-1", formId: null, title: "T", description: null, status: "submitted", contentStatus: "unset", trackId: null, additionalTrackIdsJson: null, createdAt: new Date(0), updatedAt: new Date(0), acceptedAt: null, icsSequence: 0, recordPrefix: "SES", seq: 1, timezone: "UTC" }], // submission+event row
      [], // participantRows
      [], // trackRows
      [], // answerRows
    ]);
    await getSubmissionDetail(db, "sub-1");
    const args = orderByArgsOf(db as any, 1);
    expect(args).toEqual([asc(schema.participant.order), asc(schema.contact.id)]);
  });

  it("getPublicSpeakerDetail submission query — (submission.title asc, submission.id asc)", async () => {
    const db = makeFakeDb([[]]); // rows — empty is fine, only the orderBy shape is asserted
    await getPublicSpeakerDetail(db, { id: "event-1", recordPrefix: "SES", startDate: "2026-01-01", endDate: "2026-01-02", timezone: "UTC" } as any, "contact-1");
    const args = orderByArgsOf(db as any, 0);
    expect(args).toEqual([asc(schema.submission.title), asc(schema.submission.id)]);
  });

  it("getPortalSubmissionDetail answer query — (form_field.position asc, form_field.id asc)", async () => {
    const db = makeFakeDb([
      [{ id: "sub-1", seq: 1, title: "T", description: null, status: "pending", createdAt: new Date(0), recordPrefix: "SES", eventOrgId: "org-1", timezone: "UTC" }], // submission+event row
      [], // formatRows (DEC-729) — no session-format answer on this submission
      [{ contactId: "contact-1", inviteStatus: "accepted" }], // participantRows — owns the submission
      [], // answerRows
    ]);
    await getPortalSubmissionDetail(db, "sub-1", "contact-1", "org-1");
    const args = orderByArgsOf(db as any, 3);
    expect(args).toEqual([asc(schema.formField.position), asc(schema.formField.id)]);
  });
});

describe("DEC-562: JS re-aggregation sorts gain the contact-id tiebreak (byte-identical under shuffle)", () => {
  const EVENT_ID = "event-1";

  it("listSubmissions speakers-per-submission — identical output for two feed orders", async () => {
    const submissionRow = {
      id: "sub-1",
      title: "A Talk",
      seq: 1,
      createdAt: new Date(2026, 0, 1),
      updatedAt: new Date(2026, 0, 1),
      eventId: EVENT_ID,
      description: null,
      formId: null,
      trackId: null,
      additionalTrackIdsJson: null,
      status: "submitted",
      contentStatus: "unset",
      acceptedAt: null,
      icsSequence: 0,
    };
    const participantsA = [
      { submissionId: "sub-1", contactId: "c-b", firstName: "Bob", lastName: "B", order: 0 },
      { submissionId: "sub-1", contactId: "c-a", firstName: "Alice", lastName: "A", order: 0 },
    ];
    const participantsB = [...participantsA].reverse();

    async function run(participantRows: unknown[]) {
      const db = makeFakeDb([
        [{ recordPrefix: "SES" }], // 1: event prefix
        [{ count: 1 }], // 2: count
        [submissionRow], // 3: page
        participantRows, // 4: participant enrichment
        [], // 5: track enrichment
        [], // 6: deliverable-count enrichment
        [], // 7: latestFile candidate enrichment (w15-f)
      ]);
      return listSubmissions(db, EVENT_ID, {
        page: 1,
        perPage: 20,
        q: null,
        status: [],
        contentStatus: [],
        trackId: null,
        sort: "newest",
        includeAnswers: false,
      });
    }

    const resultA = await run(participantsA);
    const resultB = await run(participantsB);
    expect(resultA.items[0]!.speakers).toEqual(resultB.items[0]!.speakers);
    expect(resultA.items[0]!.speakers.map((s) => s.contactId)).toEqual(["c-a", "c-b"]);
  });

  it("getAgendaPayload speakers-per-submission — identical output for two feed orders", async () => {
    const submissionRow = { id: "sub-1", seq: 1, title: "Talk 1" };
    const participantsA = [
      { submissionId: "sub-1", contactId: "c-b", firstName: "Bob", lastName: "B", order: 0 },
      { submissionId: "sub-1", contactId: "c-a", firstName: "Alice", lastName: "A", order: 0 },
    ];
    const participantsB = [...participantsA].reverse();
    const event = { orgId: "org-1", startDate: "2026-06-01", endDate: "2026-06-01", recordPrefix: "SES" };

    async function run(participantRows: unknown[]) {
      const db = makeFakeDb([
        [], // rooms
        [], // tracks (event-level)
        [submissionRow], // accepted submissionRows
        [], // trackRows (per-submission)
        participantRows, // participantRows
        [], // slotRows
      ]);
      return getAgendaPayload(db, EVENT_ID, event);
    }

    const payloadA = await run(participantsA);
    const payloadB = await run(participantsB);
    expect(payloadA.unscheduled[0]!.speakers).toEqual(payloadB.unscheduled[0]!.speakers);
    expect(payloadA.unscheduled[0]!.speakers.map((s) => s.contactId)).toEqual(["c-a", "c-b"]);
  });

  it("listEventDeliverableFiles lead-speaker pick — order/contact-id tiebreak is feed-order independent", async () => {
    const pageRow = {
      id: "file-1",
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck.pdf",
      createdAt: new Date(0),
      submissionSeq: 1,
      submissionTitle: "Talk",
    };
    const fileRow = {
      id: "file-1",
      submissionId: "sub-1",
      kind: "presentation",
      filename: "deck.pdf",
      previousFileId: null,
      createdAt: new Date(0),
    };
    const leadCandidatesA = [
      { submissionId: "sub-1", order: 0, contactId: "c-b", firstName: "Bob", lastName: "B" },
      { submissionId: "sub-1", order: 0, contactId: "c-a", firstName: "Alice", lastName: "A" },
    ];
    const leadCandidatesB = [...leadCandidatesA].reverse();

    async function run(leadRows: unknown[]) {
      const db = makeFakeDb([
        [{ recordPrefix: "SES" }], // event prefix
        [pageRow], // ALL matching deliverable chain roots (DEC-773: totalSizeBytes needs every match, not just a page)
        [fileRow], // per-submission file rows (chain resolution)
        [], // ALL matching headshot roots — kinds:[] queries both branches; none seeded here
        leadRows, // lead-speaker candidate rows
      ]);
      return listEventDeliverableFiles(db, EVENT_ID, { page: 1, perPage: 20, kinds: [], q: null });
    }

    const pageA = await run(leadCandidatesA);
    const pageB = await run(leadCandidatesB);
    expect(pageA.items[0]!.speakerName).toBe(pageB.items[0]!.speakerName);
    expect(pageA.items[0]!.speakerName).toBe("Alice A");
  });
});

describe("DEC-562: end-to-end — two speakers sharing participant order 0 render in contact-id order on the public session detail path", () => {
  it("hydrateSessions preserves the SQL-ordered speaker rows (contact.id asc tiebreak) into PublicSession.speakers", async () => {
    const db = makeFakeDb([
      [{ id: "sub-1", seq: 1, title: "T", description: null, icsSequence: 0 }], // subRows
      [], // trackRows
      // speakerRows — as the DB would return them once ordered by
      // (participant.order asc, contact.id asc): both share order 0, so
      // contact "c-a" sorts before "c-b".
      [
        { submissionId: "sub-1", order: 0, contactId: "c-a", firstName: "Alice", lastName: "A", title: null, company: null, headshotUrl: null, bio: null },
        { submissionId: "sub-1", order: 0, contactId: "c-b", firstName: "Bob", lastName: "B", title: null, company: null, headshotUrl: null, bio: null },
      ],
      [], // slotRows
    ]);
    const [session] = await hydrateSessions(db, ["sub-1"], { id: "event-1", recordPrefix: "SES", startDate: "2026-01-01", endDate: "2026-01-02" });
    expect(session!.speakers.map((s) => s.contactId)).toEqual(["c-a", "c-b"]);
  });
});
