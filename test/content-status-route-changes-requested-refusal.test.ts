// DEC-720 wave-53 amendment: `changes_requested` gets exactly one writer —
// POST /api/v1/submissions/:id/content-note (src/routes/content-notes.ts),
// which posts the thread note, moves the status, and mails the speakers.
// The bare content-status route (POST /api/v1/submissions/:id/content-status,
// mounted from src/routes/files.ts) must NOT be able to write
// `changes_requested` with no note and no email: it validates against the
// narrower isRouteSettableContentStatus predicate ('pending'|'approved'
// only) rather than isValidContentStatus (the DB-VALUE predicate, which
// legitimately still accepts all three and stays the predicate used by the
// content-note path — see test/files-repo.test.ts:63 and
// test/content-note.test.ts).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { SubmissionScope } from "../src/server/repo/files";

const SCOPE: SubmissionScope = {
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: "org-1",
  readParticipantContactIds: ["contact-speaker"],
  activeParticipantContactIds: ["contact-speaker"],
  status: "pending",
  formCloseDate: null,
  timezone: "UTC",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async () => SCOPE),
    updateContentStatus: vi.fn(async () => {}),
  };
});

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "org-user-1", role: "organizer", orgId: "org-1" };

function post(app: Hono<AppEnv>, contentStatus: string) {
  return app.request("/api/v1/submissions/sub-1/content-status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ contentStatus }),
  });
}

describe("POST /api/v1/submissions/:id/content-status (DEC-720 wave-53 amendment)", () => {
  it("400s on 'changes_requested' — that write belongs to /content-note", async () => {
    const { updateContentStatus } = await import("../src/server/repo/files");
    const app = await buildApp(ORGANIZER);
    const res = await post(app, "changes_requested");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toEqual({ contentStatus: "Use the content-note endpoint" });
    expect(updateContentStatus).not.toHaveBeenCalled();
  });

  it("still 200s on 'pending'", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await post(app, "pending");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "sub-1", contentStatus: "pending" });
  });

  it("still 200s on 'approved'", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await post(app, "approved");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "sub-1", contentStatus: "approved" });
  });
});
