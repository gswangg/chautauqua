// Multi-portal decision 76: portals are the one rule engine for tasks.
// Acceptance creates no tasks of its own (DEC-009's default set and the
// 'everyone' back-fill are retired); a group gets a task because a portal
// lists it; a task made on Speakers goes to a portal or to named people
// (or to nobody yet); and migrations/0047 turned every 'everyone' task into
// a hand-picked list of the people who already had it. The client's
// must-have onboarding forms (docs/clarifications.md) ride the CFP speakers
// portal new events start with. Real rows, every migration on node:sqlite.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { reconcileEventPortals } from "../src/server/repo/portals/reconcile";
import { createPortalFromTemplate } from "../src/server/repo/portals/admin";
import { parseIndexMounts } from "./helpers/index-mounts";
import {
  ACCEPTED_SESSIONS,
  addContact,
  addEvent,
  addOrg,
  addParticipant,
  addPortal,
  addPortalItem,
  addSession,
  addTask,
  makePortalsFixture,
  type Fixture,
} from "./helpers/portals-fixture";

const ORG = "one-org";
const EVENT = "one-event";
const ORGANIZER: AuthInfo = { userId: "one-user", role: "organizer", orgId: ORG };

function world(): Fixture {
  const f = makePortalsFixture();
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  addContact(f, "one-ada", ORG, "Ada Lovelace");
  addContact(f, "one-bo", ORG, "Bo Diaz");
  addSession(f, "one-talk", EVENT, { status: "pending" });
  addSession(f, "one-panel", EVENT);
  addParticipant(f, "one-p-ada", "one-talk", "one-ada");
  addParticipant(f, "one-p-bo", "one-panel", "one-bo");
  addTask(f, "one-slides", EVENT, { title: "Final slides" });
  f.run(`update task set audience = 'portal' where id = 'one-slides'`);
  addPortal(f, "one-speakers", EVENT, ACCEPTED_SESSIONS, { name: "Speakers" });
  addPortalItem(f, "one-i-slides", "one-speakers", { taskId: "one-slides" }, { required: true });
  return f;
}

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

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json", "x-chq-csrf": "1" }, body: JSON.stringify(body) });

