// DEC-747 (findings wave 7 amendment): GET /portal/preview is organizer-only
// and renders the producer's OWN portal configuration read-only — never a
// speaker's own submissions/tasks/files. Every other role (anonymous,
// reviewer, speaker) gets the same 404 card shared.tsx's speakerGate already
// renders for an unknown /portal/* path, never a redirect.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { portalPreviewRoutes } from "../src/routes/portal/preview";
import { registerNotFoundHandler } from "../src/server/not-found";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import * as schema from "../src/db/schema";

const EVENT_ID = "evt-1";
const ORG_ID = "org-1";

function fakeDb(): Db {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === schema.event) {
          return {
            where: () => ({
              limit: async () => [
                {
                  id: EVENT_ID,
                  orgId: ORG_ID,
                  name: "Test Conf",
                  slug: "test-conf",
                  startDate: "2026-01-01",
                  endDate: "2026-01-02",
                  location: null,
                  timezone: "America/Chicago",
                  recordPrefix: "TC",
                  brandingJson: null,
                  createdAt: new Date(0),
                  updatedAt: new Date(0),
                },
              ],
            }),
          };
        }
        if (table === schema.portalSettings) {
          return {
            where: () => ({
              limit: async () => [
                {
                  id: "ps-1",
                  eventId: EVENT_ID,
                  logoUrl: null,
                  accentColor: null,
                  welcomeMessage: "Welcome, speakers!",
                  showResources: true,
                  createdAt: new Date(0),
                  updatedAt: new Date(0),
                },
              ],
            }),
          };
        }
        if (table === schema.resource) {
          return {
            where: () => ({
              orderBy: async () => [
                {
                  id: "res-1",
                  eventId: EVENT_ID,
                  kind: "wiki",
                  title: "Travel info",
                  content: "Fly into AUS.",
                  fileId: null,
                  position: 0,
                  createdAt: new Date(0),
                  updatedAt: new Date(0),
                },
              ],
            }),
          };
        }
        if (table === schema.org) {
          return { orderBy: () => ({ limit: async () => [] }) };
        }
        return { where: () => ({ limit: async () => [] }) };
      },
    }),
  } as unknown as Db;
}

function buildApp(auth?: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb());
    if (auth) c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalPreviewRoutes);
  registerNotFoundHandler(app);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_ID };
const REVIEWER: AuthInfo = { userId: "u3", role: "reviewer", orgId: ORG_ID };
const SPEAKER: AuthInfo = { userId: "u2", role: "speaker", orgId: ORG_ID, contactId: "c1" };

describe("GET /portal/preview (DEC-747 findings wave 7 amendment)", () => {
  it("organizer: 200 with the read-only banner and the event's own welcome message + resources", async () => {
    const app = buildApp(ORGANIZER);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(
      "Preview · read-only. This is the portal your speakers see — no speaker&#39;s own submissions, tasks or files appear here.",
    );
    expect(body).toContain("Welcome, speakers!");
    expect(body).toContain("Travel info");
  });

  it("organizer: renders zero mutating controls — no form other than the shared sign-out form, no upload/edit/decision button or link, and the one Download button per resource is disabled (DEC-733 exception)", async () => {
    const app = buildApp(ORGANIZER);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    const body = await res.text();
    // The shared chrome's sign-out <form action="/logout"> is expected
    // (DEC-154, every /portal/* page carries it) — assert there is exactly
    // one <form> on the page and it is that one.
    const formMatches = body.match(/<form/g) ?? [];
    expect(formMatches.length).toBe(1);
    expect(body).toContain('action="/logout"');
    // Two buttons: the shared chrome's own Sign out control, plus one
    // disabled Download per resource row (the fixture has one resource).
    // DEC-747's frame ruling names this the one sanctioned disabled
    // control on the surface — DEC-733's absent-not-disabled rule does not
    // apply because the capability genuinely exists for the speaker.
    const buttonMatches = body.match(/<button/g) ?? [];
    expect(buttonMatches.length).toBe(2);
    expect(body).toContain(">Sign out<");
    expect(body).toMatch(/<button[^>]*disabled[^>]*>\s*Download\s*<\/button>/);
    expect(body).not.toMatch(/<a [^>]*>\s*(Upload|Edit submission|Accept|Decline)/);
  });

  it("organizer: renders the 'Not shown here' section, the honest impersonation-truth sentence, and a plain link back to settings", async () => {
    const app = buildApp(ORGANIZER);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    const body = await res.text();
    expect(body).toContain("Not shown here");
    expect(body).toContain("Their submissions");
    expect(body).toContain("Their tasks");
    expect(body).toContain("Their uploaded files");
    expect(body).toContain("you would have to be them");
    // A plain link, never a form or button, per the route's no-mutation
    // invariant.
    expect(body).toMatch(/<a href="\/settings\?section=portal">[^<]*Back to settings<\/a>/);
  });

  it("organizer with no eventId / an eventId belonging to another org: 404, not a crash or another org's data", async () => {
    const app = buildApp(ORGANIZER);
    const noId = await app.request("/portal/preview");
    expect(noId.status).toBe(404);

    const app2 = new Hono<AppEnv>();
    app2.use("*", async (c, next) => {
      c.set("db", {
        select: () => ({
          from: (table: unknown) => {
            if (table === schema.event) return { where: () => ({ limit: async () => [] }) };
            if (table === schema.org) return { orderBy: () => ({ limit: async () => [] }) };
            return { where: () => ({ limit: async () => [] }) };
          },
        }),
      } as unknown as Db);
      c.set("auth", ORGANIZER);
      await next();
    });
    registerErrorHandler(app2);
    app2.route("/portal", portalPreviewRoutes);
    registerNotFoundHandler(app2);
    const foreign = await app2.request("/portal/preview?eventId=someone-elses-event");
    expect(foreign.status).toBe(404);
  });

  it("anonymous: 404, never a redirect", async () => {
    const app = buildApp();
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    const body = await res.text();
    expect(body).toContain("That page isn&#39;t here");
  });

  it("reviewer: 404, never a redirect", async () => {
    const app = buildApp(REVIEWER);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("speaker: 404, never a redirect (this is a producer-facing preview, not a speaker route)", async () => {
    const app = buildApp(SPEAKER);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });
});
