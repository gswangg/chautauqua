// DEC-855: submission_track is the ONLY source of a submission's tracks.
// (a) an ENUMERATION scan across src/ and scripts/ failing on any lingering
//     scalar-track read outside the schema file itself;
// (b) a repo test proving getPortalSubmissionDetail / getMySessions read the
//     track name through the joined submission_track table, even when the
//     submission's own (now-frozen) track_id column is NULL;
// (c) a test proving the sessionboard importer's create path writes a
//     submission_track row for a resolvable trackName.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getPortalSubmissionDetail, getMySessions } from "../src/server/repo/portal";
import { applySessionboardPlans } from "../src/server/repo/import/sessionboard";
import type { Db } from "../src/server/context";

const REPO_ROOT = path.resolve(__dirname, "..");
const ALLOWED_FILE = "src/db/schema/submissions.ts";
const FORBIDDEN_PATTERNS = ["schema.submission.trackId", "submission.trackId", "additionalTrackIdsJson"];

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

describe("DEC-855 ENUMERATION scan: submission_track is the only source of a submission's tracks", () => {
  it("no file outside src/db/schema/submissions.ts references the frozen scalar track column(s)", () => {
    const files: string[] = [];
    for (const dir of ["src", "scripts"]) {
      const abs = path.join(REPO_ROOT, dir);
      if (fs.existsSync(abs)) walk(abs, files);
    }

    const offenses: string[] = [];
    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      if (rel === ALLOWED_FILE) continue;
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (line.includes(pattern)) {
            offenses.push(`${rel}:${idx + 1} references "${pattern}" (only ${ALLOWED_FILE} may)`);
          }
        }
      });
    }

    expect(offenses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (b) Queue-based fake db: each db.select() call consumes the next queued
// row-array, in the exact order the repo function issues its queries. This
// mirrors test/submission-tracks-patch.test.ts's fake-db pattern (no
// wrangler/D1 harness exists for stage-1 unit tests).
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rows),
    offset: () => chain,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function queuedDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as Db;
}

describe("DEC-855: portal reads derive trackName from submission_track even when submission.track_id is NULL", () => {
  it("getPortalSubmissionDetail returns the joined track's name", async () => {
    const submissionId = "sub-1";
    const db = queuedDb([
      // main submission/event/scheduleSlot/room join — no trackId column at all now
      [
        {
          id: submissionId,
          seq: 1,
          title: "Talk",
          description: null,
          status: "pending",
          createdAt: new Date(),
          recordPrefix: "SES",
          eventId: "event-1",
          eventOrgId: "org-1",
          timezone: "America/New_York",
          day: null,
          startMin: null,
          endMin: null,
          roomName: null,
        },
      ],
      [], // formatRows
      [{ contactId: "contact-1", inviteStatus: "accepted" }], // participantRows
      [], // answerRows
      [{ submissionId, name: "Keynote" }], // loadTrackNamesBySubmission
    ]);

    const detail = await getPortalSubmissionDetail(db, submissionId, "contact-1", "org-1");
    expect(detail).not.toBeNull();
    expect(detail!.trackName).toBe("Keynote");
  });

  it("getMySessions returns the joined track's name", async () => {
    const submissionId = "sub-2";
    const db = queuedDb([
      [
        {
          submissionId,
          seq: 2,
          title: "Talk two",
          recordPrefix: "SES",
          day: null,
          startMin: null,
          endMin: null,
          roomName: null,
          acceptedAt: new Date(),
          eventName: "Event",
          timezone: "America/New_York",
        },
      ],
      [{ submissionId, name: "Data" }], // loadTrackNamesBySubmission
    ]);

    const sessions = await getMySessions(db, "contact-1", "org-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.trackName).toBe("Data");
  });
});

// ---------------------------------------------------------------------------
// (c) sessionboard importer create path
// ---------------------------------------------------------------------------

function importFakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: { table: unknown; vals: unknown }[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (table: unknown) => ({
      // DEC-528 (wave 52): the batched writer passes a multi-row array to
      // .values(...) (chunkRowsForInsert) instead of one object per call --
      // flatten so each row is still its own entry here, matching the
      // per-row shape callers below expect.
      values: async (vals: unknown) => {
        const list = Array.isArray(vals) ? vals : [vals];
        for (const v of list) inserts.push({ table, vals: v });
      },
    }),
  };
  return { db: db as unknown as Db, inserts };
}

describe("DEC-855: sessionboard import create path writes submission_track, never submission.trackId", () => {
  it("a resolvable trackName produces a submission_track insert alongside the submission insert", async () => {
    const { db, inserts } = importFakeDb([
      [], // loadExistingRefs (submissions): no existing row for this externalRef
      [{ id: "track-1", name: "Keynote" }], // loadTrackNameMap
    ]);

    const result = await applySessionboardPlans(db, {
      orgId: "org-1",
      eventId: "event-1",
      entity: "submissions",
      dryRun: false,
      plans: [
        {
          row: 2,
          externalRef: "sessionboard:sess-1",
          values: { title: "New Talk", trackName: "Keynote" },
        },
      ],
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toEqual([]);

    // Submission insert must never carry a trackId key.
    const subInsert = inserts.find((i) => (i.vals as any).title === "New Talk");
    expect(subInsert).toBeDefined();
    expect("trackId" in (subInsert!.vals as object)).toBe(false);

    const trackInsert = inserts.find((i) => (i.vals as any).trackId === "track-1");
    expect(trackInsert).toBeDefined();
    expect((trackInsert!.vals as any).submissionId).toBeDefined();
  });
});
