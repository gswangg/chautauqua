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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import { getPortalSettingsForEvent } from "../src/server/repo/portal-config";
import { DEC_029, DEC_902, DEC_919 } from "../src/decisions";

// DEC-029 (wave-108 amendment, src/decisions-data/DEC-029.md): the edit
// screen's co-presenter controls are a SECOND SUBMIT of the ONE edit form
// (`form`/`formaction`/`formenctype`), never a second form -- the :1373
// verdict below asserts exactly that wiring. DEC-919 (wave 47 amendment):
// PublicEmptyState's fresh/filtered split -- the :1167 verdict below grades
// which branch the route takes. Void-referenced so the dependency is
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

const organizerAuth: AuthInfo = { userId: "u-org", role: "organizer", orgId: "org-1" };

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

async function buildPreviewApp(): Promise<Hono<AppEnv>> {
  const { portalPreviewRoutes } = await import("../src/routes/portal/preview");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalPreviewRoutes);
  return app;
}

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

  it("frame :1473 'Portal preview · /portal/preview' (GET /portal/preview) -- MATCHES: 'Preview · read-only' banner, Welcome hero + welcome message, Resources section, 'Not shown here' chips, back-to-settings link", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1473 `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal preview · /portal/preview</span>`
    verbatimLine(
      1473,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal preview · /portal/preview</span>`,
    );
    const app = await buildPreviewApp();
    const res = await app.request("/portal/preview?eventId=evt-1");
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1481-1483 organiser identity slot; :1487-1490 the read-only banner;
    // :1495-1496 Welcome + welcome-message lede; :1499-1509 Resources
    // section; :1511-1519 "Not shown here" chips; :1523 the back link --
    // the frame's own top-to-bottom order.
    expectInOrder(html, [
      'Preview · no speaker',
      'class="chq-portal-preview-banner" role="note"',
      'Preview · read-only.',
      '<h1 class="chq-portal-hero">Welcome</h1>',
      '<p class="chq-portal-lede">Thanks for speaking at DevFlow.</p>',
      // DEC-902 wave-19 clause (b): the frame's fixed second Welcome
      // sentence, a separate node appended after the organiser's own
      // stored lede -- src/routes/portal/preview.tsx:139.
      '<p class="chq-portal-lede">Everything we need from you is on this page, in order.</p>',
      'aria-label="Resources" class="chq-section"',
      'class="chq-section-label">Resources</div>',
      '<span class="chq-portal-row-title">Speaker guide</span>',
      'aria-label="Not shown here" class="chq-section"',
      'chq-portal-not-shown-chip">Their submissions</li>',
      'chq-portal-not-shown-chip">Their tasks</li>',
      'chq-portal-not-shown-chip">Their uploaded files</li>',
      'class="chq-portal-standalone-link" href="/admin/settings?section=portal"',
      '‹ Back to settings',
    ]);
    // No mutating control anywhere on the page -- the one Download control
    // is the frame's sanctioned disabled exception (DEC-747), and the only
    // <form> is PortalLayout's own shared footer sign-out (never content of
    // this task's frame).
    expect(html).toContain('<button type="button" class="chq-portal-preview-download" disabled="" aria-disabled="true"');
    expect((html.match(/<form/g) ?? []).length).toBe(1);
  });

  it("frame :1473 Welcome lede, DEC-902 wave-19 clause (b): the fixed second sentence renders as its own node even when the organiser has no stored welcome message", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1495 `<span style="font-size:15px; line-height:1.65; color:#3F4237">Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.</span>`
    vi.mocked(getPortalSettingsForEvent).mockResolvedValueOnce({
      id: "ps-1",
      eventId: "evt-1",
      welcomeMessage: null,
      accentColor: null,
      logoUrl: null,
      showResources: true,
      createdAt: 0,
      updatedAt: 0,
    });
    const app = await buildPreviewApp();
    const res = await app.request("/portal/preview?eventId=evt-1");
    expect(res.status).toBe(200);
    const html = await res.text();

    // No organiser lede paragraph at all (welcomeMessage is null, so that
    // conditional node does not render), but the frame's fixed second
    // sentence -- app-owned chrome per DEC-902 wave-19 clause (b) -- still
    // does: it needs no stored data to be true.
    expect(html).not.toContain('<p class="chq-portal-lede">Thanks for speaking at DevFlow.</p>');
    expect(html).toContain('<p class="chq-portal-lede">Everything we need from you is on this page, in order.</p>');
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
});
