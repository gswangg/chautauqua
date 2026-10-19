// DEC-317 Amendment (wave 37), part (e): a speaker-named co-presenter
// (addCoPresenter — src/server/repo/portal-edit.ts — lands 'invited') is
// still able to gain access through the EXISTING accept/decline machinery:
// POST /portal/invitations/:participantId (src/routes/portal/index.tsx),
// canTransitionInvite (decision 76 retired the DEC-278 onboarding-task
// back-fill: the portals an accepted invitation joins bring their items). Kept in a
// separate file from test/portal-invite-write-audience-behavior.test.ts
// because vi.mock is file-scoped/hoisted — mocking
// src/server/repo/submissions here would otherwise shadow the REAL
// ensureOnboardingTasks that file exercises directly (same convention as
// test/portal-copresenter.test.ts / test/portal-copresenter-route.test.ts).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ID = "event-1";
const setInviteStatusCalls: { participantId: string; status: string }[] = [];

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalHome: vi.fn(async () => ({ views: [], placements: new Map() })),
    getParticipantScope: vi.fn(async () => ({
      id: "participant-new",
      contactId: "contact-existing",
      inviteStatus: "invited",
      orgId: "org-1",
    })),
    setInviteStatus: vi.fn(async (_db: unknown, participantId: string, _contactId: string, status: string) => {
      setInviteStatusCalls.push({ participantId, status });
    }),
  };
});

vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
    "../src/server/repo/submissions",
  );
  return {
    ...actual,
    getSubmissionStatusForParticipant: vi.fn(async () => ({
      submissionId: "sub-1",
      eventId: EVENT_ID,
      status: "accepted",
    })),
  };
});

const { portalRoutes } = await import("../src/routes/portal/index");

function buildPortalApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org-1", contactId: "contact-existing" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", portalRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

function postAccept(app: Hono<AppEnv>, participantId: string, action: "accept" | "decline") {
  const params = new URLSearchParams();
  params.append("chq_csrf", CSRF_TOKEN);
  params.append("action", action);
  return app.request(`/invitations/${participantId}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `chq_csrf=${CSRF_TOKEN}`,
    },
    body: params.toString(),
  });
}

describe("(e) POST /portal/invitations/:participantId?action=accept (DEC-317 Amendment, wave 37)", () => {
  beforeEach(() => {
    setInviteStatusCalls.length = 0;
  });

  it("transitions the invited co-presenter to accepted and back-fills their onboarding tasks", async () => {
    const app = buildPortalApp();
    const res = await postAccept(app, "participant-new", "accept");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");

    expect(setInviteStatusCalls).toEqual([{ participantId: "participant-new", status: "accepted" }]);
  });
});
