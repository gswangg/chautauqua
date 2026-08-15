// DEC-041 amendment (wave 6, restored): an accepted speaker keeps editing
// their submission after the CFP closes — docs/clarifications.md:39,
// SPEC.md:297-298, and the vendored frame (docs/design/Chautauqua Public and
// Portal.dc.html:597-620, "Edit your session") all agree. This is the
// server-level regression: the portal edit GET must render the FORM (not
// the "Editing closed" screen) for an accepted submission whose form has
// closed, and the submission detail page must still offer an Edit link.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { PortalSubmissionDetail } from "../src/server/repo/portal/data";

const PAST_CLOSE = Date.parse("2020-01-01T00:00:00Z"); // well in the past -> form closed

const ACCEPTED_DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "accepted", title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: PAST_CLOSE, timezone: "America/Los_Angeles" },
  fields: [],
  answers: {},
  offeredTrackIds: [],
  allTracks: [],
  selectedTrackIds: [],
};

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async () => ACCEPTED_DATA),
    getPortalParticipants: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  const detail: PortalSubmissionDetail = {
    id: "s1",
    eventId: "evt-1",
    ref: "REF-1",
    title: "Talk title",
    description: "desc",
    status: "accepted",
    statusLabel: "Accepted",
    submittedAt: Date.parse("2019-06-01T00:00:00Z"),
    timezone: "America/Los_Angeles",
    answers: [],
    trackName: null,
    format: null,
    day: null,
    startMin: null,
    endMin: null,
    roomName: null,
  };
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { orgName: "Org", primaryColor: "#000", logoUrl: null },
      submissions: [],
      tasks: [],
      contactName: "Speaker Name",
    })),
    getPortalSubmissionDetail: vi.fn(async () => detail),
    getLatestDeliverable: vi.fn(async () => null),
    getFileVersionNumber: vi.fn(async () => null),
    getMyTaskAssignments: vi.fn(async () => []),
    listDeliverableCandidatesForEvents: vi.fn(async () => new Map()),
    getPortalParticipants: vi.fn(async () => []),
  };
});

const speaker: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: "org-1", contactId: "c1" };

function buildApp(routes: unknown) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", speaker);
    c.set("db", {} as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", routes as never);
  return app;
}

describe("accepted submission past close (DEC-041 restored exception)", () => {
  it("GET /portal/submissions/:id/edit renders the editable FORM, not 'Editing closed'", async () => {
    const { portalEditRoutes } = await import("../src/routes/portal/edit");
    const app = buildApp(portalEditRoutes);
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("Editing closed");
    expect(html).toContain("Save changes");
  });

  it("submission detail page still offers an Edit link", async () => {
    const { portalRoutes } = await import("../src/routes/portal/index");
    const app = buildApp(portalRoutes);
    const res = await app.request("/portal/submissions/s1");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Edit submission");
  });
});
