// PORTAL + PUBLIC-EMPTY SSR DESKTOP render verdicts (task w26-h): the last
// three Public-and-Portal desktop frames no ledger owns -- :1373 "Portal ·
// Edit your session · desktop", :1473 "Portal preview · /portal/preview",
// :1167 "Public sessions · nothing published". `docs/design/audit/
// desktop-frame-ledger-v12.md`'s own population lists these among 108
// desktop frames; `test/desktop-frames-portal.test.ts` cites all three by
// line (a source scan -- readFileSync + a nearby expect(), never a
// dispatched request, DEC-976 wave-25's "SSR phone-frames tests were source
// scans not requests" lesson applies to desktop the same way) and its own
// header comment leaves :1167 explicitly UNCLAIMED, citing a "Last year"
// aside it says has no feature behind it anywhere in the tree. That comment
// is stale (grep the tree, not the comment, DEC-976 wave-25): dispatch.tsx's
// `getPriorPublicEvent` + `SessionsContent`'s `.chq-pub-lastyear-rail` both
// exist and are wired together, so this file grades what actually renders
// today, not what an earlier wave found.
//
// MEASUREMENT ONLY (DEC-651 wave-26): this file fixes nothing, touches no
// route module and no `.css.ts`. Every `it()` dispatches a REAL request
// through a `Hono<AppEnv>` with the actual route sub-app mounted, asserts
// the returned HTML STRING's markup structure/order only, and states
// MATCHES or DIVERGES in its own title, naming the divergence.
//
// Harness for :1373/:1473 copied VERBATIM in shape from
// test/portal-390-frame-verdicts.test.ts's `Hono<AppEnv>` + mounted portal
// sub-app + `registerErrorHandler` + `app.request(route)` idiom, varying
// only path/fixtures (DEC-613: a second copy of a vocabulary is a trap --
// reuse the shape, not the mock targets, since :1473 needs the preview
// route's own repos). Harness for :1167 copied the same way from
// test/public-390-frame-verdicts.test.ts's `Hono` + `registerErrorHandler`
// + `publicRoutes` mount + `installFakeCaches`/`TEST_ENV` idiom, mocking the
// repo/public barrel directly (vi.mock, matching portal-390's own approach
// to its repos) rather than hand-rolling a seven-call db.select() chain for
// a surface neither existing file's fixtures exercise.
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerErrorHandler } from "../src/server/http";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { MAX_TEXT_LENGTH } from "../src/forms/validate";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { R2Bucket } from "@cloudflare/workers-types";
import { DEC_029, DEC_902, DEC_919 } from "../src/decisions";

// DEC-029 (wave-108 amendment, src/decisions-data/DEC-029.md): the edit
// screen's co-presenter controls are a SECOND SUBMIT of the ONE edit form
// (`form`/`formaction`/`formenctype`), never a second form -- the :1373
// verdict below asserts exactly that wiring. DEC-919 (wave 47 amendment):
// PublicEmptyState's fresh/filtered split -- the :1167 verdict below grades
// which branch the route takes. DEC-902 (wave-20 amendment): a wording
// residual against a v12 desktop frame is a work item, not a closed
// verdict -- the :1211 verdict below cites it for the dock-note
// divergence it names. Void-referenced so the dependency is
// compile-checked (src/decisions.ts).
void DEC_029;
void DEC_902;
void DEC_919;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- copied from
 * test/portal-390-frame-verdicts.test.ts's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Order-preserving check, copied from test/portal-390-frame-verdicts.test.ts. */
function expectInOrder(html: string, needles: string[]): void {
  let cursor = 0;
  for (const needle of needles) {
    const idx = html.indexOf(needle, cursor);
    expect(idx, `expected to find ${JSON.stringify(needle)} at or after index ${cursor}`).toBeGreaterThanOrEqual(0);
    cursor = idx + needle.length;
  }
}

