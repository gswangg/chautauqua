// DEC-604: route-layer coverage for POST /portal/submissions/:id/participants
// (src/routes/portal/edit.tsx). Kept in a separate file from
// test/portal-copresenter.test.ts because vi.mock is file-scoped/hoisted —
// mocking src/server/repo/portal-edit here would otherwise also replace the
// addCoPresenter implementation the repo-layer unit tests exercise directly.

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
  offeredTrackIds: [],
  allTracks: [],
  selectedTrackIds: [],
};

const CLOSED_DATA: EditableSubmissionData = {
  ...BASE_DATA,
  form: { id: "f1", closeDate: 1000, timezone: "America/Los_Angeles" }, // closed long ago
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
    addCoPresenter: (...args: unknown[]) => addCoPresenterMock(...args),
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
    c.set("db", {} as never);
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

describe("POST /portal/submissions/:id/participants route", () => {
  beforeEach(() => {
    addCoPresenterMock.mockClear();
    loadEditableSubmissionMock.mockReset();
    loadEditableSubmissionMock.mockResolvedValue(BASE_DATA);
  });

  it("renders the edit page directly at 200 on success (DEC-029: a redirect here is what discarded the draft), calling addCoPresenter with the posted fields", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: true });
    const app = buildApp();
    const res = await postParticipant(app, {
      firstName: "Marcus",
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    const [, submitted] = addCoPresenterMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(submitted).toMatchObject({
      submissionId: "s1",
      orgId: "org1",
      firstName: "Marcus",
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
  });

  it("DEC-029: a REFUSAL (duplicate co-presenter) re-renders a posted, unsaved title into the edit form instead of falling back to the stored answer", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: false, errors: { email: "This person is already on the session" } });
    loadEditableSubmissionMock.mockResolvedValue({
      ...BASE_DATA,
      fields: [{ id: "title", kind: "text", label: "Title", required: true, section: "session" } as never],
      answers: { title: "Stored title from the database" },
    });
    const app = buildApp();
    const params = new URLSearchParams();
    params.append("chq_csrf", CSRF_TOKEN);
    params.append("field__title", "A brand new unsaved title");
    params.append("firstName", "Marcus");
    params.append("lastName", "Okafor");
    params.append("email", "marcus@example.com");
    params.append("role", "co-presenter");
    const res = await app.request("/portal/submissions/s1/participants", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `chq_csrf=${CSRF_TOKEN}`,
      },
      body: params.toString(),
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("A brand new unsaved title");
    expect(html).not.toContain("Stored title from the database");
  });

  it("DEC-029: a SUCCESS also re-renders a posted, unsaved title into the edit form instead of the stored answer", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: true });
    loadEditableSubmissionMock.mockResolvedValue({
      ...BASE_DATA,
      fields: [{ id: "title", kind: "text", label: "Title", required: true, section: "session" } as never],
      answers: { title: "Stored title from the database" },
    });
    const app = buildApp();
    const params = new URLSearchParams();
    params.append("chq_csrf", CSRF_TOKEN);
    params.append("field__title", "A brand new unsaved title");
    params.append("firstName", "Marcus");
    params.append("lastName", "Okafor");
    params.append("email", "marcus@example.com");
    params.append("role", "co-presenter");
    const res = await app.request("/portal/submissions/s1/participants", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `chq_csrf=${CSRF_TOKEN}`,
      },
      body: params.toString(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("A brand new unsaved title");
    expect(html).not.toContain("Stored title from the database");
  });

  it("DEC-029: the add persists nothing it posted — only addCoPresenter's own write happens, never a saveSubmissionEdits-shaped write of the draft answers", async () => {
    // The route module never imports saveSubmissionEdits for this handler;
    // the only write path exercised for POST /participants is addCoPresenter
    // itself, called once with exactly the co-presenter fields (never the
    // draft answers) — asserting this against the SAME mocked repo module
    // the route imports is the narrowest proof available at this layer that
    // Save changes stays the only writer of submission answers.
    addCoPresenterMock.mockResolvedValueOnce({ ok: true });
    loadEditableSubmissionMock.mockResolvedValue({
      ...BASE_DATA,
      fields: [{ id: "title", kind: "text", label: "Title", required: true, section: "session" } as never],
      answers: { title: "Stored title from the database" },
    });
    const app = buildApp();
    const params = new URLSearchParams();
    params.append("chq_csrf", CSRF_TOKEN);
    params.append("field__title", "A brand new unsaved title");
    params.append("firstName", "Marcus");
    params.append("lastName", "Okafor");
    params.append("email", "marcus@example.com");
    params.append("role", "co-presenter");
    await app.request("/portal/submissions/s1/participants", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `chq_csrf=${CSRF_TOKEN}`,
      },
      body: params.toString(),
    });
    expect(addCoPresenterMock).toHaveBeenCalledTimes(1);
    const [, submitted] = addCoPresenterMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(submitted).not.toHaveProperty("title");
    expect(submitted).not.toHaveProperty("answers");
    // Re-reading the submission (loadEditableSubmission, the only read the
    // route performs of submission state) still returns the unmodified
    // stored answer — nothing the add posted overwrote it.
    const reread = await loadEditableSubmissionMock();
    expect(reread.answers.title).toBe("Stored title from the database");
  });

  it("DEC-986 class: none of the four co-presenter controls carries `required`, so adding a co-presenter can never block the page's primary Save", async () => {
    const app = buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    const html = await res.text();
    for (const id of ["cp-first-name", "cp-last-name", "cp-email", "cp-role"]) {
      const start = html.indexOf(`id="${id}"`);
      expect(start).toBeGreaterThan(-1);
      // Look at a bounded window around the tag for a `required` attribute
      // rather than the whole document (some other control on the page
      // could legitimately carry one).
      const windowStart = Math.max(0, start - 200);
      const tagWindow = html.slice(windowStart, start + 200);
      expect(tagWindow).not.toMatch(/\brequired\b/);
      expect(tagWindow).toContain('form="chq-portal-edit-form"');
    }
  });

  it("re-renders the edit page with field errors on failure (400, not a redirect)", async () => {
    addCoPresenterMock.mockResolvedValueOnce({ ok: false, errors: { email: "Enter a valid email address" } });
    const app = buildApp();
    const res = await postParticipant(app, {
      firstName: "Marcus",
      lastName: "Okafor",
      email: "not-an-email",
      role: "co-presenter",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Enter a valid email address");
  });

  it("rejects without a matching csrf cookie, never calling addCoPresenter", async () => {
    const app = buildApp();
    const params = new URLSearchParams();
    params.append("chq_csrf", CSRF_TOKEN);
    params.append("firstName", "Marcus");
    params.append("lastName", "Okafor");
    params.append("email", "marcus@example.com");
    params.append("role", "co-presenter");
    const res = await app.request("/portal/submissions/s1/participants", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" }, // no cookie
      body: params.toString(),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(addCoPresenterMock).not.toHaveBeenCalled();
  });

  it("re-checks the edit lock server-side, rejecting even if a client posts after the window closes", async () => {
    loadEditableSubmissionMock.mockResolvedValue(CLOSED_DATA);
    const app = buildApp();
    const res = await postParticipant(app, {
      firstName: "Marcus",
      lastName: "Okafor",
      email: "marcus@example.com",
      role: "co-presenter",
    });
    expect(res.status).toBe(403);
    expect(addCoPresenterMock).not.toHaveBeenCalled();
  });
});
