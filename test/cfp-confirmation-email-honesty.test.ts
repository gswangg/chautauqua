// DEC-006 amendment (wave 51): the CFP confirmation page must never assert a
// delivery that did not happen. src/routes/public/submit.tsx's try/catch
// around makeMailer()/mailer.send() correctly swallows the failure (the
// submission row is already persisted — retrying would duplicate it), but
// until this change it swallowed the OUTCOME too: the page always rendered
// "That's in. Check your email." and "We've emailed a confirmation for ...
// to <email>" regardless of whether the send actually succeeded.
//
// Reuses the fakeDb/fakeKv/appWithDb harness from test/submit-mailer-failure.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";

// `cloudflare:email` only exists inside workerd; server/context.ts's real
// message factory does `await import("cloudflare:email")` lazily so vitest
// never needs to resolve it unless a send actually runs (which this suite's
// real-makeMailer path does) — stub the ambient module so that dynamic
// import resolves the same way workerd's would.
vi.mock("cloudflare:email", () => ({
  EmailMessage: class {
    constructor(
      public from: string,
      public to: string,
      public raw: string,
    ) {}
  },
}));

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

const TRACK_ROW = { id: "track-1", name: "Main Track" };

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
];

// DEC-098 (wave 8 amendment): FIELD_ROWS with the Session-format field added
// (SESSION_FORMAT_FIELD_ID = "field_session_format"), so the confirmation
// card's track/format meta line can be exercised end to end.
const FIELD_ROWS_WITH_FORMAT = [
  ...FIELD_ROWS,
  {
    id: "field_session_format",
    section: "session",
    kind: "dropdown",
    label: "Format",
    helpText: null,
    required: false,
    position: 5,
    optionsJson: JSON.stringify(["Talk (45 min)", "Workshop (90 min)"]),
    ruleJson: null,
  },
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
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          then: (resolve: (v: undefined) => void) => resolve(undefined),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
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

function fakeFilesBucket(): R2Bucket {
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
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

const CSRF_TOKEN = "test-csrf-token";

function submitForm(opts?: { trackIds?: string[]; format?: string }) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", "ada@example.com");
  for (const trackId of opts?.trackIds ?? ["track-1"]) {
    form.append("trackIds", trackId);
  }
  if (opts?.format !== undefined) {
    form.set("field__field_session_format", opts.format);
  }
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

function selectQueueFor() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 7 }], []];
}

function selectQueueForWithFormat() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS_WITH_FORMAT, [TRACK_ROW], [], [{ seq: 7 }], []];
}

// No tracks offered at all (empty eventTracks list), so validateTrackChoice
// never requires a selection -- used by the "no track" meta-clause tests
// below, which would otherwise fail track-selection validation.
function selectQueueForWithFormatNoTracks() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS_WITH_FORMAT, [], [], [{ seq: 7 }], []];
}

const commonBindings = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  PUBLIC_BASE_URL: "https://events.example.com",
} as const;

describe("CFP confirmation page never asserts a delivery that did not happen (DEC-006 wave 51)", () => {
  it("mailer throws: 200, submission persisted, HTML makes no delivery claim", async () => {
    const { db, inserts } = fakeDb(selectQueueFor());
    const app = appWithDb(db);

    const res = await app.request(submitForm(), undefined, {
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
      EMAIL: { send: vi.fn(async () => { throw new Error("simulated provider outage"); }) },
      ...commonBindings,
    } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200);
    const html = await res.text();

    const submissionInserts = inserts.filter(
      (v) => typeof v === "object" && v !== null && !Array.isArray(v) && "title" in (v as object) && "description" in (v as object),
    );
    expect(submissionInserts).toHaveLength(1);
    expect((submissionInserts[0] as any).title).toBe("My great talk");

    expect(html).not.toContain("Check your email");
    expect(html).not.toContain("We've emailed");
    expect(html).not.toContain("was emailed");
  });

  it("working mailer: existing delivery-claiming copy is unchanged", async () => {
    const { db } = fakeDb(selectQueueFor());
    const app = appWithDb(db);

    const res = await app.request(submitForm(), undefined, {
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
      EMAIL: { send: vi.fn(async () => {}) },
      ...commonBindings,
    } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Check your email.");
    expect(html).toContain("emailed a confirmation for");
  });
});

// DEC-098 (wave 8 amendment): the confirmation card states the talk's track
// and format, not just its title.
describe("CFP confirmation card states track and format (DEC-098 wave 8 amendment)", () => {
  it("submission with both a track and a format renders 'Track · Format (N min)' in the card", async () => {
    const { db } = fakeDb(selectQueueForWithFormat());
    const app = appWithDb(db);

    const res = await app.request(
      submitForm({ trackIds: ["track-1"], format: "Talk (45 min)" }),
      undefined,
      {
        KV: fakeKv(),
        FILES: fakeFilesBucket(),
        EMAIL: { send: vi.fn(async () => {}) },
        ...commonBindings,
      } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<span class="chq-cfp-confirm-card-meta">Main Track · Talk (45 min)</span>');
  });

  it("submission with neither a track nor a format renders the card with the title only and no meta element", async () => {
    const { db } = fakeDb(selectQueueForWithFormatNoTracks());
    const app = appWithDb(db);

    const res = await app.request(
      submitForm({ trackIds: [] }),
      undefined,
      {
        KV: fakeKv(),
        FILES: fakeFilesBucket(),
        EMAIL: { send: vi.fn(async () => {}) },
        ...commonBindings,
      } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('class="chq-cfp-confirm-card-meta"');
  });

  it("submission with only a track (no format) renders that clause with no separator", async () => {
    const { db } = fakeDb(selectQueueForWithFormat());
    const app = appWithDb(db);

    const res = await app.request(
      submitForm({ trackIds: ["track-1"] }),
      undefined,
      {
        KV: fakeKv(),
        FILES: fakeFilesBucket(),
        EMAIL: { send: vi.fn(async () => {}) },
        ...commonBindings,
      } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<span class="chq-cfp-confirm-card-meta">Main Track</span>');
  });

  it("submission with only a format (no track) renders that clause with no separator", async () => {
    const { db } = fakeDb(selectQueueForWithFormatNoTracks());
    const app = appWithDb(db);

    const res = await app.request(
      submitForm({ trackIds: [], format: "Workshop (90 min)" }),
      undefined,
      {
        KV: fakeKv(),
        FILES: fakeFilesBucket(),
        EMAIL: { send: vi.fn(async () => {}) },
        ...commonBindings,
      } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<span class="chq-cfp-confirm-card-meta">Workshop (90 min)</span>');
  });
});