describe("one rule engine (decision 76)", () => {
  it("accepting a talk creates no tasks itself; the portals that cover the speaker bring theirs", async () => {
    const f = world();
    const before = f.all<{ n: number }>(`select count(*) as n from task`)[0]!.n;
    await updateSubmissionStatuses(f.db, EVENT, ["one-talk"], "accepted", new Date(f.now));
    expect(f.all<{ n: number }>(`select count(*) as n from task`)[0]!.n).toBe(before);
    expect(f.all(`select id from task_assignment where contact_id = 'one-ada'`)).toEqual([]);
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    expect(f.all(`select task_id, source from task_assignment where contact_id = 'one-ada'`)).toEqual([{ task_id: "one-slides", source: "portal" }]);
    f.sqlite.close();
  });

  it("a task made for a portal becomes that portal's item, and its people get it", async () => {
    const f = world();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    const app = await buildApp(f);
    const res = await app.request(`/api/v1/events/${EVENT}/tasks`, json({ kind: "general", title: "AV needs", required: true, dueDate: null, portalId: "one-speakers" }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(f.all(`select audience from task where id = ?`, id)).toEqual([{ audience: "portal" }]);
    expect(f.all(`select portal_id, required from portal_item where task_id = ?`, id)).toEqual([{ portal_id: "one-speakers", required: 1 }]);
    expect(f.all(`select contact_id, source from task_assignment where task_id = ?`, id)).toEqual([{ contact_id: "one-bo", source: "portal" }]);
    f.sqlite.close();
  });

  it("a task for named people stays theirs alone; with nobody named it waits for people", async () => {
    const f = world();
    const app = await buildApp(f);
    const named = await app.request(`/api/v1/events/${EVENT}/tasks`, json({ kind: "general", title: "Promo video", required: false, dueDate: null, contactIds: ["one-bo"] }));
    expect(named.status).toBe(201);
    const namedId = ((await named.json()) as { id: string }).id;
    expect(f.all(`select audience from task where id = ?`, namedId)).toEqual([{ audience: "targeted" }]);
    expect(f.all(`select contact_id, source from task_assignment where task_id = ?`, namedId)).toEqual([{ contact_id: "one-bo", source: "direct" }]);

    const nobody = await app.request(`/api/v1/events/${EVENT}/tasks`, json({ kind: "general", title: "Later", required: false, dueDate: null }));
    expect(nobody.status).toBe(201);
    const nobodyId = ((await nobody.json()) as { id: string }).id;
    expect(f.all(`select audience from task where id = ?`, nobodyId)).toEqual([{ audience: "targeted" }]);
    expect(f.all(`select id from task_assignment where task_id = ?`, nobodyId)).toEqual([]);

    const both = await app.request(`/api/v1/events/${EVENT}/tasks`, json({ kind: "general", title: "Both", required: false, dueDate: null, portalId: "one-speakers", contactIds: ["one-bo"] }));
    expect(both.status).toBe(400);
    const foreign = await app.request(`/api/v1/events/${EVENT}/tasks`, json({ kind: "general", title: "Foreign", required: false, dueDate: null, portalId: "nope" }));
    expect(foreign.status).toBe(400);
    f.sqlite.close();
  });

  it("hand-picking (decision 77) gives a portal's task to someone it doesn't cover, and a reconcile keeps it", async () => {
    const f = world();
    // Ada's talk is accepted (she's on the roster) and the portal now covers panelists only, so nobody
    f.run(`update submission set status = 'accepted' where id = 'one-talk'`);
    f.run(`update portal set rule_json = ? where id = 'one-speakers'`, JSON.stringify({ groups: [{ conditions: [{ field: "role", op: "is_any_of", values: ["panelist"] }] }] }));
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    expect(f.all(`select contact_id from task_assignment where task_id = 'one-slides'`)).toEqual([]);
    const app = await buildApp(f);
    const res = await app.request(`/api/v1/tasks/one-slides/assign`, json({ contactIds: ["one-ada"] }));
    expect(res.status).toBe(200);
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    expect(f.all(`select contact_id, source from task_assignment where task_id = 'one-slides'`)).toEqual([{ contact_id: "one-ada", source: "direct" }]);
    f.sqlite.close();
  });

  it("the CFP speakers template gives an accepted speaker the must-have hotel and flight forms, each with its real form", async () => {
    const f = world();
    await createPortalFromTemplate(f.db, EVENT, "cfp_speakers", new Date(f.now));
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    const forms = f.all<{ title: string; kind: string; fields: number; contact_id: string }>(
      `select t.title, t.kind, (select count(*) from form_field ff where ff.form_id = t.form_id) as fields, ta.contact_id
         from task t join task_assignment ta on ta.task_id = t.id
        where t.title in ('Hotel stay requirement form', 'Flight reimbursement form') order by t.title`,
    );
    expect(forms.map((r) => [r.title, r.kind, r.contact_id])).toEqual([
      ["Flight reimbursement form", "form", "one-bo"],
      ["Hotel stay requirement form", "form", "one-bo"],
    ]);
    for (const r of forms) expect(r.fields).toBeGreaterThan(0);
    f.sqlite.close();
  });

  it("migration 0047 makes every 'everyone' task a hand-picked list, keeping who has it", () => {
    const f = world();
    addTask(f, "one-hotel", EVENT, { title: "Hotel stay requirement form" });
    f.run(`update task set audience = 'everyone' where id = 'one-hotel'`);
    f.run(`insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('one-a-hotel', 'one-hotel', 'one-ada', 'pending', ?, ?)`, f.now, f.now);
    f.sqlite.exec(readFileSync(join(__dirname, "..", "migrations", "0047_task_audience_everyone_retired.sql"), "utf8"));
    expect(f.all(`select audience from task where id = 'one-hotel'`)).toEqual([{ audience: "targeted" }]);
    expect(f.all(`select contact_id from task_assignment where task_id = 'one-hotel'`)).toEqual([{ contact_id: "one-ada" }]);
    expect(f.all(`select count(*) as n from task where audience = 'everyone'`)).toEqual([{ n: 0 }]);
    f.sqlite.close();
  });
});
