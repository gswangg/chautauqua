// Regression for the portal-edit track-injection hole (DEC-074): POST
// /submissions/:id/edit trusted whatever trackIds the client posted without
// checking them against the form's offeredTrackIds — a speaker (or a forged
// request) could attach a track from another event/form. Fixed by running
// the same validateTrackChoice gate the public submit path uses
// (src/routes/public/submit.tsx:403), after deduping the posted ids via Set
// so a repeated id can never hit the submission_track PK twice.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";

const BASE_DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: null },
  fields: [],
  answers: {},
  offeredTrackIds: ["t1", "t2"],
  allTracks: [
    { id: "t1", name: "Track One" },
    { id: "t2", name: "Track Two" },
  ],
  selectedTrackIds: ["t1"],
};

const saveSubmissionEdits = vi.fn(async (..._args: unknown[]) => {});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async () => BASE_DATA),
    saveSubmissionEdits: (...args: unknown[]) => saveSubmissionEdits(...args),
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

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalEditRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

async function postEdit(app: Hono<AppEnv>, trackIds: string[]) {
  const params = new URLSearchParams();
  params.append("chq_csrf", CSRF_TOKEN);
  for (const id of trackIds) params.append("trackIds", id);
  return app.request("/portal/submissions/s1/edit", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `chq_csrf=${CSRF_TOKEN}`,
    },
    body: params.toString(),
  });
}

describe("POST /portal/submissions/:id/edit track validation (DEC-074)", () => {
  it("rejects a track id outside offeredTrackIds with 400 and never saves", async () => {
    const app = buildApp();
    saveSubmissionEdits.mockClear();
    const res = await postEdit(app, ["t1", "foreign-track-from-another-event"]);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("not offered");
    expect(saveSubmissionEdits).not.toHaveBeenCalled();
  });

  it("dedupes repeated track ids before validating and saving — no PK violation", async () => {
    const app = buildApp();
    saveSubmissionEdits.mockClear();
    const res = await postEdit(app, ["t1", "t1", "t2"]);
    expect(res.status).toBe(302);
    expect(saveSubmissionEdits).toHaveBeenCalledTimes(1);
    const call = saveSubmissionEdits.mock.calls[0]!;
    const trackIds = call[3] as string[] | null;
    expect(trackIds).toEqual(["t1", "t2"]);
  });

  it("saves a valid subset of offered tracks", async () => {
    const app = buildApp();
    saveSubmissionEdits.mockClear();
    const res = await postEdit(app, ["t2"]);
    expect(res.status).toBe(302);
    expect(saveSubmissionEdits).toHaveBeenCalledTimes(1);
    const call = saveSubmissionEdits.mock.calls[0]!;
    const trackIds = call[3] as string[] | null;
    expect(trackIds).toEqual(["t2"]);
  });
});
