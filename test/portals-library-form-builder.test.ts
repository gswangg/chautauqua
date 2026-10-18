// Multi-portal: a library form item's questions are built in the form
// builder, which opens it with ?form=<id> (decision 60). The read is
// scoped like every other forms route: the form must belong to the event
// in the path, and the event to the caller's org. Runs every route through
// the real index mounts on the migrated schema (node:sqlite).
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { parseIndexMounts } from "./helpers/index-mounts";
import { addEvent, addOrg, makePortalsFixture, type Fixture } from "./helpers/portals-fixture";

const ORG = "lfb-org";
const OTHER_ORG = "lfb-other-org";
const ORGANIZER: AuthInfo = { userId: "lfb-user", role: "organizer", orgId: ORG };

function addForm(f: Fixture, id: string, eventId: string, title: string, isDefault: boolean): void {
  f.run(
    `insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
    id,
    eventId,
    title,
    isDefault ? 1 : 0,
    f.now,
    f.now,
  );
}

function seed(f: Fixture): void {
  addOrg(f, ORG);
  addOrg(f, OTHER_ORG);
  addEvent(f, "lfb-event", ORG);
  addEvent(f, "lfb-sibling", ORG);
  addEvent(f, "lfb-foreign", OTHER_ORG);
  addForm(f, "lfb-travel", "lfb-event", "Travel form", false);
  addForm(f, "lfb-sibling-form", "lfb-sibling", "Sibling travel form", false);
  addForm(f, "lfb-foreign-form", "lfb-foreign", "Foreign travel form", false);
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

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json", "x-chq-csrf": "1" }, body: JSON.stringify(body) };
}

describe("form builder · a library form item (?form=)", () => {
  it("opens the event's library form with its own questions, and the CFP form without the parameter", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);

    const added = await app.request(
      "/api/v1/forms/lfb-travel/fields",
      json("POST", { section: "session", kind: "text", label: "Arrival date", required: true }),
    );
    expect(added.status).toBe(201);

    const res = await app.request("/api/v1/events/lfb-event/forms?form=lfb-travel");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; title: string; isDefault: boolean; fields: { label: string }[]; forms: { id: string }[] };
    expect(body).toMatchObject({ id: "lfb-travel", title: "Travel form", isDefault: false });
    expect(body.fields.map((x) => x.label)).toEqual(["Arrival date"]);
    expect(body.forms.map((x) => x.id)).toContain("lfb-travel");

    const cfp = await app.request("/api/v1/events/lfb-event/forms");
    expect(cfp.status).toBe(200);
    const cfpBody = (await cfp.json()) as { id: string; isDefault: boolean; fields: { label: string }[] };
    expect(cfpBody.isDefault).toBe(true);
    expect(cfpBody.id).not.toBe("lfb-travel");
    expect(cfpBody.fields.map((x) => x.label)).not.toContain("Arrival date");
  });

  it("refuses a form from another event of the same org, or from another org", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);

    const sibling = await app.request("/api/v1/events/lfb-event/forms?form=lfb-sibling-form");
    expect(sibling.status).toBe(404);
    const foreign = await app.request("/api/v1/events/lfb-event/forms?form=lfb-foreign-form");
    expect(foreign.status).toBe(404);
    const unknown = await app.request("/api/v1/events/lfb-event/forms?form=no-such-form");
    expect(unknown.status).toBe(404);
  });
});
