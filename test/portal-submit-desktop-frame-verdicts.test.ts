// DESKTOP render verdicts, Submit/CFP window states + Portal SSR (task
// w24-i). MEASUREMENT ONLY: this file fixes nothing, touches no route
// module and no `*.css.ts`, moves no desktop byte.
//
// HARNESS RULE (DEC-613 wave-24 amendment): every harness below is COPIED,
// never re-authored, from an existing buildApp -- a fifth mock stack is a
// second vocabulary. For /submit and public-sessions frames this file
// reuses test/public-390-frame-verdicts.test.ts's mock-free `Hono<AppEnv>`
// + `publicSubmitRoutes`/`publicRoutes` + `registerErrorHandler` +
// `CSRF_COOKIE_NAME` + `app.request(route)` shape. For the two /portal
// frames it reuses test/portal-390-frame-verdicts.test.ts's four `vi.mock`
// blocks over `src/server/repo/portal*` plus its `buildApp()` and
// `speakerAuth`. Copied unchanged; only path, auth and fixture VALUES vary.
// A frame this harness cannot reach is recorded UNREACHED in the summary
// table below, naming the missing capability, rather than a fifth mock
// stack (DEC-613).
//
// STATE-DRIVEN, NEVER DIRECTLY MOUNTED (DEC-651 wave-24 amendment): the
// two CFP-window states (:1101 closed, :1532 not-yet-open) and the
// fresh-empty sessions state (:1167) are page STATES the route reaches by
// its own formWindowState()/isFresh predicate over real fixture dates and
// row counts -- never by importing ClosedPage/NotYetOpenPage and mounting
// it directly, which would verdict the component in isolation rather than
// the route that decides to render it.
//
// Full prose lives in docs/design/audit/portal-desktop-v12.md.
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicRoutes } from "../src/routes/public";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";
import { DEC_613, DEC_651 } from "../src/decisions";

// DEC-613 wave-24 amendment (src/decisions-data/part3.ts): "a desktop SSR
// verdict lane imports or copies one of the three existing harnesses
// unchanged ... If a frame's route cannot be reached that way, the lane
// records it as UNREACHED". void-referenced so the dependency is
// compile-checked (src/decisions.ts).
void DEC_613;
// DEC-651 wave-24 amendment (src/decisions-data/part4.ts): "a state frame
// is reached by driving the state itself ... never by rendering the
// state's component directly". void-referenced so the dependency is
// compile-checked (src/decisions.ts).
void DEC_651;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- copied from
 * test/public-390-frame-verdicts.test.ts's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// ---------------------------------------------------------------------------
// PUBLIC/SUBMIT harness -- copied verbatim from
// test/public-390-frame-verdicts.test.ts (itself copied from
// test/public-agenda-rail.test.ts / test/submit-name-collapse.test.ts,
// DEC-613).
// ---------------------------------------------------------------------------

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

