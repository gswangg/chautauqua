// PUBLIC SSR — per-frame 390 render verdicts (task w14-sf, DEC-976
// wave-158 SSR amendment, cited via the DEC_976 registry constant below).
// MEASUREMENT ONLY: this file fixes nothing, touches no route module and
// no .css.ts.
//
// Wave-158's amendment measured that every SSR "phone-frames" test
// (`test/public-agenda-phone-frames.test.ts` among them) is a pure source
// scan -- `grep -c 'app.request'` returns 0 -- so the six frames below have
// never been rendered against the real route. This file closes that gap
// for the public-surface half: one `it()` per width:390px frame, each (a)
// opening with a `verbatimLine(<line>, '<exact bytes>')` receipt of its own
// frame line copied byte-for-byte from
// `docs/design/Chautauqua Public and Portal.dc.html`, (b) dispatching a
// REAL request through a `Hono<AppEnv>` with the actual route module
// mounted (the `vi.mock`-free `Hono` + `registerErrorHandler` +
// `app.request(route)` shape `test/public-agenda-rail.test.ts` and
// `test/submit-name-collapse.test.ts` already establish -- reused here
// verbatim rather than a fifth mock stack, DEC-613), (c) stating MATCHES or
// DIVERGES in its own title with the divergence named, and (d) asserting
// the returned HTML string's markup only. Full prose lives in
// `docs/design/audit/public-390-verdicts-v12.md`.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicRoutes } from "../src/routes/public";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";
import { DEC_976 } from "../src/decisions";

// DEC-976 wave-158 amendment (src/decisions-data/DEC-976.md): "an SSR
// surface's per-frame verdict is a `test/<surface>-390-frame-verdicts.test.ts`
// file ... entered by dispatching a REAL request through a Hono app with
// the actual route module mounted ... asserting the returned HTML string's
// markup structure and order only". void-referenced so the dependency is
// compile-checked (src/decisions.ts).
void DEC_976;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- a citation that cannot silently
 * rot to a wrong line the way a bare `:line` reference can. Same idiom as
 * app/src/pages/Settings.frame-verdicts.render.test.tsx's own
 * verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// ---------------------------------------------------------------------------
// Shared harness plumbing (copied from test/public-agenda-rail.test.ts /
// test/public-schedule-dock.test.ts / test/submit-name-collapse.test.ts --
// never a sixth reimplementation, DEC-613).
// ---------------------------------------------------------------------------

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

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

// ---------------------------------------------------------------------------
// Public agenda + My schedule harness (mirrors public-agenda-rail.test.ts's
// buildApp() exactly: [event, tracks, dayCounts, agendaCount, breaks,
// rooms, subRows, trackRows, ...] for /agenda, and the shorter
// [event, tracks, count, breaks, rooms, subRows, ...] shape for /schedule).
// ---------------------------------------------------------------------------

const AGENDA_EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

const SLOT_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 570, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-10", startMin: 600, endMin: 630, roomId: "room1" },
];

function buildAgendaApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([AGENDA_EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: SLOT_ROWS.length }]); // getPublicScheduleDayCounts
      if (selectCall === 4) return makeChain([{ count: SLOT_ROWS.length }]); // getPublicAgenda count(*)
      if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 6) return makeChain([{ id: "room1", name: "Main Hall", position: 1 }]); // room lookup
      if (selectCall === 7) {
        return makeChain([
          { id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 },
          { id: "sub2", seq: 2, title: "Docs That Answer Back", description: null, icsSequence: 0 },
        ]); // hydrateSessions subRows
      }
      return makeChain([]); // trackRows/speakerRows/slotRows/formatRows
    },
    selectDistinct: () => makeChain(SLOT_ROWS),
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

function buildScheduleApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([AGENDA_EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ count: 1 }]); // getPublicAgenda count(*)
      if (selectCall === 4) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 5) return makeChain([{ id: "room1", name: "Main Hall" }]); // room lookup
      if (selectCall === 6) {
        return makeChain([{ id: "sub1", seq: 1, title: "Taming 40-Minute CI", description: null, icsSequence: 0 }]);
      }
      return makeChain([]);
    },
    selectDistinct: () =>
      makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }]),
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Submit-a-talk (GET) + Submitted (POST, three DEC-098 states) harness
// (mirrors test/submit-name-collapse.test.ts's makeChain/fakeDb/appWithDb
// exactly).
// ---------------------------------------------------------------------------

const SUBMIT_EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const SUBMIT_FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at DevFlow Conf 2027",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const SUBMIT_TRACK_ROW = { id: "track-1", name: "Platform & Infra" };

