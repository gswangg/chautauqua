// DEC-997 (finishes DEC-417): the same named caps the admin JSON API applies
// to a free-text column must also bound the HTML-form family that writes the
// same column. Covers the one verified-unbounded path (addCoPresenter's
// firstName/lastName -> participant.name_at_time / contact.first_name,
// last_name) at both the repo layer (unit) and the route layer
// (POST /portal/submissions/:id/participants, end-to-end through Hono) — an
// oversized value must produce a 400 field error naming the field, never a
// 500, and must never reach db.insert.
//
// DEC-417 (wave 67 amendment): ONE CAP PER CONTACT IDENTITY COLUMN tightened
// addCoPresenter's firstName/lastName bound from the generic
// MAX_TEXT_LENGTH (2000) down to the CRM's own MAX_NAME_LENGTH (200) -- the
// CRM could never re-save a co-presenter minted above its own
// contact.firstName/lastName cap. See
// test/contact-identity-cap-parity.test.ts for the cross-surface parity
// coverage.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { addCoPresenter } from "../src/server/repo/portal-edit";
import { MAX_NAME_LENGTH } from "../src/forms/validate";
import { overCapFieldMessage } from "../src/domain/cap-copy";
import * as schema from "../src/db/schema";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    // DEC-558 (wave 75): findContactByEmail orders by (createdAt, id) before
    // .limit(1); a no-op for this fake, but it must exist in the chain.
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: (_table: unknown) => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          onConflictDoNothing: () => ({
            returning: async () => [{ id: "participant-x" }],
          }),
        };
      },
    }),
    // DEC-725 amendment: addCoPresenter now also bumps the owning
    // submission's updated_at (submissions/touch.ts).
    update: (table: unknown) => {
      if (table === schema.submission) {
        return { set: () => ({ where: () => Promise.resolve() }) };
      }
      throw new Error("must never write to an existing contact");
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

const OVERSIZED = "x".repeat(MAX_NAME_LENGTH + 1);

describe("addCoPresenter repo layer bounds firstName/lastName (DEC-997)", () => {
  it("rejects an oversized firstName with a field error, never touching the db", async () => {
    const { db, inserts } = fakeDb([]);
    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: OVERSIZED,
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.firstName).toBe(overCapFieldMessage(OVERSIZED.length, MAX_NAME_LENGTH));
    expect(inserts.length).toBe(0);
  });

  it("rejects an oversized lastName with a field error, never touching the db", async () => {
    const { db, inserts } = fakeDb([]);
    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: "Marcus",
      lastName: OVERSIZED,
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.lastName).toBe(overCapFieldMessage(OVERSIZED.length, MAX_NAME_LENGTH));
    expect(inserts.length).toBe(0);
  });

  it("accepts a name exactly at the cap", async () => {
    const AT_CAP = "x".repeat(MAX_NAME_LENGTH);
    // select order: [0] participant count, [1] findContactByEmail -> no match
    const { db } = fakeDb([[{ count: 1 }], []]);
    const result = await addCoPresenter(db, {
      submissionId: "sub-1",
      orgId: "org-1",
      firstName: AT_CAP,
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(result.ok).toBe(true);
  });
});

// Route-layer, end-to-end: real addCoPresenter (not mocked), fake db
// injected as c.var.db, through the real Hono handler.
const BASE_DATA = {
  submission: { id: "s1", status: "pending" as const, title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
  fields: [],
  answers: {},
  offeredTrackIds: [],
  allTracks: [],
  selectedTrackIds: [],
};

const loadEditableSubmissionMockFactory = () => {
  return async () => BASE_DATA;
};

const loadEditableSubmissionMock = vi.fn(loadEditableSubmissionMockFactory());

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: (...args: unknown[]) => loadEditableSubmissionMock(...(args as [])),
    getPortalParticipants: vi.fn(async () => []),
    // addCoPresenter is intentionally the REAL implementation here (not
    // overridden) so this test exercises DEC-997's cap end-to-end.
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { orgName: "Org", primaryColor: "#000", logoUrl: null },
      submissions: [],
      tasks: [],
    })),
  };
});

const { portalEditRoutes } = await import("../src/routes/portal/edit");

function buildApp(db: unknown) {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalEditRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

function postParticipant(app: Hono<AppEnv>, fields: Record<string, string>) {
  const params = new URLSearchParams();
  params.append("chq_csrf", CSRF_TOKEN);
  for (const [k, v] of Object.entries(fields)) params.append(k, v);
  return app.request("/portal/submissions/s1/participants", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `chq_csrf=${CSRF_TOKEN}`,
    },
    body: params.toString(),
  });
}

describe("POST /portal/submissions/:id/participants bounds free text end-to-end (DEC-997)", () => {
  beforeEach(() => {
    loadEditableSubmissionMock.mockReset();
    loadEditableSubmissionMock.mockResolvedValue(BASE_DATA);
  });

  it("400s with a rendered field error on an oversized firstName, never a 500, never persisting a row", async () => {
    const { db, inserts } = fakeDb([]);
    const app = buildApp(db);
    const res = await postParticipant(app, {
      firstName: OVERSIZED,
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(overCapFieldMessage(OVERSIZED.length, MAX_NAME_LENGTH));
    expect(inserts.length).toBe(0);
  });

  it("400s with a rendered field error on an oversized lastName, never a 500, never persisting a row", async () => {
    const { db, inserts } = fakeDb([]);
    const app = buildApp(db);
    const res = await postParticipant(app, {
      firstName: "Marcus",
      lastName: OVERSIZED,
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(overCapFieldMessage(OVERSIZED.length, MAX_NAME_LENGTH));
    expect(inserts.length).toBe(0);
  });
});
