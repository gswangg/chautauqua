// Sponsor isolation, walked route by route against real rows (multi-portal
// brief: "a sponsor contact never sees another sponsor's sessions, team,
// entitlements or data"). Same technique as the cross-org probes
// (test/portal-idor-real-rows-probe.test.ts): every migration applied to
// node:sqlite, the real route tree composed from src/index.ts, and the route
// population derived from source -- a new /portal/sponsors route that isn't
// listed below fails this file.
//
// Fixture: one event, one Gold tier, two Gold sponsors. Acme's two contacts
// own a submitted session with a speaker and a per-sponsor extra; Birch's
// one contact owns a draft. The actor is Birch's contact, signed in, in a
// portal that grants every sponsor capability -- so a refusal here is
// isolation, never a missing capability.
//
// Every route is driven twice where it can be: with Acme's sponsorship id
// (and Acme's child ids), and with Birch's OWN sponsorship id carrying
// Acme's child ids (a session, speaker or teammate of Acme's under a path
// Birch can reach). Both must be the portal's 404, no response may carry any
// of Acme's data, and Acme's rows must be byte-identical afterwards. Birch's
// own pages are the non-vacuity control: they render (200) and still carry
// nothing of Acme's.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { parseIndexMounts } from "./helpers/index-mounts";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";
import {
  addContact,
  addEvent,
  addOrg,
  addPortal,
  addSponsor,
  addSponsorContact,
  addTier,
  makePortalsFixture,
  type Fixture,
} from "./helpers/portals-fixture";

const ORG = "iso-org";
const EVENT = "iso-event";
const TIER = "iso-tier-gold";
const ENT_TALK = "iso-ent-talk";
const ENT_WORKSHOP = "iso-ent-workshop";

const ACME = {
  company: "iso-company-acme",
  sponsorship: "iso-sponsorship-acme",
  primary: "iso-contact-acme-1",
  teammate: "iso-contact-acme-2",
  primarySc: "iso-sc-acme-1",
  teammateSc: "iso-sc-acme-2",
  session: "iso-ss-acme",
  speaker: "iso-ss-speaker-acme",
  extra: "iso-ent-acme-extra",
};
const BIRCH = {
  company: "iso-company-birch",
  sponsorship: "iso-sponsorship-birch",
  contact: "iso-contact-birch-1",
  sc: "iso-sc-birch-1",
  user: "iso-user-birch",
  session: "iso-ss-birch",
};

// Strings only Acme's rows hold: none may reach Birch's contact.
const ACME_MARKERS = [
  "Acme Rockets",
  "Acme's secret keynote",
  "acme-abstract-marker",
  `${ACME.primary}@example.com`,
  `${ACME.teammate}@example.com`,
  "Speaker Acme-Two",
  "Lunar booth extra",
];

const ACTOR: AuthInfo = { userId: BIRCH.user, role: "speaker", orgId: ORG, contactId: BIRCH.contact };
const CSRF = "sponsor-isolation-csrf";

