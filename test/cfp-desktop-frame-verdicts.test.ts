// CFP / public-submit SSR DESKTOP (1600) per-frame render verdicts
// (task w26-g, DEC-613/DEC-651/DEC-032 wave-26). Four of the seven
// Public-and-Portal desktop frames v12m-w24-h's 6-of-13 ledger does not
// own: :894 "Submit a talk · /submit/:slug" (the open CFP form), :1101
// "CFP closed", :1211 "Submit a talk · rejected on submit", :1532 "CFP not
// open yet · /submit/:slug" (the third window state).
//
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this file touches no route
// module and no .css.ts, moves no byte, and fixes nothing it finds.
// Harness (DEC-613 wave-26): copied VERBATIM in shape from
// test/public-390-frame-verdicts.test.ts / test/submit-error-standard.test.ts
// -- bare Hono<AppEnv>, publicRoutes + publicSubmitRoutes mounted,
// registerErrorHandler, app.request(route), CSRF_COOKIE_NAME for the POST
// -- never a fifth mock stack. An SSR response carries no computed layout,
// so every assertion below reads the returned HTML string's markup
// structure, order and text only; the two claims that are inherently a CSS
// fact (the rejected-state field border/dock-button recolor) are named in
// prose in the audit doc and never asserted here as a style read.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { MAX_TEXT_LENGTH } from "../src/forms/validate";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";
import { DEC_613, DEC_651, DEC_032 } from "../src/decisions";

// DEC-613 wave-26 amendment (src/decisions-data/part3.ts): "a desktop SSR
// verdict COPIES an existing buildApp harness verbatim". DEC-651 wave-26
// amendment (src/decisions-data/part4.ts): "a Modal/Menu/STATE frame is
// verdicted by operating the control that opens it on the real route" --
// frame :1211 (the rejected-on-submit STATE) is entered here by POSTing an
// invalid submission through the real route, never a direct component
// mount. DEC-032 wave-26 amendment (src/decisions-data/part1.ts): "a
// deviation-deferred frame is UN-CITABLE" -- this file cites zero Settings
// lines. void-referenced so the dependency is compile-checked
// (src/decisions.ts).
void DEC_613;
void DEC_651;
void DEC_032;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims. Same idiom as
 * test/public-390-frame-verdicts.test.ts's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// ---------------------------------------------------------------------------
// Harness (mirrors test/submit-error-standard.test.ts's fakeDb/appWithDb
// exactly -- never a sixth reimplementation, DEC-613).
// ---------------------------------------------------------------------------

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
    insert: () => ({
      values: () => ({
        then: (resolve: (v: undefined) => void) => resolve(undefined),
        onConflictDoUpdate: () => ({
          returning: async () => [{ count: 1 }],
          then: (resolve: (v: undefined) => void) => resolve(undefined),
        }),
      }),
    }),
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
const BINDINGS = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at DevFlow Conf 2027",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Platform & Infra" };

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "field_session_format",
    role: "session_format",
    section: "session",
    kind: "dropdown",
    label: "Session format",
    helpText: null,
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["Talk (30 min)", "Talk (45 min)", "Workshop"]),
    ruleJson: null,
  },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
];