// ---------------------------------------------------------------------------
// :1373 "Portal · Edit your session · desktop" -- speakerGate-mounted
// portalEditRoutes, GET /portal/submissions/:id/edit.
// ---------------------------------------------------------------------------

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalHome: vi.fn(async () => ({ views: [], placements: new Map() })),
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "DevFlow Conf 2027",
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
      // closeDate far in the future -> canEditSubmission/canEditTracks both
      // true regardless of when this suite runs (isFormClosed(closeDate,
      // now, tz) === now > end-of-day(closeDate), never true for a 2099
      // day label).
      form: { id: "f1", closeDate: Date.UTC(2099, 0, 1), timezone: "America/Los_Angeles" },
      fields: [
        { id: "first_name", section: "speaker", kind: "text", label: "First name", required: true, position: 0 },
      ] as EditableSubmissionData["fields"],
      answers: { first_name: "Priya" },
      offeredTrackIds: [],
      allTracks: [],
      selectedTrackIds: [],
      formatLabel: null,
    })),
    getPortalParticipants: vi.fn(async () => [
      {
        id: "p1",
        contactId: "ct-1",
        name: "Priya Raman",
        email: "priya@example.com",
        role: "presenter",
        roleLabel: "Presenter",
        visible: true,
        inviteStatus: "accepted",
      },
    ]),
    getAllSubmissionParticipants: vi.fn(async () => [
      {
        id: "p1",
        contactId: "ct-1",
        name: "Priya Raman",
        email: "priya@example.com",
        role: "presenter",
        roleLabel: "Presenter",
        visible: true,
        inviteStatus: "accepted",
      },
    ]),
  };
});

async function buildEditApp(): Promise<Hono<AppEnv>> {
  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalEditRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// :1473 "Portal preview · /portal/preview" -- organizer-gated
// portalPreviewRoutes, GET /portal/preview.
// ---------------------------------------------------------------------------


vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async () => ({
      id: "evt-1",
      orgId: "org-1",
      name: "DevFlow Conf 2027",
      slug: "devflow",
      startDate: "2027-05-12",
      endDate: "2027-05-14",
      location: null,
      timezone: "UTC",
      recordPrefix: "SES",
      branding: {},
      createdAt: 0,
      updatedAt: 0,
    })),
  };
});

vi.mock("../src/server/repo/portal-config", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-config")>(
    "../src/server/repo/portal-config",
  );
  return {
    ...actual,
    getPortalSettingsForEvent: vi.fn(async () => ({
      eventId: "evt-1",
      welcomeMessage: "Thanks for speaking at DevFlow.",
      accentColor: null,
      logoUrl: null,
      showResources: true,
    })),
    listResourcesForEvent: vi.fn(async () => [
      {
        id: "r1",
        eventId: "evt-1",
        kind: "file",
        title: "Speaker guide",
        content: null,
        fileId: "f1",
        position: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    ]),
  };
});


// ---------------------------------------------------------------------------
// :1167 "Public sessions · nothing published" -- publicRoutes,
// GET /e/:eventSlug/sessions, fresh-and-empty branch.
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

const TEST_ENV = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

const SESSIONS_EVENT = {
  id: "evt-2",
  orgId: "org-2",
  name: "DevFlow Conf 2027",
  slug: "devflow",
  startDate: "2027-05-12",
  endDate: "2027-05-14",
  location: "Moscone West, San Francisco",
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async () => SESSIONS_EVENT),
    getPublicTracks: vi.fn(async () => []),
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
    // Fresh-and-empty branch: zero rows, no facet in flight.
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    // DEC-745 (wave-107 amendment): resolved only on the fresh-empty
    // branch -- a prior same-org event with a non-zero visible session
    // count, so the frame's "Last year" aside has something to name.
    getPriorPublicEvent: vi.fn(async () => ({
      event: { ...SESSIONS_EVENT, id: "evt-1-prior", slug: "devflow-2026", name: "DevFlow Conf 2026" },
      sessionCount: 48,
    })),
  };
});