const SUBMIT_FIELD_ROWS = [
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

function submitMakeChain(rows: unknown[]) {
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

function submitFakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return submitMakeChain(rows);
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
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

function submitFakeKv() {
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
const SUBMIT_BINDINGS = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

/** select-queue order per submit-post.tsx / submit-name-collapse.test.ts's
 * own documenting comment: getEventBySlug, getDefaultForm, getFormFields,
 * getEventTracks, findContactByEmail, nextSubmissionSeq (inside
 * createSubmission), findAccountUserId. */
function submitSelectQueue(opts: {
  existingContact?: { id: string; title: string | null; company: string | null; bio: string | null } | null;
  accountUser?: { id: string; contactId: string | null; email: string } | null;
}): unknown[][] {
  return [
    [SUBMIT_EVENT_ROW],
    [SUBMIT_FORM_ROW],
    SUBMIT_FIELD_ROWS,
    [SUBMIT_TRACK_ROW],
    opts.existingContact ? [opts.existingContact] : [],
    [{ seq: 48 }],
    opts.accountUser ? [opts.accountUser] : [],
  ];
}

function submitForm(): FormData {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "Taming 40-Minute CI: Incremental Builds at Monorepo Scale");
  form.set("field__description", "A talk about CI.");
  form.set("speaker_name", "Priya Raman");
  form.set("field__email", "priya@example.com");
  form.set("field__field_session_format", "Talk (30 min)");
  form.set("trackIds", "track-1");
  return form;
}

async function postSubmit(opts: Parameters<typeof submitSelectQueue>[0]) {
  const { db } = submitFakeDb(submitSelectQueue(opts));
  const app = appWithDb(db);
  const req = new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: submitForm(),
  });
  const res = await app.request(req, undefined, {
    ...SUBMIT_BINDINGS,
    KV: submitFakeKv(),
    FILES: fakeFilesBucket(),
  } as unknown as AppEnv["Bindings"]);
  return res;
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

describe("PUBLIC SSR 390 frame render verdicts (task w14-sf, DEC-976 wave-158 SSR amendment)", () => {
  it("frame :371 Public agenda -- MATCHES: day-pill strip + \"My schedule\" pill, per-session Save action, Download .ics / Speakers dock band", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:378 `min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:600">Tue 12</span>`
    verbatimLine(378, '          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:600">Tue 12</span>');
    installFakeCaches();
    const res = await buildAgendaApp().request("/e/conf/agenda", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :378-381's day-strip: one pill per event day plus the "My schedule"
    // fourth pill (agenda-controls.tsx's DaySwitcher).
    const dayPills = [...html.matchAll(/<a class="chq-pub-day-pill[^"]*"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]!.trim());
    expect(dayPills.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('class="chq-pub-day-pill chq-pub-my-schedule-pill"');
    expect(html).toContain("My schedule");

    // :395 `{{ s.action }}` -- the per-session Save/Saved control.
    expect(html).toContain('class="chq-pub-agenda-list-item"');
    expect(html).toMatch(/>Save<|>Saved</);

    // :400-402 dock band -- Download .ics (filled) + Speakers (bordered).
    expect(html).toContain('class="chq-pub-agenda-dock"');
    expect(html).toContain('id="chq-ics-link-dock"');
    const dock = html.split('class="chq-pub-agenda-dock"')[1]?.split("</div>")[0] ?? "";
    expect(dock).toContain("Download .ics");
    expect(html).toContain('class="chq-pub-agenda-dock-cross" href="/e/conf/speakers">');
    expect(html).toContain("Speakers</a>");
  });

  it("frame :864 My schedule · /schedule -- MATCHES: h1 + subtitle placeholder, per-row Remove action, Download .ics / All sessions dock band", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:867 `line-height:1.05">My schedule</h1>`
    verbatimLine(867, `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">My schedule</h1>`);
    installFakeCaches();
    const res = await buildScheduleApp().request("/e/conf/schedule", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("<h1");
    expect(html).toContain(">My schedule</h1>");
    // :868 draws the SAMPLE state "4 saved · 2 overlaps · no account
    // needed"; the SSR response is pre-hydration and renders the JS-fillable
    // placeholder "0 saved · 0 overlaps" (agenda-itinerary-script.tsx's
    // updateLink appends the "· no account needed" clause client-side once
    // localStorage is read) -- a real, honest divergence from the frame's
    // sample byte-for-byte, though not from its STRUCTURE.
    expect(html).toContain('id="chq-schedule-subtitle"');
    const subtitle = html.split('id="chq-schedule-subtitle"')[1]?.split("</span>")[0] ?? "";
    expect(subtitle).toContain("0 saved · 0 overlaps");
    // "no account needed" DOES appear elsewhere in the response -- inline
    // inside agenda-itinerary-script.tsx's client-side updateLink(), which
    // fills that clause into the subtitle at runtime once localStorage is
    // read -- so this scopes to the SSR subtitle span itself, not the
    // whole document.
    expect(subtitle).not.toContain("no account needed");

    // :880 per-row action is "Remove", never "Save"/"Saved".
    expect(html).toContain('class="chq-pub-schedule-remove"');
    expect(html).toContain("<span>Remove</span>");

    // :884-886 dock band.
    expect(html).toContain('class="chq-pub-schedule-dock"');
    const dockIcsMatch = html.match(/<a id="chq-ics-link-dock"[^>]*>([^<]*)<\/a>/);
    expect(dockIcsMatch).toBeTruthy();
    expect(dockIcsMatch![1]!.trim()).toBe("Download .ics");
    expect(html).toContain('class="chq-pub-schedule-dock-cross" href="/e/conf/sessions">');
    expect(html).toContain(">All sessions</a>");
  });

  it("frame :1017 Submit a talk -- DIVERGES (label wording): phone two-step chrome MATCHES; the Format fieldset's legend reads \"Session format\", the frame draws \"Format\"; the dock's second button reads \"Save draft\", the frame draws \"Draft\"", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1022 `text-transform:uppercase; color:#565A4B">Step 1 of 2 · your talk</span>`
    verbatimLine(1022, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#565A4B">Step 1 of 2 · your talk</span>');
    const db = submitFakeDb([[SUBMIT_EVENT_ROW], [SUBMIT_FORM_ROW], SUBMIT_FIELD_ROWS, [SUBMIT_TRACK_ROW]]).db;
    const app = appWithDb(db);
    const res = await app.request("/submit/test-conf", { headers: {} }, { KV: submitFakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1022 phone-only step chrome (w14-f, DEC-986) -- inert on desktop,
    // exactly the label the frame draws.
    expect(html).toContain('class="chq-cfp-steps-label"');
    expect(html).toContain("Step 1 of 2");
    expect(html).toContain("your talk");
    expect(html).toContain('class="chq-cfp-steps-bar"');

    // :1042 Track fieldset -- MATCHES exactly.
    expect(html).toContain("<legend>Track</legend>");
    // :1051's own legend literal is the bare word "Format"; FormatChoices
    // (submit-views.tsx:288) renders `<legend>{field.label}</legend>`, and
    // the form field's stored label is "Session format" (also seeded this
    // way in test/submit-cfp-frame-copy.test.ts's FIELD_ROWS) -- one word
    // longer than the frame's literal, never trimmed to it.
    expect(html).toContain("<legend>Session format</legend>");
    expect(html).not.toContain("<legend>Format</legend>");

    // :1061-1063 dock: frame's filled primary reads "Next: about you"
    // (matches) and its bordered second control reads "Draft" -- the tree's
    // equivalent control (.chq-cfp-save-draft, the same geometry per
    // cfp.css.ts's own ":428 Draft" comment) is labeled "Save draft", one
    // word longer than the frame's literal.
    expect(html).toContain('class="chq-btn chq-btn-primary chq-cfp-step-next"');
    expect(html).toContain("Next: about you");
    const saveDraftMatch = html.match(/<button[^>]*class="chq-btn chq-btn-secondary chq-cfp-save-draft"[^>]*>([^<]*)<\/button>/);
    expect(saveDraftMatch).toBeTruthy();
    expect(saveDraftMatch![1]!.trim()).toBe("Save draft");
    expect(saveDraftMatch![1]!.trim()).not.toBe("Draft");
  });

  it("frame :1074 Submitted -- MATCHES (DEC-908 wave-16 amendment): the confirmation card carries the frame's third speaker·company line, and the way-forward link reads \"Browse the sessions\"", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1081 `Priya Raman · Latticework Systems</span>`
    verbatimLine(1081, '          <span style="font-size:13px; color:#565A4B">Priya Raman · Latticework Systems</span>');
    const res = await postSubmit({});
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1076 "Submitted · DFC-048" eyebrow shape -- MATCHES (SUBMITTED ·
    // ref, uppercase applied by cfp.css.ts's chq-cfp-confirm-flag rule).
    expect(html).toContain('class="chq-cfp-confirm-flag"');
    expect(html).toMatch(/SUBMITTED[^<]*SES-048/);
    // :1077 title -- MATCHES exactly.
    expect(html).toContain("That&#39;s in. Check your email.");
    // :1078-1081 card: title + meta MATCH (:1080's "Talk, 30 min ·
    // <track> · <level>" shape); :1081's own speaker line now has a
    // counterpart -- a second .chq-cfp-confirm-card-meta span (DEC-908
    // wave-16 amendment, submit-views.tsx's fresh-state branch). The
    // synthetic form in this file never sets a company field, so the
    // built line is the bare name.
    const card = html.split('class="chq-cfp-confirm-card"')[1]?.split("</div>")[0] ?? "";
    expect(card).toContain("Taming 40-Minute CI");
    const metaSpans = [...card.matchAll(/class="chq-cfp-confirm-card-meta"/g)];
    expect(metaSpans.length).toBe(2);
    expect(card).toContain("Priya Raman");
    // :1088 password block -- MATCHES.
    expect(html).toContain("Set a password now");
    expect(html).toContain('class="chq-btn chq-btn-primary" href="/claim/');
    expect(html).toContain("Create a password");
    // :1091-1092 way-forward links: the frame's own literal is "Browse the
    // sessions ›" -- the tree now names the anchor for its destination.
    expect(html).toContain('href="/e/test-conf/sessions"');
    expect(html).toContain("Browse the sessions");
    expect(html).not.toContain("Browse the programme");
  });

  it("frame :1124 Submitted · email already known -- MATCHES: no claim link on screen (DEC-098), card carries title + one meta line, password-link body + Log in ›", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1134 `Already have a password?</span>`
    verbatimLine(1134, '          <span style="font-size:14px; line-height:1.6; color:#3F4237">Already have a password?</span>');
    const res = await postSubmit({ existingContact: { id: "contact-1", title: null, company: null, bio: null } });
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("That&#39;s in. Check your email.");
    // :1129-1130 card: title + ONE meta line -- no third speaker/company
    // line in THIS frame either, and the tree's card shape (title + meta,
    // two children) matches it exactly.
    const card = html.split('class="chq-cfp-confirm-card"')[1]?.split("</div>")[0] ?? "";
    expect(card).toContain("Taming 40-Minute CI");
    // DEC-908 (wave-16 amendment): the identity line is fresh-state only --
    // this state carries exactly the one meta line the frame draws, no
    // second .chq-cfp-confirm-card-meta span.
    const metaSpans1124 = [...card.matchAll(/class="chq-cfp-confirm-card-meta"/g)];
    expect(metaSpans1124.length).toBe(1);
    expect(card).not.toContain("Priya Raman");
    // DEC-098: no /claim/ token rendered on screen for a pre-existing,
    // not-yet-account-holding contact.
    expect(html).not.toContain("/claim/");
    // :1134-1135 "Already have a password?" + "Log in ›", exactly one
    // /login anchor.
    expect(html).toContain("Already have a password?");
    const loginAnchors = [...html.matchAll(/<a[^>]*href="\/login"/g)];
    expect(loginAnchors).toHaveLength(1);
    expect(html).toMatch(/Log in\s*(?:&rsaquo;|›)/);
  });

  it("frame :1147 Submitted · has an account -- MATCHES: \"You already have an account here.\" + the filled \"Log in to track it\" primary, no claim path", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1158 `Log in to track it</span>`
    verbatimLine(1158, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Log in to track it</span>');
    const existingContact = { id: "contact-1", title: null, company: null, bio: null };
    const accountUser = { id: "user-1", contactId: "contact-1", email: "priya@example.com" };
    const res = await postSubmit({ existingContact, accountUser });
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("That&#39;s in. Check your email.");
    // DEC-908 (wave-16 amendment): the identity line is fresh-state only --
    // this state carries no second .chq-cfp-confirm-card-meta span.
    const card1147 = html.split('class="chq-cfp-confirm-card"')[1]?.split("</div>")[0] ?? "";
    const metaSpans1147 = [...card1147.matchAll(/class="chq-cfp-confirm-card-meta"/g)];
    expect(metaSpans1147.length).toBe(1);
    expect(card1147).not.toContain("Priya Raman");
    // :1157 the account-holder line, verbatim.
    expect(html).toContain("You already have an account here.");
    // :1158 the filled primary CTA -- a real .chq-btn-primary anchor to
    // /login, no /claim/ path minted or rendered for an existing user.
    expect(html).toMatch(/<a class="chq-btn chq-btn-primary" href="\/login">\s*Log in to track it\s*<\/a>/);
    expect(html).not.toContain("/claim/");
  });
});
