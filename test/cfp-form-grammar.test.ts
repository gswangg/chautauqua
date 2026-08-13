// DEC-951: the public CFP speaks the product's one optionality grammar
// (DEC-917) -- required rows carry no marker, skippable rows carry the
// shared ' · optional' suffix, and the page names itself with exactly one
// <h1>. Mounts the real publicSubmitRoutes sub-app against a minimal fake
// db, mirroring the fakeDb pattern in test/submit-track-legend.test.ts.

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

// A required field (no marker) and an optional field (' · optional' suffix)
// so the test can assert both halves of the grammar at once.
const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "notes", section: "session", kind: "text", label: "Notes", helpText: null, required: false, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
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

describe("GET /submit/:eventSlug form grammar (DEC-951)", () => {
  it("carries no '*' required marker on any label or legend, one <h1>, radio trackIds inputs, and the shared optional suffix", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();

    // (a) no '*' required marker on any label or legend (scoped to those
    // elements' rendered text -- the inline field-rules <script> elsewhere
    // on the page legitimately contains '*' as a multiplication/glob token
    // unrelated to form copy).
    const labelAndLegendText = [...body.matchAll(/<(?:label|legend)\b[^>]*>((?:(?!<\/(?:label|legend)>).)*)<\/(?:label|legend)>/gs)].map(
      (m) => m[1],
    );
    expect(labelAndLegendText.length).toBeGreaterThan(0);
    for (const text of labelAndLegendText) {
      expect(text).not.toContain("*");
    }

    // (b) exactly one <h1>
    const h1Matches = body.match(/<h1[\s>]/g) ?? [];
    expect(h1Matches.length).toBe(1);
    expect(body).toContain(`<h1 class="chq-cfp-title">${FORM_ROW.title}</h1>`);
    // the intro's second heading is gone, but its lede paragraph survives
    expect(body).not.toContain("<h1>Submit a talk</h1>");
    expect(body).toContain("Already have an account?");

    // (c) track inputs are type=radio named trackIds (DEC-986: the public
    // CFP picks ONE track; the edit surface keeps the checkbox group)
    expect(body).toContain('type="radio"');
    expect(body).toContain('name="trackIds"');
    expect(body).not.toContain('type="checkbox"');
    expect(body).toContain("<legend>Tracks</legend>");

    // (d) an optional field still renders the shared ' · optional' suffix
    expect(body).toContain("· optional");
  });
});
