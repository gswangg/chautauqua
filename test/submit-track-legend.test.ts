// DEC-579: the CFP track control STAYS a multi-select checkbox group
// posting a repeating trackIds field — the fidelity report's "make them
// radios" is rejected because submission_track is a join table and radios
// would truncate multi-track submissions on the next edit. The actual
// defect was the singular "Track *" legend over a multi-select control;
// this guards both the copy fix and that the control itself never
// regresses to type="radio" or loses its repeating name.
// Mounts the real publicSubmitRoutes sub-app against a minimal fake db,
// mirroring the fakeDb pattern in test/submit-draft-notice.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROWS = [
  { id: "track-1", name: "Main Track" },
  { id: "track-2", name: "Second Track" },
];

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

describe("GET /submit/:eventSlug track fieldset (DEC-579)", () => {
  it("renders a plural 'Tracks *' legend with a 'choose all that apply' help line, not the singular 'Track *'", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();

    expect(body).toContain("Tracks *");
    expect(body).not.toContain(">Track *<");
    expect(body.toLowerCase()).toContain("choose all that apply");
  });

  it("keeps the track control a checkbox group posting a repeating trackIds field, never radios", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    const body = await res.text();

    // Every option in the offered set renders as a checkbox named trackIds.
    const trackInputs = [...body.matchAll(/<input[^>]*name="trackIds"[^>]*>/g)];
    expect(trackInputs.length).toBe(TRACK_ROWS.length);
    for (const [tag] of trackInputs) {
      expect(tag).toContain('type="checkbox"');
      expect(tag).not.toContain('type="radio"');
    }
    // Guard against the fidelity report's rejected fix ever landing.
    expect(body).not.toContain('type="radio"');
  });
});
