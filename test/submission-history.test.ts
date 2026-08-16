// DEC-892: the submission detail HISTORY panel is a real timeline, unioning
// submitted/edited/reviewed/emailed sources. Covers listSubmissionHistory's
// merge+sort and the GET /api/v1/submissions/:id/history route (organizer-
// only, org-scoped).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { listSubmissionHistory } from "../src/server/repo/submissions/history";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    $dynamic: () => chain,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
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

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };
const SPEAKER_A: AuthInfo = { userId: "u-speaker-a", role: "speaker", orgId: ORG_A, contactId: "contact-1" };

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

describe("listSubmissionHistory (DEC-892)", () => {
  it("merges submitted/edited/reviewed/emailed and sorts newest-first, id asc tiebreak", async () => {
    const db = fakeDb([
      // 1. submission row
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: null }],
      // 2. listRevisions (baseline + one edit, DEC-158 wave-59)
      [
        { id: "rev-1", editorName: "organizer@example.com", title: "Edited Title", description: "d", createdAt: new Date(3000) },
        { id: "rev-0", editorName: "As submitted", title: "Original Title", description: "d", createdAt: new Date(1000) },
      ],
      // 3. reviewed (evaluation join)
      [
        {
          id: "ev-1",
          planName: "Track A Review",
          anonymized: false,
          submittedAt: new Date(4000),
          reviewerFirstName: "Jane",
          reviewerLastName: "Reviewer",
          reviewerEmail: "jane@example.com",
        },
        {
          id: "ev-2",
          planName: "Track A Review",
          anonymized: true,
          submittedAt: null, // in-progress, must be excluded
          reviewerFirstName: null,
          reviewerLastName: null,
          reviewerEmail: "hidden@example.com",
        },
      ],
      // 4. emailed
      [{ id: "email-1", subject: "You're accepted!", sentAt: new Date(2000) }],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");

    expect(entries.map((e) => e.kind)).toEqual(["reviewed", "edited", "emailed", "submitted"]);
    expect(entries[0]).toMatchObject({ id: "ev-1", kind: "reviewed", detail: "Jane Reviewer" });
    expect(entries[1]).toMatchObject({ id: "rev-1", kind: "edited", label: "Edited by organizer@example.com" });
    expect(entries[2]).toMatchObject({ id: "email-1", kind: "emailed", detail: "You're accepted!" });
    expect(entries[3]).toMatchObject({ id: "submission:sub-1", kind: "submitted" });
    // in-progress evaluation (submittedAt null) never surfaces
    expect(entries.some((e) => e.id === "ev-2")).toBe(false);
  });

  // DEC-736 supersedes DEC-622's null-iff-anonymized rule: anonymization
  // hides the SPEAKER from the REVIEWER, never the reviewer's identity from
  // the organiser, so an anonymized plan's review still names its reviewer
  // here (a withheld '(anonymized)' cell must never render on this panel).
  it("still names the reviewer on an anonymized plan's review (DEC-736)", async () => {
    const db = fakeDb([
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: null }],
      [],
      [
        {
          id: "ev-1",
          planName: "Blind Review",
          anonymized: true,
          submittedAt: new Date(2000),
          reviewerFirstName: "Jane",
          reviewerLastName: "Reviewer",
          reviewerEmail: "jane@example.com",
        },
      ],
      [],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");
    const reviewed = entries.find((e) => e.kind === "reviewed");
    expect(reviewed?.detail).toBe("Jane Reviewer");
  });

  // DEC-158 wave-59 amendment: a baseline (AS_SUBMITTED_EDITOR) revision row
  // must not surface as its own "Edited by As submitted" entry — instead its
  // id is folded into the `submitted` entry's revisionId, and every other
  // entry carries revisionId: null.
  it("folds a baseline revision's id into the submitted entry, not a separate edited entry", async () => {
    const db = fakeDb([
      [{ id: "sub-1", createdAt: new Date(500), externalRef: null }],
      [
        { id: "rev-2", editorName: "organizer@example.com", title: "Edited Title", description: "d2", createdAt: new Date(3000) },
        { id: "rev-1", editorName: "As submitted", title: "Original Title", description: "d1", createdAt: new Date(500) },
      ],
      [],
      [],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");

    expect(entries.map((e) => e.kind)).toEqual(["edited", "submitted"]);
    expect(entries.find((e) => e.id === "rev-1")).toBeUndefined();
    const submitted = entries.find((e) => e.kind === "submitted");
    expect(submitted?.revisionId).toBe("rev-1");
    const edited = entries.find((e) => e.kind === "edited");
    expect(edited?.revisionId).toBe("rev-2");
  });

  it("surfaces the import source on the submitted entry when external_ref is set", async () => {
    const db = fakeDb([
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: "sessionize:abc123" }],
      [],
      [],
      [],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");
    const submitted = entries.find((e) => e.kind === "submitted");
    expect(submitted?.detail).toBe("Imported via sessionize");
  });
});

describe("listSubmissionHistory edited-entry detail diffing (DEC-892)", () => {
  it("distinguishes title-only, description-only, both, and no-op edits by diffing against the immediately-prior revision", async () => {
    const db = fakeDb([
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: null }],
      // listRevisions: baseline + 3 edits (mock returns newest-first, as the
      // real query does -- listSubmissionHistory must sort ascending itself).
      [
        { id: "rev-4", editorName: "b@example.com", title: "T3", description: "D3", createdAt: new Date(5000) },
        { id: "rev-3", editorName: "b@example.com", title: "T3", description: "D2", createdAt: new Date(4000) },
        { id: "rev-2", editorName: "a@example.com", title: "T2", description: "D1", createdAt: new Date(3000) },
        { id: "rev-1", editorName: "As submitted", title: "T1", description: "D1", createdAt: new Date(1000) },
      ],
      [],
      [],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));

    // rev-2 vs baseline (rev-1): title T1->T2 changed, description D1==D1
    expect(byId["rev-2"]?.detail).toBe("Title changed");
    // rev-3 vs rev-2: title T2->T3 changed, description D1->D2 changed
    expect(byId["rev-3"]?.detail).toBe("Title and description changed");
    // rev-4 vs rev-3: title T3==T3, description D2->D3 changed
    expect(byId["rev-4"]?.detail).toBe("Description changed");
  });

  it("reports 'No text change' when a revision's title and description are identical to its predecessor", async () => {
    const db = fakeDb([
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: null }],
      [
        { id: "rev-2", editorName: "a@example.com", title: "Same", description: "Same body", createdAt: new Date(2000) },
        { id: "rev-1", editorName: "As submitted", title: "Same", description: "Same body", createdAt: new Date(1000) },
      ],
      [],
      [],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");
    const edited = entries.find((e) => e.id === "rev-2");
    expect(edited?.detail).toBe("No text change");
  });

  it("leaves submitted/reviewed/emailed entries' detail computation untouched", async () => {
    const db = fakeDb([
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: "sessionize:abc123" }],
      [],
      [
        {
          id: "ev-1",
          planName: "Track A Review",
          anonymized: false,
          submittedAt: new Date(2000),
          reviewerFirstName: "Jane",
          reviewerLastName: "Reviewer",
          reviewerEmail: "jane@example.com",
        },
      ],
      [{ id: "email-1", subject: "You're accepted!", sentAt: new Date(3000) }],
    ]);

    const entries = await listSubmissionHistory(db, "sub-1");
    expect(entries.find((e) => e.kind === "submitted")?.detail).toBe("Imported via sessionize");
    expect(entries.find((e) => e.kind === "reviewed")?.detail).toBe("Jane Reviewer");
    expect(entries.find((e) => e.kind === "emailed")?.detail).toBe("You're accepted!");
  });
});

describe("GET /api/v1/submissions/:id/history (DEC-892)", () => {
  it("returns a list envelope, organizer-only", async () => {
    const db = fakeDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ id: "sub-1", createdAt: new Date(1000), externalRef: null }], // submission row
      [], // revisions
      [], // reviewed
      [], // emailed
    ]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/history"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.total).toBe(1);
    expect(json.items[0]).toMatchObject({ kind: "submitted" });
  });

  it("403s a speaker caller", async () => {
    const db = fakeDb([]);
    const res = await appWithDbAndAuth(db, SPEAKER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/history"),
    );
    expect(res.status).toBe(403);
  });

  it("404s a submission that doesn't exist", async () => {
    const db = fakeDb([[]]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/history"),
    );
    expect(res.status).toBe(404);
  });

  it("404s cross-org access (existence-hiding, never 403)", async () => {
    const db = fakeDb([[{ eventId: "event-1", orgId: "org-b" }]]);
    const res = await appWithDbAndAuth(db, ORGANIZER_A).request(
      new Request("http://local/api/v1/submissions/sub-1/history"),
    );
    expect(res.status).toBe(404);
  });
});