async function buildSessionsApp() {
  const { publicRoutes } = await import("../src/routes/public/index");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// :1101 "CFP closed", :1211 "Submit a talk · rejected on submit", :1532
// "CFP not open yet · /submit/:slug" -- the three window/error states of
// publicSubmitRoutes' GET/POST /submit/:eventSlug (DEC-976 wave-22
// amendment). These were previously covered only by
// test/desktop-frames-portal.test.ts's SOURCE SCAN (readFileSync + a
// nearby expect(), never a dispatched request). Harness copied VERBATIM
// in shape from test/cfp-desktop-frame-verdicts.test.ts's own fakeDb/
// appWithDb/fakeKv/fakeFilesBucket idiom (DEC-613: reuse the shape, not a
// seventh reimplementation) -- driven by real `form.closeDate`/`openDate`
// fixture values through the route's own `formWindowState` resolver
// (DEC-651), never by mounting ClosedPage/NotYetOpenPage directly.
// ---------------------------------------------------------------------------

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
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return submitMakeChain(rows);
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

function submitFakeFilesBucket(): R2Bucket {
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
}

function submitAppWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

const SUBMIT_CSRF_TOKEN = "test-csrf-token";
const SUBMIT_BINDINGS = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

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

describe("Portal + public-empty SSR desktop frame verdicts (Chautauqua Public and Portal.dc.html, task w26-h)", () => {
  it("frame :1373 'Portal · Edit your session · desktop' (GET /portal/submissions/:id/edit) -- MATCHES: back link, H1, session-length row, participants list, co-presenter block as a SECOND SUBMIT of #chq-portal-edit-form, terminal Save/Cancel row", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1373 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal · Edit your session · desktop</span>`
    verbatimLine(
      1373,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal · Edit your session · desktop</span>`,
    );
    const app = await buildEditApp();
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1385-1387 back link + H1 + close-date sub-line; :1391-1409 Title/
    // Abstract/Session-length fields; :1404-1414 the "On this session"
    // participants list; :1418-1444 "Add a co-presenter" section;
    // :1445-1452 the terminal Title-and-abstract note + Cancel/Save row.
    expectInOrder(html, [
      '<a href="/portal/submissions/s1" class="chq-portal-back">‹ Your session</a>',
      '<h1 class="chq-portal-hero chq-portal-hero-drill">Edit your session</h1>',
      '<form id="chq-portal-edit-form" method="post" action="/portal/submissions/s1/edit" enctype="multipart/form-data">',
      'class="chq-section-label">Session</div>',
      'class="chq-section-label">Speaker</div>',
      'aria-label="Participants" class="chq-section"',
      '<span>On this session</span>',
      '<span class="chq-portal-participant-name">Priya Raman</span>',
      '<h3 class="chq-section-label">Add a co-presenter</h3>',
      'name="firstName"',
      'name="lastName"',
      'name="email"',
      'name="role"',
      'class="chq-portal-actions-footer"',
      '<a class="chq-btn chq-btn-secondary" href="/portal/submissions/s1">',
      '<button type="submit" form="chq-portal-edit-form" class="chq-btn chq-btn-primary">Save changes</button>',
    ]);

    // DEC-029 (wave-108 amendment): the co-presenter controls are a SECOND
    // SUBMIT of #chq-portal-edit-form, never a second <form> of their own.
    // Exactly THREE <form> elements exist on the whole page: the one edit
    // form (id="chq-portal-edit-form"), plus PortalLayout's own two shared
    // sign-out forms (header + footer, chrome every /portal/* page carries,
    // DEC-154) -- never a fourth, standalone co-presenter form.
    expect((html.match(/<form/g) ?? []).length).toBe(3);
    expect((html.match(/<form id="chq-portal-edit-form"/g) ?? []).length).toBe(1);
    expect((html.match(/action="\/logout"/g) ?? []).length).toBe(2);
    expect(html).toContain('id="cp-first-name" form="chq-portal-edit-form"');
    expect(html).toContain('id="cp-last-name" form="chq-portal-edit-form"');
    expect(html).toContain('id="cp-email" form="chq-portal-edit-form"');
    expect(html).toContain('id="cp-role" form="chq-portal-edit-form"');
    // The add button rides the edit form via formaction/formenctype, never
    // its own <form>.
    expect(html).toMatch(
      /<button\s+type="submit"\s+form="chq-portal-edit-form"\s+formaction="\/portal\/submissions\/s1\/participants"\s+formenctype="multipart\/form-data"[^>]*>\s*Add co-presenter\s*<\/button>/,
    );
  });

  // Multi-portal decision 74: the frame's general preview (a portal with
  // nobody signed in) is superseded by preview as a person
  // (src/routes/portal/preview-person.tsx); /portal/preview is not mounted.
  it("frame :1473 'Portal preview · /portal/preview' -- SUPERSEDED by preview as a person (multi-portal decision 74)", () => {
    expect(readFileSync(DESIGN_FILE, "utf-8").split("\n")[1473 - 1]).toContain("Portal preview · /portal/preview");
    expect(existsSync(join(REPO_ROOT, "src", "routes", "portal", "preview.tsx"))).toBe(false);
  });

  it("frame :1167 'Public sessions · nothing published' (GET /e/devflow/sessions) -- MATCHES: filter chrome hidden, 'The programme is not out yet' headline, 'Last year' aside naming the prior event + a Sessions › escape", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1167 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Public sessions · nothing published</span>`
    verbatimLine(
      1167,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Public sessions · nothing published</span>`,
    );
    installFakeCaches();
    const app = await buildSessionsApp();
    const res = await app.request("/e/devflow/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // DESIGN-RULINGS.md B7 rule 4/"Fresh and empty hides the filter chrome
    // entirely" -- sessions.tsx's isFresh branch (no facet in flight AND
    // grandTotal === 0) never renders .chq-pub-filter-row at all, matching
    // the frame's own no-search-box/no-select-chrome anatomy at :1167-1210.
    expect(html).not.toContain('class="chq-pub-filter-row"');
    expect(html).not.toContain('class="chq-pub-active-filters"');

    // :1180-1181 headline + reason, PublicEmptyState's 'fresh' variant.
    expectInOrder(html, [
      '<h1 class="chq-pub-surface-title">Sessions</h1>',
      'chq-pub-empty-block-fresh',
      '<p class="chq-pub-empty-what">The programme is not out yet</p>',
      '<p class="chq-pub-empty-reason">',
      'class="chq-pub-lastyear-rail"',
      '<span>Last year</span>',
      '<span class="chq-pub-lastyear-name">DevFlow Conf 2026</span>',
      '<span class="chq-pub-lastyear-count">48 sessions</span>',
      'Sessions ›',
    ]);
    // :1183-1198 the "Last year" aside is fed by getPriorPublicEvent
    // (DEC-745 wave-107 amendment) -- desktop-frames-portal.test.ts's
    // header comment says this feature does not exist anywhere in the
    // tree ("grep -rn 'Last year' src/ ... returns nothing"); that comment
    // has rotted (DEC-976 wave-25's "grep the tree, not the ledger's own
    // claim" lesson): dispatch.tsx:116 calls getPriorPublicEvent and wires
    // its result to SessionsContent's lastYear prop, which renders the
    // aside this test just observed.
    expect(html).toContain('<a class="chq-pub-lastyear-link" href="/e/devflow-2026/sessions">');

    // B7 rule 3: "no button at all" for a fresh-empty state the visitor
    // cannot act on -- PublicEmptyState's 'fresh' variant renders no
    // primary button and no escape link (there is nothing to clear); the
    // one navigational affordance is the aside's own "Sessions ›" link,
    // not a .chq-btn-primary. (The class name still appears once, inert,
    // inside the inlined <style> block's own CSS rule -- checked for an
    // actual class="..." attribute use, never a bare substring, so a CSS
    // selector definition can't be mistaken for a rendered element.)
    expect(html).not.toContain('class="chq-pub-accent-link chq-pub-empty-escape"');
    expect(html).not.toContain('class="chq-btn chq-btn-primary"');
  });

  it('frame :1101 \'CFP closed\' (GET /submit/:eventSlug, closed window state) -- MATCHES: "The call for papers has closed" heading, submissions-closed body naming the event, one "Browse the sessions ›" link', async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1101 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP closed</span>`
    verbatimLine(
      1101,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP closed</span>`,
    );

    // closeDate well in the past -> formWindowState resolves "closed"
    // before any field/track select runs.
    const CLOSED_FORM = { ...SUBMIT_FORM_ROW, closeDate: new Date(Date.UTC(2020, 0, 1)) };
    const db = submitFakeDb([[SUBMIT_EVENT_ROW], [CLOSED_FORM]]);
    const app = submitAppWithDb(db);
    const res = await app.request(
      "/submit/test-conf",
      { headers: {} },
      { ...SUBMIT_BINDINGS, KV: submitFakeKv() } as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('class="chq-pub-surface-title"');
    expect(html).toContain("The call for papers has closed");
    expect(html).toContain('class="chq-cfp-closed-body"');
    expect(html).toContain("Submissions closed on");
    expect(html).toContain("Thanks for your interest in DevFlow Conf 2027.");
    const links = [...html.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0]![1]).toBe("/e/test-conf/sessions");
    expect(html).toMatch(/Browse the sessions\s*(?:&rsaquo;|›)/);
  });

  it('frame :1211 \'Submit a talk · rejected on submit\' (POST /submit/:eventSlug, invalid submission) -- MATCHES (dock note DISCHARGED, DEC-902 wave-18 clause (a), docs/design/audit/cfp-desktop-v12.md disposition (a)): the top-of-form summary, every typed answer, and the rejected-state dock note all match the frame', async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1211 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Submit a talk · rejected on submit</span>`
    verbatimLine(
      1211,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Submit a talk · rejected on submit</span>`,
    );

    const db = submitFakeDb([[SUBMIT_EVENT_ROW], [SUBMIT_FORM_ROW], SUBMIT_FIELD_ROWS, [SUBMIT_TRACK_ROW]]);
    const app = submitAppWithDb(db);

    const OVER_LENGTH_DESC = "x".repeat(MAX_TEXT_LENGTH + 50);
    const form = new FormData();
    form.set(CSRF_COOKIE_NAME, SUBMIT_CSRF_TOKEN);
    form.set("field__title", "");
    form.set("field__description", OVER_LENGTH_DESC);
    form.set("speaker_name", "Dana Whitmore");
    form.set("field__email", "dana@example.com");
    form.set("field__field_session_format", "Talk (30 min)");
    // trackIds omitted -> "Pick one" track-missing error, making 3 problems.

    const req = new Request("http://local/submit/test-conf", {
      method: "POST",
      headers: { cookie: `${CSRF_COOKIE_NAME}=${SUBMIT_CSRF_TOKEN}` },
      body: form,
    });
    const res = await app.request(req, undefined, {
      ...SUBMIT_BINDINGS,
      KV: submitFakeKv(),
      FILES: submitFakeFilesBucket(),
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(400);
    const html = await res.text();

    // :1225/:1220 MATCHES verbatim -- exactly 3 problems produce exactly
    // this spelled-count heading and reassurance line.
    expect(html).toContain('class="chq-error-summary"');
    expect(html).toContain("Three things need fixing before this can be sent");
    expect(html).toContain("Nothing was lost. Everything you typed is still below.");
    const anchors = [...html.matchAll(/<a class="chq-error-summary-link" href="#([^"]+)"/g)].map((m) => m[1]);
    expect(anchors).toHaveLength(3);
    for (const id of anchors) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain(OVER_LENGTH_DESC);
    expect(html).toContain("Dana Whitmore");
    expect(html).toContain("dana@example.com");
    // :1289-1290 dock persists.
    expect(html).toContain("Submit this talk");
    expect(html).toContain('class="chq-btn chq-btn-secondary chq-cfp-save-draft"');
    expect(html).toContain("Save draft");
    // MATCHES (DEC-902 wave-18 clause (a), DISCHARGED): the frame's own
    // rejected-state dock note reads `Saving a draft skips these checks`
    // (frame :1291); src/routes/public/submit-views.tsx's
    // `.chq-cfp-actions-note` now branches on errors/trackError and renders
    // that literal on this branch instead of the fresh-form sentence --
    // already discharged in docs/design/audit/cfp-desktop-v12.md's :1211
    // section, disposition (a), and pinned built by
    // test/cfp-desktop-frame-verdicts.test.ts's own :1211 case.
    expect(html).toContain('class="chq-cfp-actions-note"');
    expect(html).toContain("Saving a draft skips these checks");
    expect(html).not.toContain("We email a confirmation with a link to your portal");
  });

  it('frame :1532 \'CFP not open yet · /submit/:slug\' (GET /submit/:eventSlug, not-yet-open window state) -- MATCHES (DESIGN-RULINGS "CFP -- the third window state"): heading leads with the open date, "You will not need an account.", one way-forward link', async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1532 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP not open yet · /submit/:slug</span>`
    verbatimLine(
      1532,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">CFP not open yet · /submit/:slug</span>`,
    );

    // openDate well in the future -> formWindowState resolves
    // "not_yet_open" before any field/track query runs; the select queue
    // after event/form is exactly one more call, getPriorPublicEvent's own
    // lookup, returning no row so the way-forward link falls back to
    // "Browse the sessions ›" (DEC-745 wave-33 amendment: the fallback
    // half of the ruled contract, the half a zero-row fixture produces).
    const NOT_YET_OPEN_FORM = { ...SUBMIT_FORM_ROW, openDate: new Date(Date.UTC(2099, 0, 1)) };
    const db = submitFakeDb([[SUBMIT_EVENT_ROW], [NOT_YET_OPEN_FORM], []]);
    const app = submitAppWithDb(db);
    const res = await app.request(
      "/submit/test-conf",
      { headers: {} },
      { ...SUBMIT_BINDINGS, KV: submitFakeKv() } as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('class="chq-pub-surface-title"');
    expect(html).toContain("The call for papers opens on");
    expect(html).toContain("You will not need an account.");
    const links = [...html.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0]![1]).toBe("/e/test-conf/sessions");
    expect(html).toMatch(/Browse the sessions\s*(?:&rsaquo;|›)/);
  });
});
