// Multi-portal decision 73: the Speakers grid narrowed to one portal. Rows
// are the session participations the portal covers (its stored
// memberships), columns are the tasks its items bring, and every count and
// reminder reads just those. Real rows, every migration on node:sqlite.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { reconcileEventPortals } from "../src/server/repo/portals/reconcile";
import { getOnboardingGrid, type OnboardingGridParams } from "../src/server/repo/tasks/grid";
import { findEventPortal, portalReminderScope } from "../src/server/repo/tasks/portal-scope";
import type { PortalRule } from "../src/domain/portals/rules";
import { parseIndexMounts } from "./helpers/index-mounts";
import {
  addContact,
  addEvent,
  addEventRole,
  addOrg,
  addParticipant,
  addPortal,
  addPortalItem,
  addSession,
  addTask,
  makePortalsFixture,
  type Fixture,
} from "./helpers/portals-fixture";

const ORG = "spv-org";
const EVENT = "spv-event";
const OTHER_EVENT = "spv-other";
const DAY = 24 * 60 * 60 * 1000;
const ORGANIZER: AuthInfo = { userId: "spv-user", role: "organizer", orgId: ORG };

const role = (r: string): PortalRule => ({ groups: [{ conditions: [{ field: "role", op: "is", values: [r] }] }] });

// Elliot speaks on one session and moderates another; Ada only speaks, Bo
// only moderates. The speakers portal brings Final slides (overdue), the
// moderators portal Panel prep; Bio is a direct task in neither.
async function world(): Promise<Fixture> {
  const f = makePortalsFixture();
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  addEvent(f, OTHER_EVENT, ORG);
  addContact(f, "spv-ada", ORG, "Ada Lovelace");
  addContact(f, "spv-bo", ORG, "Bo Diaz");
  addContact(f, "spv-elliot", ORG, "Elliot Ekstrom");
  addSession(f, "spv-talk", EVENT, { title: "Engines" });
  addSession(f, "spv-talk2", EVENT, { title: "Looms" });
  addSession(f, "spv-panel", EVENT, { title: "Lunch panel" });
  addParticipant(f, "spv-p-elliot-talk", "spv-talk", "spv-elliot", { role: "speaker" });
  addParticipant(f, "spv-p-ada", "spv-talk2", "spv-ada", { role: "speaker" });
  addParticipant(f, "spv-p-elliot-panel", "spv-panel", "spv-elliot", { role: "moderator" });
  addParticipant(f, "spv-p-bo", "spv-panel", "spv-bo", { role: "moderator" });
  addTask(f, "spv-slides", EVENT, { title: "Final slides" });
  addTask(f, "spv-prep", EVENT, { title: "Panel prep" });
  addTask(f, "spv-bio", EVENT, { title: "Bio" });
  f.run(`update task set audience = 'portal' where id in ('spv-slides', 'spv-prep')`);
  addPortal(f, "spv-speakers", EVENT, role("speaker"), { name: "Speakers" });
  addPortal(f, "spv-mods", EVENT, role("moderator"), { name: "Moderators", position: 2 });
  addPortal(f, "spv-empty", EVENT, role("speaker"), { name: "Nothing to do", position: 3 });
  addPortal(f, "spv-elsewhere", OTHER_EVENT, role("speaker"), { name: "Other event" });
  addPortalItem(f, "spv-i-slides", "spv-speakers", { taskId: "spv-slides" }, { deadlineKind: "fixed", dueDate: f.now - 5 * DAY, required: true });
  addPortalItem(f, "spv-i-prep", "spv-mods", { taskId: "spv-prep" }, { deadlineKind: "fixed", dueDate: f.now + 30 * DAY });
  // Cy is a speaker by event role, with no session: the speakers portal
  // covers Cy, but Cy isn't on the speaker roster
  addContact(f, "spv-cy", ORG, "Cy Twombly");
  addEventRole(f, "spv-r-cy", EVENT, "spv-cy", "speaker");
  await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
  f.run(
    `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('spv-a-bio', 'spv-bio', 'spv-ada', 'pending', ?, ?)`,
    f.now,
    f.now,
  );
  // Ada has done her slides; Elliot hasn't
  f.run(`update task_assignment set status = 'complete', completed_at = ? where task_id = 'spv-slides' and contact_id = 'spv-ada'`, f.now);
  return f;
}

function params(f: Fixture, portalId: string | null): OnboardingGridParams {
  return { page: 1, perPage: 50, q: null, taskId: null, status: null, overdueOnly: false, inviteStatus: null, portalId, now: f.now };
}

