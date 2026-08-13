// DEC-843 (task w10-c): the submissions list and its CSV/JSON export must
// read the `status` query filter through the SAME reader
// (readStatusTokens, src/server/repo/submissions/query.ts) — repeated
// params AND comma-separated tokens both accepted, unknown tokens throw
// loudly (400 "Unknown status '<token>'") on BOTH surfaces instead of the
// list silently widening to every status while the export 400s (or vice
// versa). This test drives the real route apps (submissionsRoutes,
// exportsRoutes) with fake dbs shaped to each function's exact query
// sequence (same technique as test/exports-submissions-filter.test.ts and
// test/exports-cross-org.test.ts) and asserts, for the SAME query string,
// that both surfaces resolve to the identical set of submission refs (the
// public id both list items and export rows expose), and that an unknown
// token 400s on both, naming the token.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler } from "../src/server/http";
import { readStatusTokens } from "../src/server/repo/submissions/query";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ID = "event-1";
const ORG_ID = "org-1";
const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_ID };

function submissionRow(id: string, seq: number, title: string, status: string) {
  return {
    id,
    title,
    seq,
    createdAt: new Date(2026, 0, seq),
    updatedAt: new Date(2026, 0, seq),
    eventId: EVENT_ID,
    description: null,
    formId: null,
    trackId: null,
    additionalTrackIdsJson: null,
    status,
    contentStatus: "pending",
    acceptedAt: null,
    icsSequence: 0,
  };
}

// Generic fake db recorder (same pattern as
// test/exports-submissions-filter.test.ts / test/exports-cross-org.test.ts):
// each queued response is consumed in order by the next select() chain's
// resolution.
function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  function chain(): any {
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) obj[m] = (..._args: unknown[]) => obj;
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[cursor];
      cursor += 1;
      if (value === undefined) {
        return Promise.reject(new Error(`fake db: no queued response for query #${cursor}`)).catch(
          (e) => (reject ? reject(e) : Promise.reject(e)),
        );
      }
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { select: () => chain() } as unknown as AppEnv["Variables"]["db"];
}

function listDbFor(matchingRows: ReturnType<typeof submissionRow>[]) {
  // ownership: getEventOrgId -> [{orgId}]
  // listSubmissions: recordPrefix, count, rows, participants, tracks,
  // deliverables, latestFile (4 empty batches, no includeAnswers).
  return makeFakeDb([
    [{ orgId: ORG_ID }],
    [{ recordPrefix: "SES" }],
    [{ count: matchingRows.length }],
    [], // DEC-913 grouped counts
    matchingRows,
    [],
    [],
    [],
    [],
    [], // scheduled (schedule_slot/room) enrichment (w41-b)
  ]);
}

function exportDbFor(matchingRows: ReturnType<typeof submissionRow>[]) {
  // requireOwnedEvent -> [{id,orgId}]
  // exportSubmissions: recordPrefix, submissions, trackJoin, participants,
  // formRows (0 forms -> fieldRows loop contributes 0 queries), answerRows.
  return makeFakeDb([
    [{ id: EVENT_ID, orgId: ORG_ID }],
    [{ recordPrefix: "SES" }],
    matchingRows,
    [],
    [],
    [],
    [],
  ]);
}

function listApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", AUTH);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

function exportApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", AUTH);
    await next();
  });
  app.route("/", exportsRoutes);
  return app;
}

const ALL_ROWS = [
  submissionRow("s1", 1, "Alpha", "accepted"),
  submissionRow("s2", 2, "Beta", "declined"),
  submissionRow("s3", 3, "Gamma", "pending"),
];

describe("readStatusTokens (DEC-843)", () => {
  it("accepts repeated tokens, comma tokens, trims, dedupes preserving order", () => {
    expect(readStatusTokens(["accepted", "declined"])).toEqual(["accepted", "declined"]);
    expect(readStatusTokens("accepted,declined")).toEqual(["accepted", "declined"]);
    expect(readStatusTokens([" accepted ", "declined", "accepted"])).toEqual(["accepted", "declined"]);
    expect(readStatusTokens(["accepted,declined", "accepted"])).toEqual(["accepted", "declined"]);
    expect(readStatusTokens(undefined)).toEqual([]);
    expect(readStatusTokens("")).toEqual([]);
  });

  it("throws naming the token for anything outside SUBMISSION_STATUSES (case-sensitive exact match)", () => {
    expect(() => readStatusTokens("aproved")).toThrow("aproved");
    expect(() => readStatusTokens(["accepted", "Accepted"])).toThrow("Accepted");
  });
});

describe("submissions list vs export: one status reader, same row set (DEC-843)", () => {
  const cases: { label: string; query: string }[] = [
    { label: "repeated params", query: "status=accepted&status=declined" },
    { label: "comma-separated", query: "status=accepted,declined" },
    { label: "mixed repeated + comma", query: "status=accepted&status=declined,pending" },
  ];

  for (const { label, query } of cases) {
    it(`${label}: list and export return the same submission refs for '${query}'`, async () => {
      const matching = ALL_ROWS.filter((r) => query.includes(r.status));

      const listRes = await listApp(listDbFor(matching)).request(
        `/api/v1/events/${EVENT_ID}/submissions?${query}`,
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { items: { ref: string }[] };
      const listRefs = listBody.items.map((i) => i.ref).sort();

      const exportRes = await exportApp(exportDbFor(matching)).request(
        `/api/v1/events/${EVENT_ID}/export/submissions?format=json&${query}`,
      );
      expect(exportRes.status).toBe(200);
      const exportRecords = (await exportRes.json()) as { ref: string }[];
      const exportRefs = exportRecords.map((r) => r.ref).sort();

      expect(exportRefs).toEqual(listRefs);
      expect(listRefs.length).toBeGreaterThan(0);
    });
  }

  it("an unknown status token 400s on BOTH surfaces, naming the token", async () => {
    const query = "status=aproved";

    const listRes = await listApp(listDbFor([])).request(`/api/v1/events/${EVENT_ID}/submissions?${query}`);
    expect(listRes.status).toBe(400);
    const listBody = (await listRes.json()) as { error: { message: string } };
    expect(listBody.error.message).toContain("aproved");

    const exportRes = await exportApp(exportDbFor([])).request(
      `/api/v1/events/${EVENT_ID}/export/submissions?format=json&${query}`,
    );
    expect(exportRes.status).toBe(400);
    const exportBody = (await exportRes.json()) as { error: { message: string } };
    expect(exportBody.error.message).toContain("aproved");
  });

  it("?status=accepted&status=declined never silently widens to every status on either surface", async () => {
    const query = "status=accepted&status=declined";
    const matching = ALL_ROWS.filter((r) => r.status === "accepted" || r.status === "declined");
    expect(matching.length).toBe(2);
    expect(matching.length).toBeLessThan(ALL_ROWS.length);

    const listRes = await listApp(listDbFor(matching)).request(
      `/api/v1/events/${EVENT_ID}/submissions?${query}`,
    );
    const listBody = (await listRes.json()) as { items: unknown[] };
    expect(listBody.items).toHaveLength(2);

    const exportRes = await exportApp(exportDbFor(matching)).request(
      `/api/v1/events/${EVENT_ID}/export/submissions?format=json&${query}`,
    );
    const exportRecords = (await exportRes.json()) as unknown[];
    expect(exportRecords).toHaveLength(2);
  });
});
