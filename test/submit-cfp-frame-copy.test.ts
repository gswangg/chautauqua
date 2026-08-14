// w5-c (DEC-371 amendment, frame 10--14): public CFP form 732 column +
// copy batch. Mirrors the fakeDb/appWithDb pattern in
// test/submit-name-collapse.test.ts to render GET /submit/:eventSlug
// through the real route, plus a couple of direct component-level renders
// (TrackChoices' validation copy) via test/submit-core.ts's pure core.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CFP_CSS } from "../src/routes/public/cfp.css";
import { validateTrackChoice } from "../src/lib/submit-core";
import { ClosedPage } from "../src/routes/public/submit-views";
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
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: "Old help text", required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "field_session_format",
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
  { id: "bio", section: "speaker", kind: "long_text", label: "Speaker bio", helpText: "Old bio help", required: false, position: 6, optionsJson: null, ruleJson: null },
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

async function getSubmitPage() {
  const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
  const app = appWithDb(db);
  const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
  expect(res.status).toBe(200);
  return res.text();
}

describe("cfp.css.ts — 732 content column (DEC-371 wave-5 amendment)", () => {
  it("gives the CFP body a 732px centred measure, distinct from the 820 page measure", () => {
    expect(CFP_CSS).toMatch(/\.chq-cfp-body\s*\{[^}]*max-width:\s*732px[^}]*margin:\s*0 auto/);
  });

  it("sets the YOU section break to 54px", () => {
    expect(CFP_CSS).toMatch(/section \+ section\s*\{[^}]*margin-top:\s*54px/);
  });
});

describe("GET /submit/:eventSlug — frame 10--14 copy batch (w5-c)", () => {
  it("renders the lede's 'no account needed' family once, and the identity note exactly once at the bottom", async () => {
    const body = await getSubmitPage();
    expect(body).toContain("no account needed");
    const identityNoteOccurrences = body.match(/Already have an account\?/g) ?? [];
    expect(identityNoteOccurrences).toHaveLength(1);
    // The bottom note (not the intro) carries the identity copy.
    const introIdx = body.indexOf("Submit a talk</h1>");
    const identityIdx = body.indexOf("Already have an account?");
    const formCloseIdx = body.indexOf("</form>");
    expect(identityIdx).toBeGreaterThan(introIdx);
    expect(identityIdx).toBeGreaterThan(formCloseIdx);
  });

  it("has a visible 'Create an account' affordance linking a real anchor on the page, not a dead control", async () => {
    const body = await getSubmitPage();
    expect(body).toContain("Create an account");
    expect(body).toContain('<a href="#chq-cfp-submit-form">Create an account</a>');
    expect(body).toContain('<form id="chq-cfp-submit-form"');
  });

  it("uses the singular 'Track' group label", async () => {
    const body = await getSubmitPage();
    expect(body).toContain("<legend>Track</legend>");
    expect(body).not.toContain("<legend>Tracks</legend>");
  });

  it("drops the format field's generic helpText sub-caption ('5 options')", async () => {
    const body = await getSubmitPage();
    expect(body).not.toContain("5 options");
  });

  it("overrides the abstract field's counter cap and helper text", async () => {
    const body = await getSubmitPage();
    expect(body).toContain("Shown on the public sessions page if your talk is accepted");
    expect(body).not.toContain("Old help text");
    // Counter seeded at 0 against the new 1,200 cap.
    expect(body).toMatch(/data-field-counter="description" data-max="1200"/);
    expect(body).toContain("0 / 1,200");
  });

  it("relabels Bio as 'BIO' with its own helper, dropping the old helpText", async () => {
    const body = await getSubmitPage();
    expect(body).toContain(">Bio<");
    expect(body).toContain("Shown on the public speakers page if your talk is accepted");
    expect(body).not.toContain("Old bio help");
    expect(body).not.toContain(">Speaker bio<");
  });

  it("renders the email field as type=\"email\"", async () => {
    const body = await getSubmitPage();
    const emailInputs = [...body.matchAll(/<input[^>]*name="field__email"[^>]*>/g)];
    expect(emailInputs).toHaveLength(1);
    expect(emailInputs[0]![0]).toContain('type="email"');
  });

  it("carries the required marker on the track radios", async () => {
    const body = await getSubmitPage();
    const trackInputs = [...body.matchAll(/<input[^>]*name="trackIds"[^>]*>/g)];
    expect(trackInputs.length).toBeGreaterThan(0);
    for (const input of trackInputs) {
      expect(input[0]).toContain("required");
    }
  });
});

describe("validateTrackChoice — 'Select a track' message (public single-select radios, DEC-986)", () => {
  it("rejects an empty selection with 'Select a track' when tracks are offered", () => {
    const result = validateTrackChoice([], ["track-1", "track-2"]);
    expect(result.ok).toBe(false);
    expect(result.ok || result.error).toBe("Select a track");
  });
});

describe("ClosedPage — dead-end link copy (w5-c)", () => {
  it("reads 'Browse the sessions' rather than 'Browse the programme'", () => {
    const html = ClosedPage({
      event: { ...EVENT_ROW, timezone: "UTC" } as any,
      form: { ...FORM_ROW, closeDate: Date.parse("2020-01-01T00:00:00.000Z") } as any,
    }).toString();
    expect(html).toContain(">Browse the sessions ");
    expect(html).not.toContain("Browse the programme");
  });
});
