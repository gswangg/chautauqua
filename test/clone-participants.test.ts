// DEC-275: cloneSubmission must copy ACTIVE (invite_status 'none'|'accepted')
// participant rows into the clone with invite_status reset to 'none', and
// must never invite/declined-copy nor touch file/evaluation/schedule_slot.
//
// Fake-db pattern follows test/spec9-invariants.test.ts (there is no
// real-D1/sqlite harness in this repo — DEC-266). select().from(table) is
// mapped to canned rows keyed by table identity; where()/limit() are
// thenable stand-ins. insert(table) records the table object and the
// values passed to .values() so assertions can check both "was this table
// ever inserted into" and "what did it get".

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { cloneSubmission } from "../src/server/repo/submissions/create";
import type { Db } from "../src/server/context";

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

function fakeDb(opts: {
  submission: { id: string; eventId: string; formId: string | null; title: string; description: string | null; trackId: string | null };
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
}) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];

  // The real select chain is select(...).from(table).where(cond)[.limit(n)].
  // `select`'s projection argument is irrelevant here — rows are canned by
  // table identity, matching what cloneSubmission actually queries.
  const db = {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond?: unknown) {
              if (table === schema.submission) return thenable([opts.submission]);
              if (table === schema.submissionTrack) return thenable([{ trackId: "track-1" }]);
              if (table === schema.submissionAnswer) return thenable([{ formFieldId: "field-1", valueJson: '"answer"' }]);
              if (table === schema.participant) return thenable(opts.participants);
              throw new Error(`fakeDb: unexpected table in select().from(): ${String(table)}`);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: unknown) {
          // DEC-542: cloneSubmission's child-table inserts are now
          // chunked/set-based (chunkRowsForInsert), so .values() may
          // receive an array of rows in one call rather than one row per
          // call. Flatten to one `inserts` entry per row so downstream
          // per-row assertions in this file stay valid regardless of how
          // many rows landed in a single insert statement.
          const rows = Array.isArray(values) ? values : [values];
          for (const row of rows) inserts.push({ table, values: row });
          return Promise.resolve(undefined);
        },
      };
    },
  };

  return { db: db as unknown as Db, inserts };
}

describe("DEC-275: cloneSubmission copies active participants", () => {
  it("copies 'none' and 'accepted' participants with invite_status reset to 'none', skips 'invited'/'declined', and copies tracks/answers but never file/evaluation/scheduleSlot", async () => {
    const { db, inserts } = fakeDb({
      submission: {
        id: "sub-1",
        eventId: "event-1",
        formId: "form-1",
        title: "Original Talk",
        description: "desc",
        trackId: "track-1",
      },
      participants: [
        {
          id: "p-none",
          contactId: "contact-none",
          role: "speaker",
          order: 0,
          visible: true,
          inviteStatus: "none",
          titleAtTime: "Dr.",
          orgAtTime: "Acme",
        },
        {
          id: "p-accepted",
          contactId: "contact-accepted",
          role: "moderator",
          order: 1,
          visible: false,
          inviteStatus: "accepted",
          titleAtTime: null,
          orgAtTime: null,
        },
        {
          id: "p-invited",
          contactId: "contact-invited",
          role: "speaker",
          order: 2,
          visible: true,
          inviteStatus: "invited",
          titleAtTime: "Should not copy",
          orgAtTime: "Should not copy",
        },
        {
          id: "p-declined",
          contactId: "contact-declined",
          role: "speaker",
          order: 3,
          visible: true,
          inviteStatus: "declined",
          titleAtTime: "Should not copy either",
          orgAtTime: "Should not copy either",
        },
      ],
    });

    const newId = await cloneSubmission(db, "sub-1");
    expect(newId).toBeTruthy();

    const participantInserts = inserts.filter((i) => i.table === schema.participant) as Array<{
      table: unknown;
      values: { contactId: string; inviteStatus: string; role: string; order: number; visible: boolean; titleAtTime: string | null; orgAtTime: string | null; submissionId: string };
    }>;

    expect(participantInserts).toHaveLength(2);

    const contactIds = participantInserts.map((i) => i.values.contactId);
    expect(contactIds).toContain("contact-none");
    expect(contactIds).toContain("contact-accepted");
    expect(contactIds).not.toContain("contact-invited");
    expect(contactIds).not.toContain("contact-declined");

    for (const ins of participantInserts) {
      expect(ins.values.inviteStatus).toBe("none");
      expect(ins.values.submissionId).toBe(newId);
    }

    const noneCopy = participantInserts.find((i) => i.values.contactId === "contact-none")!;
    expect(noneCopy.values.role).toBe("speaker");
    expect(noneCopy.values.order).toBe(0);
    expect(noneCopy.values.visible).toBe(true);
    expect(noneCopy.values.titleAtTime).toBe("Dr.");
    expect(noneCopy.values.orgAtTime).toBe("Acme");

    const acceptedCopy = participantInserts.find((i) => i.values.contactId === "contact-accepted")!;
    expect(acceptedCopy.values.role).toBe("moderator");
    expect(acceptedCopy.values.order).toBe(1);
    expect(acceptedCopy.values.visible).toBe(false);
    expect(acceptedCopy.values.titleAtTime).toBeNull();
    expect(acceptedCopy.values.orgAtTime).toBeNull();

    // submission_track and submission_answer copying still happens.
    expect(inserts.some((i) => i.table === schema.submissionTrack)).toBe(true);
    expect(inserts.some((i) => i.table === schema.submissionAnswer)).toBe(true);

    // Never touch file, evaluation, or schedule_slot rows.
    expect(inserts.some((i) => i.table === schema.file)).toBe(false);
    expect(inserts.some((i) => i.table === schema.evaluation)).toBe(false);
    expect(inserts.some((i) => i.table === schema.scheduleSlot)).toBe(false);
  });

  it("produces zero participant inserts when every source participant is invited/declined (legitimate TBA clone)", async () => {
    const { db, inserts } = fakeDb({
      submission: {
        id: "sub-2",
        eventId: "event-1",
        formId: null,
        title: "Untouched Talk",
        description: null,
        trackId: null,
      },
      participants: [
        {
          id: "p-invited",
          contactId: "contact-invited",
          role: "speaker",
          order: 0,
          visible: true,
          inviteStatus: "invited",
          titleAtTime: null,
          orgAtTime: null,
        },
      ],
    });

    await cloneSubmission(db, "sub-2");

    expect(inserts.filter((i) => i.table === schema.participant)).toHaveLength(0);
  });
});
