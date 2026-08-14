// DEC-986 (supersedes DEC-951's refusal, per the user's 2026-08-13 decision
// in docs/eval-findings.md): the public CFP track control is now a
// SINGLE-SELECT radio group posting exactly one member of the same
// repeating trackIds field. The multi-track model, the submission_track
// join, and every server validation stay untouched — the edit form
// (src/routes/portal/edit.tsx) still holds the multi-select checkbox
// group DEC-579 protected, because it edits an existing row that may
// already carry several tracks. This guards the create form's markup
// (radios, "Choose one.") and that it never regresses to a multi-select
// checkbox group.
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

describe("GET /submit/:eventSlug track fieldset (DEC-986)", () => {
  // w5-c (DEC-371 amendment, frame 10--14): the group label is now
  // singular "Track" (not "Tracks"), and the "Choose one." sub-caption is
  // dropped -- a single-select radio group reads as self-explanatory.
  it("renders a singular 'Track' legend (no asterisk), no 'choose one' sub-caption", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();

    expect(body).toContain("<legend>Track</legend>");
    expect(body).not.toContain("<legend>Tracks</legend>");
    expect(body).not.toContain("Track *");
    expect(body.toLowerCase()).not.toContain("choose one.");
  });

  it("renders the track control as a radio group posting a single trackIds value, never checkboxes", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    const body = await res.text();

    // Every option in the offered set renders as a radio named trackIds.
    const trackInputs = [...body.matchAll(/<input[^>]*name="trackIds"[^>]*>/g)];
    expect(trackInputs.length).toBe(TRACK_ROWS.length);
    for (const [tag] of trackInputs) {
      expect(tag).toContain('type="radio"');
      expect(tag).not.toContain('type="checkbox"');
    }
    // Guard against the retired multi-select markup ever landing again.
    expect(body).not.toContain('name="trackIds" type="checkbox"');
  });

  // DEC-731 (eval-findings 70c): the page must render exactly ONE track
  // control -- a leftover custom <select> dropdown beside the built-in
  // radio group would let a submitter pick a track two contradictory
  // ways. Guard both: no <select> anywhere carries the track options, and
  // there is exactly one fieldset offering them.
  it("renders exactly one track control (the radio fieldset), never a second dropdown", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    const body = await res.text();

    // No <select> element anywhere on the page carries a track's name as
    // an <option> -- the only allowed track markup is the radio group.
    for (const track of TRACK_ROWS) {
      const selectWithTrackOption = new RegExp(`<select[^>]*>(?:(?!</select>).)*${track.name}`, "s");
      expect(body).not.toMatch(selectWithTrackOption);
    }
    // Exactly one fieldset/legend pair offers tracks.
    const legendMatches = [...body.matchAll(/<legend>Track<\/legend>/g)];
    expect(legendMatches.length).toBe(1);
  });
});

// DEC-790: the submit page shell offers a returning speaker a quiet way
// in (a /login link), without ever rendering a claim URL -- DEC-098's
// "claim link only in the fresh post-submit state" rule is untouched, so
// a plain GET of the submit form (never having submitted anything) must
// never show /claim/ anywhere in the body.
describe("GET /submit/:eventSlug offers a sign-in link, never a claim URL (DEC-790)", () => {
  it("renders a /login sign-in link near the header, and no /claim/ URL anywhere in the body", async () => {
    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
    const app = appWithDb(db);

    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();

    expect(body).toContain('href="/login"');
    expect(body.toLowerCase()).toContain("sign in to the speaker portal");
    expect(body).not.toContain("/claim/");
  });
});
