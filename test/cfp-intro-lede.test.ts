// w24-c (DEC-986 wave-24 amendment): the public CFP renders the organiser's
// authored intro (form.description, edited in Settings via PATCH
// /api/v1/forms) when present, in place of the computed track/format lede.
// Mirrors the fakeDb/appWithDb pattern in test/submit-cfp-frame-copy.test.ts.

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

const BASE_FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null as string | null,
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
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "field_session_format",
    role: "session_format",
    section: "session",
    kind: "dropdown",
    label: "Session format",
    helpText: "5 options",
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["Talk (30 min)", "Talk (45 min)", "Workshop"]),
    ruleJson: null,
  },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
  { id: "bio", section: "speaker", kind: "long_text", label: "Speaker bio", helpText: null, required: false, position: 6, optionsJson: null, ruleJson: null },
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
    insert: () => ({ values: () => ({ then: (resolve: (v: undefined) => void) => resolve(undefined) }) }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
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

async function getSubmitPage(description: string | null) {
  const formRow = { ...BASE_FORM_ROW, description };
  const db = fakeDb([[EVENT_ROW], [formRow], FIELD_ROWS, TRACK_ROWS]);
  const app = appWithDb(db);
  const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
  expect(res.status).toBe(200);
  return res.text();
}

describe("SubmitPage intro — organiser-authored form.description (DEC-986 w24 amendment)", () => {
  it("renders the authored intro and suppresses the computed track/format sentence", async () => {
    const body = await getSubmitPage("Come talk about distributed systems with us.");
    expect(body).toContain("Come talk about distributed systems with us.");
    expect(body).not.toContain("no account needed");
  });

  it("falls back to the computed sentence when the intro is blank/whitespace-only", async () => {
    const blank = await getSubmitPage("   \n\n  ");
    expect(blank).toContain("no account needed");

    const nullDescription = await getSubmitPage(null);
    expect(nullDescription).toContain("no account needed");
  });

  it("splits a multi-paragraph intro into multiple <p> elements", async () => {
    const body = await getSubmitPage("First paragraph.\n\nSecond paragraph.");
    expect(body).toContain("<p>First paragraph.</p>");
    expect(body).toContain("<p>Second paragraph.</p>");
  });

  it("escapes an intro containing markup instead of injecting it", async () => {
    const body = await getSubmitPage("Come speak<script>alert(1)</script> with <b>us</b>.");
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).not.toContain("<b>us</b>");
    expect(body).toContain("&lt;script&gt;");
    expect(body).toContain("&lt;b&gt;");
  });

  it("still renders the 'Create an account' CTA line regardless of intro state", async () => {
    for (const description of ["Authored copy.", null, "   "]) {
      const body = await getSubmitPage(description);
      expect(body).toContain('<a href="#chq-cfp-submit-form">Create an account</a>');
    }
  });
});
