// audit_event is written by preview-as-participant and by the sensitive
// portal actions (rule, permission and entitlement changes; sponsor-session
// decisions). Driven through the real routes against real rows (every
// migration on node:sqlite), signed in as an organizer, so a route that
// stops writing its row fails here.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { parseIndexMounts } from "./helpers/index-mounts";
import {
  ACCEPTED_SESSIONS,
  addContact,
  addEvent,
  addOrg,
  addParticipant,
  addPortal,
  addSession,
  addSponsor,
  addSponsorContact,
  addTier,
  makePortalsFixture,
  type Fixture,
} from "./helpers/portals-fixture";

const ORG = "aud-org";
const EVENT = "aud-event";
const ORGANIZER: AuthInfo = { userId: "aud-user", role: "organizer", orgId: ORG };

function seed(f: Fixture): void {
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  f.run(
    `insert into user (id, org_id, email, password_hash, role, name, created_at, updated_at) values ('aud-user', ?, 'jordan@example.test', 'x', 'organizer', 'Jordan Alvarez', ?, ?)`,
    ORG,
    f.now,
    f.now,
  );
  addContact(f, "aud-priya", ORG, "Priya Raman");
  addSession(f, "aud-talk", EVENT);
  addParticipant(f, "aud-part", "aud-talk", "aud-priya");
  addPortal(f, "aud-portal", EVENT, ACCEPTED_SESSIONS, { name: "CFP speakers" });
  addTier(f, "aud-tier", EVENT, "Gold");
  f.run(
    `insert into sponsor_entitlement (id, tier_id, count, format, minutes, position, created_at, updated_at) values ('aud-ent', 'aud-tier', 1, 'Talk', 30, 0, ?, ?)`,
    f.now,
    f.now,
  );
  addSponsor(f, { company: "aud-co", sponsorship: "aud-sp", tier: "aud-tier" }, ORG, EVENT, { name: "Latticework" });
  addSponsorContact(f, "aud-sc", "aud-sp", EVENT, "aud-priya", { primary: true });
  f.run(
    `insert into sponsor_session (id, sponsorship_id, event_id, entitlement_id, title, status, submitted_at, submit_count, created_at, updated_at)
     values ('aud-ss', 'aud-sp', ?, 'aud-ent', 'Build caches', 'submitted', ?, 1, ?, ?)`,
    EVENT,
    f.now,
    f.now,
    f.now,
  );
}

async function buildApp(f: Fixture) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", f.db);
    c.set("auth", ORGANIZER);
    const kv = new Map<string, string>();
    c.env = {
      ...(c.env ?? {}),
      DEV_MODE: "1",
      KV: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => void kv.set(k, v), delete: async (k: string) => void kv.delete(k) },
    } as never;
    await next();
  });
  registerErrorHandler(app);
  for (const { prefix, subApp } of await parseIndexMounts()) app.route(prefix, subApp);
  return app;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json", "x-chq-csrf": "1" }, body: JSON.stringify(body) };
}

function auditRows(f: Fixture) {
  return f.all<{ action: string; actor_label: string; target_type: string; target_id: string; subject_contact_id: string | null; details_json: string }>(
    `select action, actor_label, target_type, target_id, subject_contact_id, details_json from audit_event order by created_at, id`,
  );
}

describe("audit_event", () => {
  it("records who previewed whose portal", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);
    const res = await app.request(`/portal/preview/people/${EVENT}/aud-priya`, {}, {} as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const rows = auditRows(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "portal.preview", actor_label: "Jordan Alvarez", target_type: "contact", target_id: "aud-priya", subject_contact_id: "aud-priya" });
    f.sqlite.close();
  });

  it("records a rule and permission change, saying what changed", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);
    const res = await app.request(
      `/api/v1/events/${EVENT}/portals/aud-portal`,
      json("PUT", {
        name: "CFP speakers",
        note: null,
        rule: { groups: [{ conditions: [{ field: "session_status", op: "is_not", values: ["declined"] }] }] },
        fieldPermissions: { phone: { level: "edit", help: null } },
        capabilities: { editSubmission: false },
        notifyOnJoin: false,
        items: [],
        notify: "none",
      }),
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const row = auditRows(f).find((r) => r.action === "portal.update");
    expect(row).toBeDefined();
    expect(JSON.parse(row!.details_json)).toMatchObject({ ruleChanged: true, permissionsChanged: true, notify: "none" });
    f.sqlite.close();
  });

  it("records an entitlement change with the tier's before and after", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);
    const res = await app.request(
      `/api/v1/events/${EVENT}/sponsor-tiers/aud-tier`,
      json("PUT", { name: "Gold", entitlements: [{ id: "aud-ent", count: 2, format: "Talk", minutes: 30 }] }),
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const row = auditRows(f).find((r) => r.action === "sponsor_tier.update");
    expect(row).toMatchObject({ target_type: "sponsor_tier", target_id: "aud-tier" });
    const details = JSON.parse(row!.details_json) as { before: string; after: string };
    expect(details.before).not.toBe(details.after);
    f.sqlite.close();
  });

  it("records a sponsor-session decline with its reason", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);
    const res = await app.request(
      `/api/v1/events/${EVENT}/sponsor-sessions/aud-ss/decline`,
      json("POST", { reason: "We already have two caching talks." }),
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const row = auditRows(f).find((r) => r.action === "sponsor_session.decline");
    expect(row).toMatchObject({ actor_label: "Jordan Alvarez", target_type: "sponsor_session", target_id: "aud-ss" });
    expect(JSON.parse(row!.details_json)).toEqual({ reason: "We already have two caching talks." });
    f.sqlite.close();
  });
});