function seed(f: Fixture): void {
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  addTier(f, TIER, EVENT, "Gold");
  f.run(
    `insert into sponsor_entitlement (id, tier_id, sponsorship_id, count, format, minutes, position, created_at, updated_at) values (?, ?, NULL, 1, 'Talk', 30, 0, ?, ?)`,
    ENT_TALK,
    TIER,
    f.now,
    f.now,
  );
  f.run(
    `insert into sponsor_entitlement (id, tier_id, sponsorship_id, count, format, minutes, position, created_at, updated_at) values (?, ?, NULL, 1, 'Workshop', 120, 1, ?, ?)`,
    ENT_WORKSHOP,
    TIER,
    f.now,
    f.now,
  );
  addSponsor(f, { company: ACME.company, sponsorship: ACME.sponsorship, tier: TIER }, ORG, EVENT, { name: "Acme Rockets" });
  addSponsor(f, { company: BIRCH.company, sponsorship: BIRCH.sponsorship, tier: TIER }, ORG, EVENT, { name: "Birch Labs" });
  // Acme's per-sponsor extra (an entitlement only Acme's package has)
  f.run(
    `insert into sponsor_entitlement (id, tier_id, sponsorship_id, count, format, minutes, position, created_at, updated_at) values (?, NULL, ?, 1, 'Lunar booth extra', 15, 2, ?, ?)`,
    ACME.extra,
    ACME.sponsorship,
    f.now,
    f.now,
  );
  addContact(f, ACME.primary, ORG, "Speaker Acme-One");
  addContact(f, ACME.teammate, ORG, "Speaker Acme-Two");
  addContact(f, BIRCH.contact, ORG, "Birch Person");
  f.run(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at) values (?, ?, 'birch-user@example.test', 'x', 'speaker', ?, ?, ?)`,
    BIRCH.user,
    ORG,
    BIRCH.contact,
    f.now,
    f.now,
  );
  addSponsorContact(f, ACME.primarySc, ACME.sponsorship, EVENT, ACME.primary, { primary: true });
  addSponsorContact(f, ACME.teammateSc, ACME.sponsorship, EVENT, ACME.teammate);
  addSponsorContact(f, BIRCH.sc, BIRCH.sponsorship, EVENT, BIRCH.contact, { primary: true });
  f.run(
    `insert into sponsor_session (id, sponsorship_id, event_id, entitlement_id, title, abstract, status, created_by_contact_id, submitted_at, submit_count, created_at, updated_at)
     values (?, ?, ?, ?, 'Acme''s secret keynote', 'acme-abstract-marker', 'submitted', ?, ?, 1, ?, ?)`,
    ACME.session,
    ACME.sponsorship,
    EVENT,
    ENT_TALK,
    ACME.primary,
    f.now,
    f.now,
    f.now,
  );
  f.run(
    `insert into sponsor_session_speaker (id, sponsor_session_id, contact_id, position, created_at, updated_at) values (?, ?, ?, 0, ?, ?)`,
    ACME.speaker,
    ACME.session,
    ACME.teammate,
    f.now,
    f.now,
  );
  f.run(
    `insert into sponsor_session (id, sponsorship_id, event_id, entitlement_id, title, status, created_by_contact_id, created_at, updated_at)
     values (?, ?, ?, ?, 'Birch draft', 'draft', ?, ?, ?)`,
    BIRCH.session,
    BIRCH.sponsorship,
    EVENT,
    ENT_TALK,
    BIRCH.contact,
    f.now,
    f.now,
  );
  // every sponsor capability granted, so only isolation can refuse
  addPortal(
    f,
    "iso-portal-sponsors",
    EVENT,
    {
      groups: [
        {
          conditions: [
            { field: "kind", op: "is", values: ["company"] },
            { field: "sponsorship_status", op: "is", values: ["active"] },
          ],
        },
      ],
    },
    { name: "Sponsors", capabilities: { addTeammates: true, createSponsorSessions: true, editSubmission: true, addCoPresenters: true } },
  );
}

// Acme's rows, snapshotted before and after the walk.
const ACME_ROWS: { sql: string; params: string[] }[] = [
  { sql: "select * from sponsorship where id = ?", params: [ACME.sponsorship] },
  { sql: "select * from sponsor_contact where sponsorship_id = ? order by id", params: [ACME.sponsorship] },
  { sql: "select * from sponsor_session where sponsorship_id = ? order by id", params: [ACME.sponsorship] },
  { sql: "select * from sponsor_session_speaker where sponsor_session_id = ? order by id", params: [ACME.session] },
  { sql: "select * from sponsor_entitlement where sponsorship_id = ? order by id", params: [ACME.sponsorship] },
];

function snapshot(f: Fixture): string {
  return ACME_ROWS.map((q) => JSON.stringify(f.all(q.sql, ...q.params))).join("\n");
}

// Each /portal/sponsors route, the foreign requests that drive it, and
// whether Birch's own version of the page is a GET this file renders as the
// control. `own` names Birch's own ids for the control request.
interface RouteCase {
  foreign: Record<string, string>[];
  own?: Record<string, string>;
  body?: Record<string, string>;
}

const VIA_ACME = { sponsorshipId: ACME.sponsorship };
const VIA_BIRCH = { sponsorshipId: BIRCH.sponsorship };

const CASES: Record<string, RouteCase> = {
  "GET /portal/sponsors/:sponsorshipId": { foreign: [VIA_ACME], own: VIA_BIRCH },
  "GET /portal/sponsors/:sponsorshipId/sessions/new": { foreign: [VIA_ACME], own: VIA_BIRCH },
  "POST /portal/sponsors/:sponsorshipId/sessions": { foreign: [VIA_ACME], body: { entitlementId: ENT_WORKSHOP } },
  "GET /portal/sponsors/:sponsorshipId/sessions/:sessionId": {
    foreign: [
      { ...VIA_ACME, sessionId: ACME.session },
      { ...VIA_BIRCH, sessionId: ACME.session },
    ],
    own: { ...VIA_BIRCH, sessionId: BIRCH.session },
  },
  "POST /portal/sponsors/:sponsorshipId/sessions/:sessionId": {
    foreign: [
      { ...VIA_ACME, sessionId: ACME.session },
      { ...VIA_BIRCH, sessionId: ACME.session },
    ],
    body: { title: "Hijacked", abstract: "Hijacked", intent: "submit" },
  },
  "POST /portal/sponsors/:sponsorshipId/sessions/:sessionId/speakers": {
    foreign: [
      { ...VIA_ACME, sessionId: ACME.session },
      { ...VIA_BIRCH, sessionId: ACME.session },
    ],
    body: { name: "Intruder Person", email: "intruder@example.com" },
  },
  "POST /portal/sponsors/:sponsorshipId/sessions/:sessionId/speakers/:speakerId/remove": {
    foreign: [
      { ...VIA_ACME, sessionId: ACME.session, speakerId: ACME.speaker },
      { ...VIA_BIRCH, sessionId: ACME.session, speakerId: ACME.speaker },
      // Birch's own session with Acme's speaker row
      { ...VIA_BIRCH, sessionId: BIRCH.session, speakerId: ACME.speaker },
    ],
  },
  "POST /portal/sponsors/:sponsorshipId/sessions/:sessionId/withdraw": {
    foreign: [
      { ...VIA_ACME, sessionId: ACME.session },
      { ...VIA_BIRCH, sessionId: ACME.session },
    ],
  },
  "POST /portal/sponsors/:sponsorshipId/sessions/:sessionId/discard": {
    foreign: [
      { ...VIA_ACME, sessionId: ACME.session },
      { ...VIA_BIRCH, sessionId: ACME.session },
    ],
  },
  "GET /portal/sponsors/:sponsorshipId/team": { foreign: [VIA_ACME], own: VIA_BIRCH },
  "POST /portal/sponsors/:sponsorshipId/team": { foreign: [VIA_ACME], body: { name: "Intruder Person", email: "intruder@example.com" } },
  "POST /portal/sponsors/:sponsorshipId/team/:sponsorContactId/remove": {
    foreign: [
      { ...VIA_ACME, sponsorContactId: ACME.teammateSc },
      // Birch's own team page removing Acme's teammate
      { ...VIA_BIRCH, sponsorContactId: ACME.teammateSc },
    ],
  },
};

function fill(pattern: string, params: Record<string, string>): string {
  return pattern
    .split("/")
    .map((seg) => {
      if (!seg.startsWith(":")) return seg;
      const v = params[seg.slice(1)];
      if (!v) throw new Error(`no value for ${seg} in ${pattern}`);
      return v;
    })
    .join("/");
}

function memoryKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  };
}

async function buildApp(f: Fixture) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", f.db);
    c.set("auth", ACTOR);
    c.env = { ...(c.env ?? {}), KV: memoryKv() } as never;
    await next();
  });
  registerErrorHandler(app);
  for (const { prefix, subApp } of await parseIndexMounts()) app.route(prefix, subApp);
  return app;
}

async function send(app: Hono<AppEnv>, method: string, path: string, body?: Record<string, string>) {
  const init: RequestInit = { method };
  if (method === "POST") {
    init.headers = { "content-type": "application/x-www-form-urlencoded", cookie: `chq_csrf=${CSRF}` };
    init.body = new URLSearchParams({ chq_csrf: CSRF, ...(body ?? {}) }).toString();
  }
  const res = await app.request(path, init, {} as unknown as AppEnv["Bindings"]);
  return { status: res.status, text: await res.text() };
}

function leaks(text: string): string[] {
  return ACME_MARKERS.filter((m) => text.includes(m) || text.includes(m.replace(/'/g, "&#39;")));
}

describe("sponsor isolation: a sponsor contact never reaches another sponsor's sessions, team, entitlements or data", () => {
  it("covers every registered /portal/sponsors route (a new one fails here until it is walked)", () => {
    const registered = [
      ...new Set(
        enumerateRegisteredRoutes()
          .filter((r) => r.path.startsWith("/portal/sponsors"))
          .map((r) => `${r.method} ${r.path}`),
      ),
    ].sort();
    expect(registered).toEqual(Object.keys(CASES).sort());
  });

  it("refuses every foreign sponsorship, session, speaker and teammate id with the portal's 404, leaks nothing, writes nothing", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);
    const before = snapshot(f);
    const failures: string[] = [];
    let walked = 0;

    for (const [key, c] of Object.entries(CASES)) {
      const [method, pattern] = key.split(" ") as [string, string];
      for (const params of c.foreign) {
        const path = fill(pattern, params);
        const res = await send(app, method, path, c.body);
        walked += 1;
        if (res.status !== 404) failures.push(`${method} ${path}: status ${res.status}, expected 404`);
        const leaked = leaks(res.text);
        if (leaked.length > 0) failures.push(`${method} ${path}: response carries ${leaked.join(", ")}`);
      }
    }

    expect(failures).toEqual([]);
    expect(walked).toBeGreaterThanOrEqual(20);
    expect(snapshot(f)).toBe(before);
    f.sqlite.close();
  }, 30000);

  it("an invitation not yet taken up can be withdrawn from the team page (and only Birch's own)", async () => {
    const f = makePortalsFixture();
    seed(f);
    addContact(f, "iso-contact-birch-typo", ORG, "Birch Typo");
    addSponsorContact(f, "iso-sc-birch-typo", BIRCH.sponsorship, EVENT, "iso-contact-birch-typo", { status: "invited" });
    const app = await buildApp(f);
    const page = await send(app, "GET", `/portal/sponsors/${BIRCH.sponsorship}/team`);
    expect(page.status).toBe(200);
    expect(page.text).toContain(`/portal/sponsors/${BIRCH.sponsorship}/team/iso-sc-birch-typo/remove`);
    expect(page.text).toContain(">Withdraw</button>");
    const withdrawn = await send(app, "POST", `/portal/sponsors/${BIRCH.sponsorship}/team/iso-sc-birch-typo/remove`);
    expect(withdrawn.status).toBe(302);
    expect(f.all(`select id from sponsor_contact where id = 'iso-sc-birch-typo'`)).toEqual([]);
    f.sqlite.close();
  });

  it("Birch's own pages render, and carry nothing of Acme's (non-vacuity control)", async () => {
    const f = makePortalsFixture();
    seed(f);
    const app = await buildApp(f);
    const failures: string[] = [];

    for (const [key, c] of Object.entries(CASES)) {
      if (!c.own) continue;
      const [method, pattern] = key.split(" ") as [string, string];
      const path = fill(pattern, c.own);
      const res = await send(app, method, path);
      if (res.status !== 200) failures.push(`${method} ${path}: status ${res.status}, expected 200`);
      if (!res.text.includes("Birch Labs")) failures.push(`${method} ${path}: Birch's own page doesn't name Birch`);
      const leaked = leaks(res.text);
      if (leaked.length > 0) failures.push(`${method} ${path}: response carries ${leaked.join(", ")}`);
    }

    // the home lists Birch's sponsor section and nothing of Acme's
    const home = await send(app, "GET", "/portal");
    if (home.status !== 200) failures.push(`GET /portal: status ${home.status}`);
    if (!home.text.includes("Birch Labs")) failures.push("GET /portal: no Birch section");
    const leaked = leaks(home.text);
    if (leaked.length > 0) failures.push(`GET /portal: response carries ${leaked.join(", ")}`);

    expect(failures).toEqual([]);
    f.sqlite.close();
  }, 30000);
});