describe("Speakers grid · one portal's view", () => {
  it("without a portal, lists every speaker and every task", async () => {
    const f = await world();
    const grid = await getOnboardingGrid(f.db, EVENT, params(f, null));
    expect(grid.tasks.map((t) => t.title).sort()).toEqual(["Bio", "Final slides", "Panel prep"]);
    // by last name
    expect(grid.rows.map((r) => r.contact.name)).toEqual(["Bo Diaz", "Elliot Ekstrom", "Ada Lovelace"]);
    expect(grid.counts.speakers).toBe(3);
    f.sqlite.close();
  });

  it("narrows rows, columns, sessions and counts to the speakers portal", async () => {
    const f = await world();
    const grid = await getOnboardingGrid(f.db, EVENT, params(f, "spv-speakers"));
    expect(grid.tasks.map((t) => t.title)).toEqual(["Final slides"]);
    expect(grid.tasks[0]).toMatchObject({ assigned: 2, complete: 1 });
    expect(grid.rows.map((r) => r.contact.name)).toEqual(["Elliot Ekstrom", "Ada Lovelace"]);
    // Elliot's panel belongs to the moderators portal, not this one
    const elliot = grid.rows.find((r) => r.contact.id === "spv-elliot")!;
    expect(elliot.contact.participations.map((p) => p.title)).toEqual(["Engines"]);
    expect(elliot.cells.map((c) => c.taskId)).toEqual(["spv-slides"]);
    expect(grid.total).toBe(2);
    // Cy holds the overdue slides too, but has no row, so isn't counted
    expect(f.all(`select status from task_assignment where contact_id = 'spv-cy'`)).toHaveLength(1);
    expect(grid.counts).toMatchObject({ speakers: 2, overdue: 1 });
    expect(grid.tasks[0]).toMatchObject({ assigned: 2 });
    f.sqlite.close();
  });

  it("gives the moderators portal its own people and items", async () => {
    const f = await world();
    const grid = await getOnboardingGrid(f.db, EVENT, params(f, "spv-mods"));
    expect(grid.tasks.map((t) => t.title)).toEqual(["Panel prep"]);
    expect(grid.rows.map((r) => r.contact.name)).toEqual(["Bo Diaz", "Elliot Ekstrom"]);
    const elliot = grid.rows.find((r) => r.contact.id === "spv-elliot")!;
    expect(elliot.contact.participations.map((p) => p.title)).toEqual(["Lunch panel"]);
    expect(grid.counts).toMatchObject({ speakers: 2, overdue: 0 });
    f.sqlite.close();
  });

  it("keeps the overdue filter inside the portal's own columns", async () => {
    const f = await world();
    const overdue = { ...params(f, "spv-mods"), overdueOnly: true };
    expect((await getOnboardingGrid(f.db, EVENT, overdue)).rows).toEqual([]);
    const speakers = { ...params(f, "spv-speakers"), overdueOnly: true };
    expect((await getOnboardingGrid(f.db, EVENT, speakers)).rows.map((r) => r.contact.name)).toEqual(["Elliot Ekstrom"]);
    f.sqlite.close();
  });

  it("scopes reminders to the portal's members and task items", async () => {
    const f = await world();
    const portal = (await findEventPortal(f.db, EVENT, "spv-speakers"))!;
    const scope = await portalReminderScope(f.db, EVENT, portal, undefined, undefined);
    expect(scope.taskIds).toEqual(["spv-slides"]);
    // the people on its sessions: Cy (an event role) has no row to remind from
    expect(scope.contactIds.sort()).toEqual(["spv-ada", "spv-elliot"]);
    // the caller's own ids narrow it further, never widen it
    expect(await portalReminderScope(f.db, EVENT, portal, undefined, ["spv-elliot", "spv-bo"])).toEqual({
      taskIds: ["spv-slides"],
      contactIds: ["spv-elliot"],
    });
    const empty = (await findEventPortal(f.db, EVENT, "spv-empty"))!;
    expect((await portalReminderScope(f.db, EVENT, empty, undefined, undefined)).taskIds).toEqual([]);
    expect(await findEventPortal(f.db, EVENT, "spv-elsewhere")).toBeNull();
    f.sqlite.close();
  });
});

async function buildApp(f: Fixture) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", f.db);
    c.set("auth", ORGANIZER);
    await next();
  });
  registerErrorHandler(app);
  for (const { prefix, subApp } of await parseIndexMounts()) app.route(prefix, subApp);
  return app;
}

describe("Speakers grid · the portal parameter on the routes", () => {
  it("serves one portal's grid, and refuses another event's portal or an unknown one", async () => {
    const f = await world();
    const app = await buildApp(f);
    const ok = await app.request(`/api/v1/events/${EVENT}/onboarding?portalId=spv-mods`);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { tasks: { title: string }[]; total: number };
    expect(body.tasks.map((t) => t.title)).toEqual(["Panel prep"]);
    expect(body.total).toBe(2);
    expect((await app.request(`/api/v1/events/${EVENT}/onboarding?portalId=spv-elsewhere`)).status).toBe(404);
    expect((await app.request(`/api/v1/events/${EVENT}/onboarding?portalId=nope`)).status).toBe(404);
    f.sqlite.close();
  });

  it("previews nobody for a portal with no task items, rather than reading it as no filter", async () => {
    const f = await world();
    const app = await buildApp(f);
    const res = await app.request(`/api/v1/events/${EVENT}/onboarding/remind/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ portalId: "spv-empty" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ drafts: [], skipped: 0, remaining: 0 });
    const foreign = await app.request(`/api/v1/events/${EVENT}/onboarding/remind/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ portalId: "spv-elsewhere" }),
    });
    expect(foreign.status).toBe(404);
    f.sqlite.close();
  });
});