const SUBMIT_EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const SUBMIT_FORM_ROW_OPEN = {
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

async function getSubmit(db: AppEnv["Variables"]["db"]) {
  const app = appWithDb(db);
  return app.request("/submit/test-conf", { headers: {} }, { KV: submitFakeKv() } as unknown as AppEnv["Bindings"]);
}

// ---------------------------------------------------------------------------
// PUBLIC SESSIONS harness -- copied verbatim from
// test/public-390-frame-verdicts.test.ts's Public agenda/schedule
// db-select-chain idiom, extended (fixture VALUES only) to the /sessions
// surface's larger select fan-out (getPublicTracks/Rooms/FormatOptions/
// Sessions/dayCounts/cfpWindow/getPriorPublicEvent), traced call-by-call
// against the real route (no capability re-authored, only which fixture
// row each already-established `select()` call receives).
// ---------------------------------------------------------------------------

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

const SESSIONS_EVENT_ROW = {
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

const PRIOR_EVENT_ROW = {
  ...SESSIONS_EVENT_ROW,
  id: "ev0",
  slug: "conf-2026",
  name: "Test Event 2026",
  startDate: "2025-08-10",
  endDate: "2025-08-11",
};

/** select() call order for GET /e/:slug/sessions on a fresh (never-
 * published), no-filter request, TRACED against the real route (a
 * `select`-logging probe run against dispatch.tsx's sessions case +
 * getPriorPublicEvent + its getPublicSurfaceCounts, not guessed from
 * reading the source): #1 getPublicEventBySlug, #2 getPublicTracks,
 * #3 getPublicRooms, #4 getPublicFormatOptions, #5 getPublicSessions items
 * (selectDistinct -- routed through its own db method below, so it does
 * NOT consume a `select()` ordinal), #6 getPublicScheduleDayCounts,
 * #7 getPublicCfpWindow, #8 getPriorPublicEvent's event-by-org lookup
 * (grandTotal is already 0 off the sessions page, so isFreshEmpty is true
 * and this fires), #9 getPublicSurfaceCounts' own event startDate/endDate
 * lookup, #10 its sessionRows count (the scheduled/speaker counts race
 * behind it in the same Promise.all but are never read by
 * getPriorPublicEvent). Built with a fresh-empty session page (grandTotal
 * 0) so the route's own isFresh predicate — not a hand-set prop — decides
 * the branch (DEC-651).
 */
function buildSessionsApp(opts: { lastYear: boolean }) {
  let call = 0;
  const db = {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([SESSIONS_EVENT_ROW]);
      if (call === 8 && opts.lastYear) return makeChain([PRIOR_EVENT_ROW]);
      if (call === 9 && opts.lastYear) return makeChain([{ startDate: "2025-08-10", endDate: "2025-08-11" }]);
      if (call === 10 && opts.lastYear) return makeChain([{ count: 48 }]);
      return makeChain([]);
    },
    selectDistinct: () => makeChain([]),
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
// PORTAL harness -- copied verbatim from
// test/portal-390-frame-verdicts.test.ts's four vi.mock blocks + buildApp()
// + speakerAuth (DEC-613; that file's own header cites this same idiom as
// copied from test/portal-page-headings.test.ts).
// ---------------------------------------------------------------------------

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
    getAssignmentScope: vi.fn(async () => null),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async () => null),
    getMyResources: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    listFields: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (): Promise<EditableSubmissionData | null> => ({
      submission: { id: "s1", status: "pending", title: "Taming 40-Minute CI", description: "desc" },
      form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
      fields: [
        { id: "first_name", section: "speaker", kind: "text", label: "First name", required: true, position: 0 },
      ] as FormFieldDef[],
      answers: { first_name: "Jane" },
      offeredTrackIds: [],
      allTracks: [],
      selectedTrackIds: [],
      formatLabel: null,
    })),
    getPortalParticipants: vi.fn(async () => [
      { id: "p1", name: "Priya Raman", role: "speaker", note: "", noteStyle: "" },
    ]),
    getAllSubmissionParticipants: vi.fn(async () => [
      { id: "p1", name: "Priya Raman", role: "speaker", note: "", noteStyle: "" },
    ]),
  };
});

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  const profile: ContactProfile = {
    id: "ct-1",
    firstName: "Priya",
    lastName: "Raman",
    title: null,
    company: null,
    bio: null,
    headshotUrl: null,
    socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
  };
  return {
    ...actual,
    getContactProfile: vi.fn(async () => profile),
  };
});

