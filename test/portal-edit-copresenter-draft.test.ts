// DEC-029 (wave-114 amendment): POST /portal/submissions/:id/participants
// (src/routes/portal/edit.tsx) is a second submit of the ONE edit form, so
// the body also carries the speaker's in-progress trackIds checkboxes when
// tracksEditable. The route must echo that typed selection on both renders
// (400 refusal and 200 success) using the SAME one owner the edit POST uses
// (extractTrackIds, src/routes/public/submit-body.ts) -- not silently fall
// back to data.selectedTrackIds from the database. Harness copied from
// test/portal-copresenter-route.test.ts (kept in a separate file for the
// same vi.mock hoisting reason documented there).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";

const BASE_DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
  fields: [],
  answers: {},
  offeredTrackIds: ["t1", "t2"],
  allTracks: [
    { id: "t1", name: "Track One" },
    { id: "t2", name: "Track Two" },
  ],
  selectedTrackIds: ["t1"], // DB value: only Track One
  formatLabel: null,
};

// closeDate far enough past that canEditTracks reports the track window as
// closed, but status "accepted" keeps canEditSubmission (the route's
// separate editable re-check) true -- an accepted speaker can still edit
// title/abstract after close, just never tracks (src/domain/edit-lock.ts).
const TRACKS_CLOSED_DATA: EditableSubmissionData = {
  ...BASE_DATA,
  submission: { ...BASE_DATA.submission, status: "accepted" },
  form: { id: "f1", closeDate: 1000, timezone: "America/Los_Angeles" },
};

const loadEditableSubmissionMock = vi.fn(async () => BASE_DATA);
const addCoPresenterMock = vi.fn(
  async (..._args: unknown[]) => ({ ok: true }) as { ok: boolean; errors?: Record<string, string> },
);

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: (...args: unknown[]) => loadEditableSubmissionMock(...(args as [])),
    getPortalParticipants: vi.fn(async () => []),
    getAllSubmissionParticipants: vi.fn(async () => []),
    addCoPresenter: (...args: unknown[]) => addCoPresenterMock(...args),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalHome: vi.fn(async () => ({ views: [], placements: new Map() })),
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
    c.set("db", {} as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalEditRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

function postParticipant(app: Hono<AppEnv>, params: URLSearchParams) {
  params.append("chq_csrf", CSRF_TOKEN);
  return app.request("/portal/submissions/s1/participants", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `chq_csrf=${CSRF_TOKEN}`,
    },
    body: params.toString(),
  });
}

function coPresenterParams(extra: Record<string, string | string[]> = {}): URLSearchParams {
  const params = new URLSearchParams();
  params.append("firstName", "Marcus");
  params.append("lastName", "Okafor");
  params.append("email", "marcus@example.com");
  params.append("role", "co-presenter");
  for (const [k, v] of Object.entries(extra)) {
    for (const val of Array.isArray(v) ? v : [v]) params.append(k, val);
  }
  return params;
}

function trackChecked(html: string, id: string, name: string): boolean {
  const idx = html.indexOf(`value="${id}"`);
  expect(idx, `expected a trackIds checkbox for ${id} (${name}) in the HTML`).toBeGreaterThan(-1);
  const tagStart = html.lastIndexOf("<input", idx);
  const tagEnd = html.indexOf(">", idx);
  return /\bchecked\b/.test(html.slice(tagStart, tagEnd));
}

describe("POST /portal/submissions/:id/participants echoes typed track selection (DEC-029 wave-114 amendment)", () => {
  beforeEach(() => {
    addCoPresenterMock.mockClear();
    loadEditableSubmissionMock.mockReset();
    loadEditableSubmissionMock.mockResolvedValue(BASE_DATA);
  });

  it("tracksEditable, success (200): echoes the posted trackIds set, not the DB set", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: true });
    const app = buildApp();
    // DB has only t1 selected; the speaker's in-progress edit re-picks t2 only.
    const res = await postParticipant(app, coPresenterParams({ trackIds: "t2" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(trackChecked(html, "t1", "Track One")).toBe(false);
    expect(trackChecked(html, "t2", "Track Two")).toBe(true);
  });

  it("tracksEditable, refusal (400 duplicate co-presenter): still echoes the posted trackIds set, and the duplicate callout still renders", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: false, errors: { email: "This person is already on the session" } });
    const app = buildApp();
    const res = await postParticipant(app, coPresenterParams({ trackIds: "t2" }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("This person is already on the session");
    expect(trackChecked(html, "t1", "Track One")).toBe(false);
    expect(trackChecked(html, "t2", "Track Two")).toBe(true);
  });

  it("tracksEditable, all boxes unchecked: the echo is empty, not the DB set (unchecking is a real edit)", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: true });
    const app = buildApp();
    // No trackIds field posted at all -- extractTrackIds returns [].
    const res = await postParticipant(app, coPresenterParams());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(trackChecked(html, "t1", "Track One")).toBe(false);
    expect(trackChecked(html, "t2", "Track Two")).toBe(false);
  });

  it("!tracksEditable (form close date passed): falls back to data.selectedTrackIds regardless of any posted trackIds", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: true });
    loadEditableSubmissionMock.mockResolvedValue(TRACKS_CLOSED_DATA);
    const app = buildApp();
    // Posting t2 must have no effect: tracks are closed, so the checkbox
    // fieldset doesn't even render -- the "Tracks: ..." summary line must
    // still name the DB selection (Track One), not the posted one.
    const res = await postParticipant(app, coPresenterParams({ trackIds: "t2" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Tracks: Track One");
    expect(html).not.toContain("Tracks: Track Two");
  });
});