describe("CFP / public-submit SSR DESKTOP (1600) frame render verdicts (task w26-g)", () => {
  it("frame :894 Submit a talk · /submit/:slug -- DIVERGES (label wording only): open form MATCHES structure -- header meta/h1/intro, Track legend, dock \"Submit this talk\"/\"Save draft\"/confirmation note; the Format fieldset's legend reads \"Session format\" where the frame draws \"Format\" (DEC-976 wave-25 amendment: a blessed deviation, the stored field label is not frame chrome)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:894 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Submit a talk · /submit/:slug</span>`
    verbatimLine(
      894,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Submit a talk · /submit/:slug</span>',
    );

    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);
    const res = await app.request(
      "/submit/test-conf",
      { headers: {} },
      { ...BINDINGS, KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    // :898-903 header band -- MATCHES: title, no dedicated assertion on the
    // dated call-for-papers meta line (event-timezone-dependent, no fixture
    // value set here), but the h1 itself is exact.
    expect(html).toContain("<h1");
    expect(html).toContain(">Submit a talk</h1>");

    // :933 Track legend -- MATCHES exactly.
    expect(html).toContain("<legend>Track</legend>");
    // :942's own legend literal is the bare word "Format"; FormatChoices
    // (submit-views.tsx:288) renders `<legend>{field.label}</legend>`, and
    // the fixture field's stored label is "Session format", one word
    // longer than the frame's literal -- the same blessed divergence
    // test/public-390-frame-verdicts.test.ts already verdicts on the
    // phone half of this same surface.
    expect(html).toContain("<legend>Session format</legend>");
    expect(html).not.toContain("<legend>Format</legend>");

    // :1003-1005 dock: MATCHES -- "Submit this talk" primary, "Save draft"
    // secondary, and the confirmation note verbatim.
    expect(html).toContain('class="chq-btn chq-btn-primary"');
    expect(html).toContain("Submit this talk");
    expect(html).toContain('class="chq-btn chq-btn-secondary chq-cfp-save-draft"');
    expect(html).toContain("Save draft");
    expect(html).toContain('class="chq-cfp-actions-note"');
    expect(html).toContain("We email a confirmation with a link to your portal");
  });

  it('frame :1101 CFP closed -- MATCHES: "The call for papers has closed" heading, the submissions-closed body naming the event, one "Browse the sessions ›" link', async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1101 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP closed</span>`
    verbatimLine(
      1101,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">CFP closed</span>',
    );

    // form.closeDate set well in the past (isFormClosed uses UTC end-of-day
    // in the event's own timezone) so formWindowState resolves "closed".
    // getDefaultForm (src/server/repo/submit.ts:134) calls `.getTime()` on
    // the raw row value, so the fixture must hand back a Date, matching
    // Drizzle's own timestamp-column shape -- never a bare number.
    const CLOSED_FORM = { ...FORM_ROW, closeDate: new Date(Date.UTC(2020, 0, 1)) };
    const db = fakeDb([[EVENT_ROW], [CLOSED_FORM]]);
    const app = appWithDb(db);
    const res = await app.request(
      "/submit/test-conf",
      { headers: {} },
      { ...BINDINGS, KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1108 heading -- MATCHES verbatim.
    expect(html).toContain('class="chq-pub-surface-title"');
    expect(html).toContain("The call for papers has closed");
    // :1109 body -- MATCHES structurally: names the event, "Thanks for your
    // interest in".
    expect(html).toContain('class="chq-cfp-closed-body"');
    expect(html).toContain("Submissions closed on");
    expect(html).toContain("Thanks for your interest in DevFlow Conf 2027.");
    // :1111 -- exactly one link, "Browse the sessions ›".
    const links = [...html.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0]![1]).toBe("/e/test-conf/sessions");
    expect(html).toMatch(/Browse the sessions\s*(?:&rsaquo;|›)/);
  });

  it('frame :1211 Submit a talk · rejected on submit -- DIVERGES (dock note): the top-of-form summary reads "Three things need fixing before this can be sent" and every typed answer survives the re-render, MATCHING the frame\'s error-summary structure; the frame\'s rejected-state dock note reads "Saving a draft skips these checks" where the tree keeps the fresh-form note ("We email a confirmation with a link to your portal") unconditionally', async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1211 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Submit a talk · rejected on submit</span>`
    verbatimLine(
      1211,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Submit a talk · rejected on submit</span>',
    );

    const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW]]);
    const app = appWithDb(db);

    const OVER_LENGTH_DESC = "x".repeat(MAX_TEXT_LENGTH + 50);
    const form = new FormData();
    form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
    // title left blank -> required error (frame :1225's own first row is an
    // over-length abstract, but the STRUCTURE this test verdicts -- a
    // 3-problem summary naming the field, over-length message, and the
    // track-missing message -- is what the frame draws, not the sample
    // values, per this file's contract).
    form.set("field__title", "");
    form.set("field__description", OVER_LENGTH_DESC);
    form.set("speaker_name", "Dana Whitmore");
    form.set("field__email", "dana@example.com");
    form.set("field__field_session_format", "Talk (30 min)");
    // trackIds omitted entirely -> "Pick one -- a talk needs a track ..."

    const req = new Request("http://local/submit/test-conf", {
      method: "POST",
      headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
      body: form,
    });
    const res = await app.request(req, undefined, {
      ...BINDINGS,
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(400);
    const html = await res.text();

    // :1225 "Three things need fixing before this can be sent" -- MATCHES
    // verbatim: exactly 3 problems (title required, description
    // over-length, track missing) produce exactly this spelled-count
    // heading (src/domain/count-copy.ts's thingsNeedFixingHeading).
    expect(html).toContain('class="chq-error-summary"');
    expect(html).toContain("Three things need fixing before this can be sent");
    // :1231 reassurance line -- MATCHES verbatim.
    expect(html).toContain("Nothing was lost. Everything you typed is still below.");
    const anchors = [...html.matchAll(/<a class="chq-error-summary-link" href="#([^"]+)"/g)].map((m) => m[1]);
    expect(anchors).toHaveLength(3);
    for (const id of anchors) {
      expect(html).toContain(`id="${id}"`);
    }

    // "Everything you typed is still below" -- verified: every entered
    // value survives the re-render (title is the one field left
    // deliberately blank in this fixture to force the required error;
    // every OTHER typed value is present).
    expect(html).toContain(OVER_LENGTH_DESC);
    expect(html).toContain("Dana Whitmore");
    expect(html).toContain("dana@example.com");

    // :1289-1290 dock persists (Submit this talk / Save draft) -- MATCHES.
    expect(html).toContain("Submit this talk");
    expect(html).toContain('class="chq-btn chq-btn-secondary chq-cfp-save-draft"');
    expect(html).toContain("Save draft");
    // The frame's own dock note on THIS state reads "Saving a draft skips
    // these checks" -- the tree's actions note is not error-state-aware
    // (submit-views.tsx:748 renders the same fresh-form sentence
    // unconditionally, with no branch on `errors`/`trackError`) -- a real,
    // narrow divergence.
    expect(html).toContain('class="chq-cfp-actions-note"');
    expect(html).toContain("We email a confirmation with a link to your portal");
    expect(html).not.toContain("Saving a draft skips these checks");
  });

  it('frame :1532 CFP not open yet · /submit/:slug -- MATCHES: heading leads with the open date, "You will not need an account.", one way-forward link (falls back to "Browse the sessions ›" when no qualifying prior edition exists, DEC-745 wave-150 amendment)', async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1532 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP not open yet · /submit/:slug</span>`
    verbatimLine(
      1532,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">CFP not open yet · /submit/:slug</span>',
    );

    // openDate set well in the future (dayLabelStartInstant) so
    // formWindowState resolves "not_yet_open" before any track/field query
    // runs -- the select queue after the event/form rows is exactly ONE
    // more call, getPriorPublicEvent's own event lookup, returning no row
    // so lastYear resolves to null (no qualifying prior edition, per
    // getPriorPublicEvent's own zero-session-count-also-null contract --
    // submit-views.tsx:145-155's comment).
    const NOT_YET_OPEN_FORM = { ...FORM_ROW, openDate: new Date(Date.UTC(2099, 0, 1)) };
    const db = fakeDb([[EVENT_ROW], [NOT_YET_OPEN_FORM], []]);
    const app = appWithDb(db);
    const res = await app.request(
      "/submit/test-conf",
      { headers: {} },
      { ...BINDINGS, KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1540 heading -- MATCHES structurally: leads with the open date,
    // never an apology (submit-views.tsx:172-175's own comment cites the
    // same ruling).
    expect(html).toContain('class="chq-pub-surface-title"');
    expect(html).toContain("The call for papers opens on");
    // :1541 -- MATCHES: "You will not need an account." clause present;
    // the frame's "Three tracks, five formats." lede is deliberately NOT
    // reproduced here (submit-views.tsx:176-181's own comment: no track
    // query runs for this window state, so a track count would be
    // fabricated per DEC-986) -- filed as the file's own documented,
    // intentional narrowing, not new debt.
    expect(html).toContain("You will not need an account.");
    // :1543 -- exactly one way-forward link; with no qualifying prior
    // edition it falls back to "Browse the sessions ›" rather than the
    // frame's sample "Browse last year's sessions ›" -- both destinations
    // are the ruled contract (DEC-745 wave-150 amendment), not a defect.
    const links = [...html.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0]![0]).toMatch(/Browse (?:the sessions|last year&rsquo;s sessions)\s*(?:&rsaquo;|›)/);
  });
});
