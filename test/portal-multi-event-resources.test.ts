// DEC-988 (wave-74 amendment): portal resource visibility is resolved PER
// EVENT, not by the portal's single "most recent submission" branding
// event. This file proves the multi-event contract end to end against a
// real sqlite db (same makeTestDb technique as test/fresh-event-no-seed.test.ts):
// a contact who participates in Event A (Resources on) and Event B
// (Resources off) sees only A's group in the resources list, A's download
// succeeds, B's 404s -- then flipping both events' flags mirrors the
// result. A task-only speaker (no submission at all) is covered too, since
// getPortalData's showResourcesByEventId population is the UNION of
// submission and task-assignment events, not submissions alone.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { registerNotFoundHandler } from "../src/server/not-found";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import { getPortalData } from "../src/server/repo/portal/data";
import { portalResourcesRoutes } from "../src/routes/portal/tasks/resources";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

function fakeFilesBucket(contents: Map<string, string>) {
  return {
    async put() {
      return undefined;
    },
    async get(key: string) {
      const body = contents.get(key);
      if (body === undefined) return null;
      return { body: new Response(body).body, size: body.length };
    },
    async head() {
      return null;
    },
    async delete() {
      return undefined;
    },
  } as never;
}

describe("DEC-988 (wave-74): portal resource visibility is per event", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const now = new Date();

  let orgId: string;
  let eventAId: string;
  let eventBId: string;
  let contactId: string;
  let resourceAFileId: string;
  let resourceAId: string;
  let resourceBFileId: string;
  let resourceBId: string;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    orgId = newId();
    eventAId = newId();
    eventBId = newId();
    contactId = newId();

    await db.insert(schema.org).values({ id: orgId, name: "Org", createdAt: now, updatedAt: now });

    for (const [eventId, name, prefix] of [
      [eventAId, "Event A", "EVA"],
      [eventBId, "Event B", "EVB"],
    ] as const) {
      await db.insert(schema.event).values({
        id: eventId,
        orgId,
        name,
        slug: `slug-${eventId}`,
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        timezone: "UTC",
        recordPrefix: prefix,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.insert(schema.contact).values({
      id: contactId,
      orgId,
      firstName: "Priya",
      lastName: "Raman",
      email: "priya@example.com",
      createdAt: now,
      updatedAt: now,
    });

    // Event A: a real submission the contact speaks on (accepted invite).
    const submissionAId = newId();
    await db.insert(schema.submission).values({
      id: submissionAId,
      eventId: eventAId,
      seq: 1,
      title: "A Talk",
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.participant).values({
      id: newId(),
      submissionId: submissionAId,
      contactId,
      role: "speaker",
      inviteStatus: "accepted",
      createdAt: now,
      updatedAt: now,
    });

    // Event B: a real submission too (getMyResources/getMyEventIds' own
    // population is submission-based, per its own docstring -- unaffected
    // by this task), PLUS a task assignment, so the resource-list/download
    // scenarios below exercise a genuine two-event speaker.
    const submissionBId = newId();
    await db.insert(schema.submission).values({
      id: submissionBId,
      eventId: eventBId,
      seq: 1,
      title: "B Talk",
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.participant).values({
      id: newId(),
      submissionId: submissionBId,
      contactId,
      role: "speaker",
      inviteStatus: "accepted",
      createdAt: now,
      updatedAt: now,
    });
    const taskBId = newId();
    await db.insert(schema.task).values({
      id: taskBId,
      eventId: eventBId,
      kind: "general",
      title: "Some task",
      required: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.taskAssignment).values({
      id: newId(),
      taskId: taskBId,
      contactId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // portal_settings: A on, B off.
    await db.insert(schema.portalSettings).values({
      id: newId(),
      eventId: eventAId,
      showResources: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.portalSettings).values({
      id: newId(),
      eventId: eventBId,
      showResources: false,
      createdAt: now,
      updatedAt: now,
    });

    // One file resource per event.
    resourceAFileId = newId();
    await db.insert(schema.file).values({
      id: resourceAFileId,
      submissionId: null,
      kind: "handout",
      filename: "a.pdf",
      r2Key: "r2/a.pdf",
      sizeBytes: 3,
      contentType: "application/pdf",
      createdAt: now,
      updatedAt: now,
    });
    resourceAId = newId();
    await db.insert(schema.resource).values({
      id: resourceAId,
      eventId: eventAId,
      kind: "file",
      title: "A resource",
      fileId: resourceAFileId,
      position: 0,
      createdAt: now,
      updatedAt: now,
    });

    resourceBFileId = newId();
    await db.insert(schema.file).values({
      id: resourceBFileId,
      submissionId: null,
      kind: "handout",
      filename: "b.pdf",
      r2Key: "r2/b.pdf",
      sizeBytes: 3,
      contentType: "application/pdf",
      createdAt: now,
      updatedAt: now,
    });
    resourceBId = newId();
    await db.insert(schema.resource).values({
      id: resourceBId,
      eventId: eventBId,
      kind: "file",
      title: "B resource",
      fileId: resourceBFileId,
      position: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  it("getPortalData resolves showResourcesByEventId per event", async () => {
    const data = await getPortalData(db, contactId, orgId);
    expect(data.showResourcesByEventId).toEqual({ [eventAId]: true, [eventBId]: false });
    // Branding (chrome) carries no showResources field at all.
    expect(data.branding).not.toHaveProperty("showResources");
  });

  it("a task-only speaker (no submission anywhere) still gets that event's flag via the task-assignment union", async () => {
    const taskOnlyContactId = newId();
    await db.insert(schema.contact).values({
      id: taskOnlyContactId,
      orgId,
      firstName: "Marcus",
      lastName: "Okafor",
      email: "marcus@example.com",
      createdAt: now,
      updatedAt: now,
    });
    const taskId = newId();
    await db.insert(schema.task).values({
      id: taskId,
      eventId: eventBId,
      kind: "general",
      title: "Onboarding",
      required: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.taskAssignment).values({
      id: newId(),
      taskId,
      contactId: taskOnlyContactId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    const data = await getPortalData(db, taskOnlyContactId, orgId);
    // Event A never appears (no submission, no task) -- only B, via the
    // task-assignment side of the union, with B's real flag (false).
    expect(data.showResourcesByEventId).toEqual({ [eventBId]: false });
  });

  const speakerAuth = (): AuthInfo => ({ userId: "u-1", role: "speaker", orgId, contactId });

  function buildApp(filesContents: Map<string, string>) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth());
      c.set("db", db);
      c.env = { FILES: fakeFilesBucket(filesContents) } as never;
      await next();
    });
    app.route("/portal", portalResourcesRoutes);
    registerNotFoundHandler(app);
    return app;
  }

  it("A on / B off: list shows only A's group, A's download succeeds, B's 404s", async () => {
    const app = buildApp(new Map([["r2/a.pdf", "hello-a"]]));

    const list = await app.request("/portal/resources");
    expect(list.status).toBe(200);
    const listBody = await list.text();
    expect(listBody).toContain("A resource");
    expect(listBody).not.toContain("B resource");

    const okDownload = await app.request(`/portal/resources/${resourceAId}/download`);
    expect(okDownload.status).toBe(200);

    const refusedDownload = await app.request(`/portal/resources/${resourceBId}/download`);
    expect(refusedDownload.status).toBe(404);
  });

  it("mirror: flip A off / B on -> list shows only B, B's download succeeds, A's 404s", async () => {
    await db.update(schema.portalSettings).set({ showResources: false }).where(eq(schema.portalSettings.eventId, eventAId));
    await db.update(schema.portalSettings).set({ showResources: true }).where(eq(schema.portalSettings.eventId, eventBId));

    const app = buildApp(new Map([["r2/b.pdf", "hello-b"]]));

    const list = await app.request("/portal/resources");
    expect(list.status).toBe(200);
    const listBody = await list.text();
    expect(listBody).toContain("B resource");
    expect(listBody).not.toContain("A resource");

    const okDownload = await app.request(`/portal/resources/${resourceBId}/download`);
    expect(okDownload.status).toBe(200);

    const refusedDownload = await app.request(`/portal/resources/${resourceAId}/download`);
    expect(refusedDownload.status).toBe(404);
  });

  it("both events off: the resources list itself 404s (no permitted group remains)", async () => {
    await db.update(schema.portalSettings).set({ showResources: false }).where(eq(schema.portalSettings.eventId, eventAId));

    const app = buildApp(new Map());
    const list = await app.request("/portal/resources");
    expect(list.status).toBe(404);
  });
});
