// DEC-613 (amendment, wave 23) receipts: a request body of literal `null`
// is valid JSON, so the old `c.req.json().catch(...)` pattern never fires
// its catch and the next line dereferences null -- an unhandled 500
// `internal` instead of the house 400 `invalid` envelope src/server/http.ts
// exists to guarantee. Every route converted to readJsonBody(c) this wave
// must now refuse both `null` and `[]` bodies (readJsonBody refuses any
// non-array-object value, arrays included) with a clean 400, never a 500.
//
// One real app.request() per touched route FILE, posting 'null' and '[]' as
// the raw body -- mirrors the buildApp/mocked-repo pattern established by
// test/forms-field-delete-cascade-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const FAKE_EVENT = { id: "event-1", orgId: "org-1", name: "Test Event" };
const FAKE_FORM = { id: "form-1", eventId: "event-1", orgId: "org-1", title: "CFP", intro: null, openDate: null, closeDate: null, tracksJson: null };

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === FAKE_EVENT.id && orgId === FAKE_EVENT.orgId ? FAKE_EVENT : null,
    ),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    findFormForOrg: vi.fn(async (_db: unknown, formId: string, orgId: string) =>
      formId === FAKE_FORM.id && orgId === FAKE_FORM.orgId ? FAKE_FORM : null,
    ),
  };
});

function mountedApp(routes: unknown) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", ORGANIZER);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", routes as never);
  return app;
}

async function postRaw(app: Hono<AppEnv>, path: string, raw: string) {
  return app.request(path, {
    method: "POST",
    headers: { "x-chq-csrf": "1", "content-type": "application/json" },
    body: raw,
  });
}

async function patchRaw(app: Hono<AppEnv>, path: string, raw: string) {
  return app.request(path, {
    method: "PATCH",
    headers: { "x-chq-csrf": "1", "content-type": "application/json" },
    body: raw,
  });
}

async function expectInvalid400(res: Response) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBe("invalid");
}

describe("DEC-613 wave-23 receipts: null/array bodies refuse 400, never 500", () => {
  it("comms/preview.ts POST .../compose/preview", async () => {
    const { previewRoutes } = await import("../src/routes/comms/preview");
    const app = mountedApp(previewRoutes);
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/compose/preview`, "null"));
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/compose/preview`, "[]"));
  });

  it("comms/send.ts POST .../compose/send", async () => {
    const { sendRoutes } = await import("../src/routes/comms/send");
    const app = mountedApp(sendRoutes);
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/compose/send`, "null"));
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/compose/send`, "[]"));
  });

  it("comms/templates.ts POST .../templates", async () => {
    const { templatesRoutes } = await import("../src/routes/comms/templates");
    const app = mountedApp(templatesRoutes);
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/templates`, "null"));
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/templates`, "[]"));
  });

  it("comms/portal-invites.ts POST .../portal-invites", async () => {
    const { portalInvitesRoutes } = await import("../src/routes/comms/portal-invites");
    const app = mountedApp(portalInvitesRoutes);
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/portal-invites`, "null"));
    await expectInvalid400(await postRaw(app, `/api/v1/events/${FAKE_EVENT.id}/portal-invites`, "[]"));
  });

  it("api/forms.ts PATCH .../forms/:formId", async () => {
    const { formsRoutes } = await import("../src/routes/api/forms");
    const app = mountedApp(formsRoutes);
    await expectInvalid400(await patchRaw(app, `/api/v1/forms/${FAKE_FORM.id}`, "null"));
    await expectInvalid400(await patchRaw(app, `/api/v1/forms/${FAKE_FORM.id}`, "[]"));
  });
});