async function buildPortalApp(auth: AuthInfo | null): Promise<Hono<AppEnv>> {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const { portalProfileRoutes } = await import("../src/routes/portal/profile");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  app.route("/portal", portalTasksRoutes);
  app.route("/portal", portalEditRoutes);
  app.route("/portal", portalProfileRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

describe("DESKTOP SSR frame verdicts -- Submit/CFP window states + Portal SSR (task w24-i)", () => {
  it("frame :894 'Submit a talk · /submit/:slug' -- MATCHES: h1 'Submit a talk', the Track/Format two-column row, and the Submit/Save-draft action pair, at the open window state", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:894 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Submit a talk · /submit/:slug</span>`
    verbatimLine(894, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Submit a talk · /submit/:slug</span>');
    installFakeCaches();
    const { db } = submitFakeDb([[SUBMIT_EVENT_ROW], [SUBMIT_FORM_ROW_OPEN], SUBMIT_FIELD_ROWS, [SUBMIT_TRACK_ROW]]);
    const res = await getSubmit(db);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('<h1 class="chq-pub-surface-title">Submit a talk');
    // :925-943 the Track/Format two-column row -- desktop-frames-public.
    // test.ts already claims the class token by source citation; this
    // verdict asserts the token actually renders in a real response.
    expect(html).toContain('class="chq-cfp-track-format-row"');
    expect(html).toContain("<legend>Track</legend>");
    expect(html).toContain("<legend>Session format</legend>");
    // :989-990 dock: primary "Submit this talk" + secondary "Save draft".
    expect(html).toContain(">Submit this talk<");
    expect(html).toContain(">Save draft<");
  });

  it("frame :1101 'CFP closed' -- MATCHES: driven by a form.closeDate in the past through formWindowState, never ClosedPage mounted directly (DEC-651)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1101 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP closed</span>`
    verbatimLine(1101, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">CFP closed</span>');
    // Raw db row: getDefaultForm calls row.closeDate.getTime(), a Date.
    const closedForm = { ...SUBMIT_FORM_ROW_OPEN, closeDate: new Date(Date.UTC(2020, 0, 1)) };
    const res = await getSubmit(submitFakeDb([[SUBMIT_EVENT_ROW], [closedForm]]).db);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1103 heading + :1104 body + :1107 the frame's one link.
    expect(html).toContain("The call for papers has closed");
    expect(html).toContain("Submissions closed on");
    expect(html).toContain("Browse the sessions ›");
    // The window-state predicate, not a hand-mounted ClosedPage, made this
    // branch happen -- confirmed by the same request never reaching the
    // form fields the open-state frame above renders.
    expect(html).not.toContain('class="chq-cfp-track-format-row"');
  });

  it("frame :1532 'CFP not open yet · /submit/:slug' -- MATCHES (DESIGN-RULINGS 'CFP — the third window state'): driven by a form.openDate in the future through formWindowState, date-led heading, no apology", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1532 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP not open yet · /submit/:slug</span>`
    verbatimLine(1532, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">CFP not open yet · /submit/:slug</span>');
    // 3rd queue slot is getPriorPublicEvent's own select -- [] means "none".
    const notYetOpenForm = { ...SUBMIT_FORM_ROW_OPEN, openDate: new Date(Date.UTC(2099, 1, 1)) };
    const res = await getSubmit(submitFakeDb([[SUBMIT_EVENT_ROW], [notYetOpenForm], []]).db);
    expect(res.status).toBe(200);
    const html = await res.text();

    // DESIGN-RULINGS: "the heading LEADS with the date the form opens,
    // never an apology" -- the dateless "aren't open yet" wording is
    // reserved for a form with no open_date set, so this fixture (a real
    // openDate) must render the dated heading, not the apology fallback.
    expect(html).toContain("The call for papers opens on");
    expect(html).not.toContain("Submissions aren&#39;t open yet");
    expect(html).toContain("You will not need an account.");
  });

  it("frame :1167 'Public sessions · nothing published' -- MATCHES: GET /e/:slug/sessions with zero visible sessions renders the fresh-empty block via SessionsContent's own isFresh predicate (DEC-651), including the 'Last year' aside when a qualifying prior edition exists", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1167 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Public sessions · nothing published</span>`
    verbatimLine(1167, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Public sessions · nothing published</span>');
    installFakeCaches();
    const bindings = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];
    const res = await buildSessionsApp({ lastYear: true }).request("/e/conf/sessions", {}, bindings);
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1174-1175 headline + reason (DEC-745 wave-107 amendment: this app's
    // reason sentence deliberately diverges from the frame's "closed on 16
    // August" -- a day label derived from a stored instant is a timezone
    // bomb, DEC-522 -- named here rather than force-fit).
    expect(html).toContain('class="chq-pub-sessions-fresh-layout"');
    expect(html).toContain(">The programme is not out yet<");
    // :1187-1198 the "Last year" aside -- test/desktop-frames-portal.
    // test.ts (v12m-w5-c) filed this as an unclaimed divergence ("No such
    // feature exists anywhere in the tree"); test/public-sessions-
    // lastyear.test.ts later built it via a direct SessionsContent(...)
    // call. This verdict is the first to prove it live off a real request:
    // the route's own getPriorPublicEvent call renders it, unprompted by
    // any hand-built prop.
    expect(html).toContain('class="chq-pub-lastyear-rail"');
    expect(html).toContain("<span>Last year</span>");
    expect(html).toContain('class="chq-pub-lastyear-link" href="/e/conf-2026/sessions">');
  });

  it("frame :1211 'Submit a talk · rejected on submit' -- MATCHES: a real POST with missing/invalid answers renders ErrorSummary's ('N things need fixing' + per-problem links + reassurance line) top-of-form band, in that order, both actions still present", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1211 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Submit a talk · rejected on submit</span>`
    verbatimLine(1211, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Submit a talk · rejected on submit</span>');
    // The required field this POST deliberately withholds, so the rejection
    // below is a real product validation failure, not a fixture artefact.
    expect(SUBMIT_FIELD_ROWS.some((f) => f.id === "description" && f.required)).toBe(true);
    const { db } = submitFakeDb([[SUBMIT_EVENT_ROW], [SUBMIT_FORM_ROW_OPEN], SUBMIT_FIELD_ROWS, [SUBMIT_TRACK_ROW]]);
    const app = appWithDb(db);
    const form = new FormData();
    form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
    form.set("field__title", "Docs That Answer Back");
    // field__description deliberately omitted (required) -- the frame's
    // own three problems are illustrative sample copy (an over-limit
    // abstract, an unpicked track, a malformed email); this verdict
    // exercises the SAME summary mechanism with this product's own real
    // validation failures rather than re-typing the frame's sample text.
    form.set("speaker_name", "Dana Whitmore");
    form.set("field__email", "not-an-email");
    // trackIds deliberately omitted -- "Track — pick one".
    const req = new Request("http://local/submit/test-conf", {
      method: "POST",
      headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
      body: form,
    });
    const res = await app.request(req, undefined, {
      ...SUBMIT_BINDINGS,
      KV: submitFakeKv(),
      FILES: fakeFilesBucket(),
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(400);
    const html = await res.text();

    // :1136 heading anatomy ("Three things need fixing before this can be
    // sent") -- this fixture's own problem count varies from the frame's
    // sample; asserted structurally via thingsNeedFixingHeading's shared
    // stem rather than a hardcoded "Three".
    expect(html).toContain('class="chq-error-summary" role="alert"');
    expect(html).toMatch(/<h2>[^<]*things need fixing before this can be sent<\/h2>/);
    const summaryBlock = html.split('class="chq-error-summary" role="alert"')[1]?.split("</div>")[0] ?? "";
    expect((summaryBlock.match(/class="chq-error-summary-link"/g) ?? []).length).toBeGreaterThanOrEqual(1);
    // :1147 the reassurance line closes the panel.
    expect(summaryBlock).toContain("Nothing was lost. Everything you typed is still below.");
    // :1290-1292 both actions still render below the summary -- the frame's
    // own rule (nothing typed is discarded on a rejected submit).
    expect(html).toContain(">Submit this talk<");
    expect(html).toContain(">Save draft<");
  });

  it("frame :1373 'Portal · Edit your session · desktop' -- MATCHES (DEC-029 wave-108): the co-presenter Add control is a SECOND SUBMIT of #chq-portal-edit-form via formaction/formenctype, never a second form", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1373
    // docs/design/Chautauqua Public and Portal.dc.html:1373 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal · Edit your session · desktop</span>`
    verbatimLine(1373, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Portal · Edit your session · desktop</span>');
    const app = await buildPortalApp(speakerAuth);
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1387 h1, :1382-1408 title/abstract fields, :1418 "On this session",
    // :1444 "Add a co-presenter", :1465 the footer Cancel/Save changes row
    // -- one <form id="chq-portal-edit-form">, exactly one.
    expect(html).toContain(">Edit your session<");
    expect((html.match(/<form id="chq-portal-edit-form"/g) ?? []).length).toBe(1);
    expect(html).toContain(">On this session<");
    expect(html).toContain(">Add a co-presenter<");
    // DEC-029 wave-108: every co-presenter control carries
    // form="chq-portal-edit-form" (a second SUBMIT of the one form), and
    // the Add button additionally carries formaction/formenctype so
    // in-progress title/abstract/track edits ride along with it.
    expect(html).toContain('id="cp-first-name" form="chq-portal-edit-form"');
    expect(html).toContain('id="cp-last-name" form="chq-portal-edit-form"');
    expect(html).toContain('id="cp-role" form="chq-portal-edit-form"');
    const addBtnMatch = html.match(/<button[^>]*form="chq-portal-edit-form"[^>]*formaction="\/portal\/submissions\/[^"]*\/participants"[^>]*formenctype="multipart\/form-data"[^>]*>Add co-presenter<\/button>/);
    expect(addBtnMatch).toBeTruthy();
    expect(html).toContain(">Save changes<");
    expect(html).toContain(">Cancel<");
  });

  it("frame :1473 'Portal preview · /portal/preview' -- UNREACHED via the mandated portal-390 harness (DEC-613): the route reads src/server/repo/events.ts getEventForOrg + src/server/repo/portal-config.ts getPortalSettingsForEvent/listResourcesForEvent directly, none of which portal-390-frame-verdicts.test.ts's four vi.mock blocks (repo/portal, repo/forms, repo/portal-edit, repo/profile) cover -- reaching it would require a fifth mock stack this task's own instruction forbids", () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1473 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal preview · /portal/preview</span>`
    verbatimLine(1473, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Portal preview · /portal/preview</span>');
    // preview.tsx's GET /preview handler reads db directly, no repo mock.
    const previewSrc = readFileSync(join(REPO_ROOT, "src", "routes", "portal", "preview.tsx"), "utf-8");
    expect(previewSrc).toContain('from "../../server/repo/events"');
    expect(previewSrc).toContain('from "../../server/repo/portal-config"');
    const mockedTargets = ["../src/server/repo/portal\"", "../src/server/repo/forms\"", "../src/server/repo/portal-edit\"", "../src/server/repo/profile\""];
    for (const target of mockedTargets) {
      expect(previewSrc).not.toContain(target);
    }
    // MISSING CAPABILITY: a fake `db` chain (the public-390 harness's
    // makeChain idiom) that answers getEventForOrg's event-row select and
    // getPortalSettingsForEvent's/listResourcesForEvent's own selects --
    // the portal-390 harness supplies none of that (its buildApp() sets
    // `c.set("db", {} as never)` because every route it exercises reaches
    // the db only through a mocked repo function). Building one here would
    // be the fifth mock stack DEC-613 forbids; recorded UNREACHED instead.
  });
});
