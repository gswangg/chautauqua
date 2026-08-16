// DEC-720 wave-32 amendment: `changes_requested` no longer has exactly one
// writer. The prior narrower isRouteSettableContentStatus predicate forced
// every 'changes_requested' transition through POST
// /api/v1/submissions/:id/content-note (src/routes/content-notes.ts), which
// unconditionally mails — that inverted DEC-009 ("status changes never
// auto-email"). The bare content-status route (POST
// /api/v1/submissions/:id/content-status, mounted from src/routes/files.ts)
// now validates against isValidContentStatus (the DB-VALUE predicate) and
// accepts 'changes_requested' with no note and no email — see
// test/files-repo.test.ts:63 and test/content-note.test.ts for the separate
// content-note path, which remains a deliberate note+email action.

import { describe, expect, it, vi } from "vitest";
import { CONTENT_STATUSES } from "../src/domain/content-status";
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

describe("POST /api/v1/submissions/:id/content-status (DEC-720 wave-32 amendment)", () => {
  it("200s on 'changes_requested' — no note, no email required", async () => {
    const { updateContentStatus } = await import("../src/server/repo/files");
    const app = await buildApp(ORGANIZER);
    const res = await post(app, "changes_requested");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "sub-1", contentStatus: "changes_requested" });
    expect(updateContentStatus).toHaveBeenCalledWith(expect.anything(), "event-1", "sub-1", "changes_requested");
  });

  it("400s on an unrelated invalid value", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await post(app, "bogus");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    // DEC-003 (wave-73 amendment): the refusal copy is COMPOSED from
    // CONTENT_STATUSES rather than hand-listing the members, so assert the
    // message names every member of the live vocabulary rather than pinning
    // the exact prose the ruling replaced.
    expect(body.error.message).toContain("contentStatus must be");
    for (const status of CONTENT_STATUSES) {
      expect(body.error.message).toContain(`'${status}'`);
    }
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
