// PORTAL SSR, PART 1 of 2 (w14-sd, DEC-976 wave-158 amendment): per-frame
// 390 render verdicts for four of the fourteen Public-and-Portal SSR phone
// frames -- /portal, /portal/tasks, /portal/profile, /portal/resources.
//
// MEASUREMENT ONLY: this file fixes nothing, and touches no route module
// and no *.css.ts. Every `it()` below is entered by dispatching a REAL
// request through a Hono app with the actual /portal/* route sub-apps
// mounted (never a hand-built-props view call), asserts the returned HTML
// STRING's structure/order only (an SSR response carries no computed
// layout), and states MATCHES or DIVERGES in its own title, naming the
// divergence. A DIVERGES verdict is a finding, not a failure -- the test
// stays green while honestly recording the gap; the prose verdict lives in
// docs/design/audit/portal-v12.md.
//
// Harness copied verbatim from test/portal-page-headings.test.ts's four
// vi.mock blocks + buildApp() (DEC-613: a second copy of a vocabulary is a
// trap) -- all four routes graded here are already in that file's own
// route list, so its fixtures reach them unchanged.
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";
import { getContactProfile } from "../src/server/repo/profile";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line, assert it byte-for-byte
 * matches the literal this file claims -- a citation that can never
 * silently rot to a wrong line the way a bare `:line` reference can.
 * Copied from app/src/pages/Settings.frame-verdicts.render.test.tsx's own
 * `verbatimLine` (itself copied from settings-phone-390.frames.test.ts). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

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
    getMyTaskAssignments: vi.fn(async () => [
      {
        id: "assign-1",
        taskId: "task-1",
        eventId: "evt-1",
        kind: "general",
        title: "Confirm bio",
        description: null,
        dueDate: null,
        assignedAt: 0,
        required: false,
        status: "pending",
        formId: null,
        deliverableKind: null,
        fileId: null,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
      {
        id: "assign-form-1",
        taskId: "task-2",
        eventId: "evt-1",
        kind: "form",
        title: "Speaker questionnaire",
        description: null,
        dueDate: null,
        assignedAt: 0,
        required: false,
        status: "pending",
        formId: "f1",
        deliverableKind: null,
        fileId: null,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
    ]),
    getAssignmentScope: vi.fn(async () => ({
      id: "assign-form-1",
      taskId: "task-2",
      eventId: "evt-1",
      kind: "form",
      formId: "f1",
      deliverableKind: null,
      contactId: "ct-1",
      orgId: "org-1",
      status: "pending",
      fileId: null,
    })),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async (_db: unknown, id: string) =>
      id === "sub-mine"
        ? {
            id: "sub-mine",
            eventId: "evt-1",
            ref: "SES-004",
            title: "Mine",
            description: "desc",
            status: "pending",
            statusLabel: "Under review",
            submittedAt: 4,
            timezone: "UTC",
            answers: [],
            trackName: null,
            format: null,
            day: null,
            startMin: null,
            endMin: null,
            roomName: null,
          }
        : null,
    ),
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
      submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
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
    getPortalParticipants: vi.fn(async () => []),
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

// DEC-613 wave-9 amendment: extending this SAME mock set (never a second
// makeChain-style fake-db stack) is how the harness reaches
// /portal/preview -- portalPreviewRoutes' GET /preview handler reads
// getEventForOrg (repo/events) and getPortalSettingsForEvent/
// listResourcesForEvent (repo/portal-config) directly against c.var.db, none
// of which the four mocks above touch. `c.set("db", {} as never)` stays
// valid below precisely because these two additions cover the only db
// reads the preview route makes.
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async () => ({
      id: "evt-1",
      orgId: "org-1",
      name: "Arbitrary Con",
      slug: "arbitrary-con",
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
      welcomeMessage: "Thanks for speaking at Arbitrary Con.",
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

const organizerAuth: AuthInfo = { userId: "u-org", role: "organizer", orgId: "org-1" };

async function buildApp(): Promise<Hono<AppEnv>> {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const { portalProfileRoutes } = await import("../src/routes/portal/profile");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  app.route("/portal", portalTasksRoutes);
  app.route("/portal", portalEditRoutes);
  app.route("/portal", portalProfileRoutes);
  return app;
}

/** Frame :1473 is organizer-only (portalPreviewRoutes' own guard) --
 * a distinct app-builder carrying organizerAuth rather than buildApp()'s
 * speakerAuth, same shape as buildApp() above (DEC-613: vary path/auth
 * fixtures, never the mock-target vocabulary). */
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

/** Order-preserving check: every needle in `needles` appears in `html`, each
 * strictly after the one before it -- proves both PRESENCE and ORDER
 * without a brittle full-string snapshot. */
function expectInOrder(html: string, needles: string[]): void {
  let cursor = 0;
  for (const needle of needles) {
    const idx = html.indexOf(needle, cursor);
    expect(idx, `expected to find ${JSON.stringify(needle)} at or after index ${cursor}`).toBeGreaterThanOrEqual(0);
    cursor = idx + needle.length;
  }
}

const FRAME_LINE =
  '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">';

describe("Portal SSR 390 frame verdicts (Chautauqua Public and Portal.dc.html, w14-sd)", () => {
  it("frame :414 'Speaker portal' (GET /portal) -- DIVERGES: an extra 'Your submissions' section, and a footer Resources link, that the frame does not draw", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:414 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(414, FRAME_LINE);
    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Frame :410-462 draws exactly THREE sections in the scroll body --
    // "Waiting on you", "Your session", "Done" -- in that order, plus a
    // footer band naming the speaker and a "Profile" link. The route emits
    // a FOURTH section, "Your submissions" (DEC-729), between the first and
    // second, which the frame never draws, and the footer additionally
    // links to /portal/resources (DEC-988 wave-74 amendment) -- the frame's
    // footer band draws only the name/company clause and "Profile".
    expectInOrder(html, [
      '<section aria-label="Waiting on you" class="chq-section">',
      '<div class="chq-section-label">Waiting on you</div>',
      '<section aria-label="Your submissions" class="chq-section">',
      '<section aria-label="Your session" class="chq-section">',
      '<section aria-label="Done" class="chq-section">',
      '<div class="chq-portal-footer-band">',
      '<span class="chq-portal-footer-who">Priya Raman</span>',
      '<a href="/portal/resources" class="chq-portal-footer-resources">Resources</a>',
      '<a href="/portal/profile" class="chq-portal-footer-profile">Profile</a>',
    ]);
    // "Your submissions" is real product content, not a fixture -- the
    // frame's own three-section anatomy (Waiting on you / Your session /
    // Done) never mentions a submissions section at all.
    expect(html).toContain('aria-label="Your submissions"');
  });

  it("frame :476 'Portal · Your tasks' (GET /portal/tasks) -- DIVERGES: the docked footer renders ONE control (the first incomplete task's own action), never the frame's second bordered secondary", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:476 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(476, FRAME_LINE);
    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Frame :473-497 draws: back link '‹ Your portal', h1 'Your tasks',
    // per-task rows (title/state/due/button), then a docked footer with a
    // PRIMARY ("Mark the release signed") + a bordered SECONDARY ("Later").
    // The route matches the back link, h1, and row anatomy, but its dock
    // (tasksPageDockPrimary, DEC-576/DEC-967 amendment) renders exactly one
    // real per-task control and no secondary at all -- the frame's "Later"
    // has no verb behind it (DEVIATIONS.md), so no second dock button ever
    // renders, at any task-list state.
    expectInOrder(html, [
      '<a href="/portal" class="chq-portal-back">‹ Your portal</a>',
      '<h1 class="chq-portal-hero chq-portal-hero-drill">Your tasks</h1>',
      '<div class="chq-portal-row" id="task-assign-1">',
      '<span class="chq-portal-row-title">Confirm bio</span>',
      '<div class="chq-portal-row" id="task-assign-form-1">',
      '<span class="chq-portal-row-title">Speaker questionnaire</span>',
      '<footer class="chq-portal-footer">',
      '<div class="chq-portal-dock">',
      '<button type="submit" class="chq-btn chq-btn-primary">Mark complete</button>',
    ]);
    // Exactly one control inside the dock -- no second (bordered/secondary)
    // button the frame's "Later" would need.
    const dockOpen = html.indexOf('<div class="chq-portal-dock">');
    const dockClose = html.indexOf("</div>", dockOpen);
    const dockBody = html.slice(dockOpen, dockClose);
    expect((dockBody.match(/<button/g) ?? []).length).toBe(1);
    expect(html).not.toContain(">Later<");
  });

  it("frame :531 'Portal · Your profile' (GET /portal/profile) -- DIVERGES: the docked footer has no secondary; the H1 now matches the frame's 'Your profile' at the drill register (DEC-576 wave-16 amendment)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:531 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(531, FRAME_LINE);
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Frame :528-556 draws: back link '‹ Your portal', h1 'Your profile',
    // a headshot section, profile fields, then a docked footer with a
    // PRIMARY 'Save' + a bordered SECONDARY 'Cancel'. The route matches
    // back link + H1 + headshot section + field anatomy: DEC-576's wave-16
    // amendment corrected the H1 to the frame's literal 'Your profile' and
    // gave it `chq-portal-hero-drill` (a back-linked H1 is a drill-in and
    // takes the frame's 25px register at :534), closing the copy half of
    // this verdict. What still diverges is the dock -- profileDock renders
    // only 'Save profile', with no Cancel control (DEC-576's "never
    // manufactured just to fill the band" rule, recorded in that file's own
    // comment as a DEVIATIONS.md entry).
    expectInOrder(html, [
      '<a href="/portal" class="chq-portal-back">‹ Your portal</a>',
      '<h1 class="chq-portal-hero chq-portal-hero-drill">Your profile</h1>',
      '<section aria-label="Headshot" class="chq-section chq-portal-profile-head">',
      '<section aria-label="Profile details" class="chq-section">',
      '<footer class="chq-portal-footer">',
      '<div class="chq-portal-dock">',
      '<button type="submit" form="chq-portal-profile-form" class="chq-btn chq-btn-primary">Save profile</button>',
    ]);
    // The frame's literal now renders, and the old 'My Profile' string is gone.
    expect(html).toContain(">Your profile<");
    expect(html).not.toContain("My Profile");
    const dockOpen = html.indexOf('<div class="chq-portal-dock">');
    const dockClose = html.indexOf("</div>", dockOpen);
    const dockBody = html.slice(dockOpen, dockClose);
    expect((dockBody.match(/<button/g) ?? []).length).toBe(1);
    expect(html).not.toContain(">Cancel<");
  });

  it("frame :541 headshot control (GET /portal/profile) -- RESOLVED (DEC-576 wave-21): no headshot on file renders the bordered pill as 'Add a headshot'", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:541
    // `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Replace</span>`
    verbatimLine(
      541,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Replace</span>',
    );
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();
    // This suite's shared fixture (module-level `profile` in the
    // vi.mock("../src/server/repo/profile") factory above) has
    // headshotUrl: null -- clause (b)'s absent-population literal. Scoped
    // to the <label>...</label> element itself, not the whole document --
    // portal.css.ts's own <style> block quotes the frame's `Replace</span>`
    // literal in a comment, so a whole-document `not.toContain(">Replace<")`
    // would false-fail on that comment text.
    const labelOpen = html.indexOf('<label class="chq-portal-headshot-pick">');
    const labelClose = html.indexOf("</label>", labelOpen);
    const labelHtml = html.slice(labelOpen, labelClose);
    expect(labelHtml).toContain('<label class="chq-portal-headshot-pick">Add a headshot');
    expect(labelHtml).not.toContain(">Replace<");
    expect(html).not.toContain("No headshot uploaded yet.");
  });

  it("frame :541 headshot control (GET /portal/profile) -- RESOLVED (DEC-576 wave-21): a headshot already on file renders the bordered pill as 'Replace'", async () => {
    const withHeadshot: ContactProfile = {
      id: "ct-1",
      firstName: "Priya",
      lastName: "Raman",
      title: null,
      company: null,
      bio: null,
      headshotUrl: "https://files.example.com/headshot/ct-1/x.jpg",
      socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
    };
    vi.mocked(getContactProfile).mockResolvedValueOnce(withHeadshot);
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();
    // clause (b)'s present-population literal, the frame's own word.
    expect(html).toContain('<label class="chq-portal-headshot-pick">Replace');
    expect(html).not.toContain("Add a headshot");
    expect(html).not.toContain("No headshot uploaded yet.");
  });

  it("frame :1561 'Portal · Resources' (GET /portal/resources) -- MATCHES: back link, H1, subtitle, resource list, and undocked footer note render in the frame's own order", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1561 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(1561, FRAME_LINE);
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Frame :1554-1580 draws: back link '‹ Your portal', h1 'Resources',
    // subtitle 'The same for every speaker · nothing here is about your
    // session', per-resource rows, then a footer note ('Questions? Reply to
    // any of our emails.') with NO dock button -- ResourcesPage matches
    // every element and its order exactly, including the absence of a
    // docked control.
    expectInOrder(html, [
      '<a href="/portal" class="chq-portal-back">‹ Your portal</a>',
      '<h1 class="chq-portal-hero chq-portal-hero-drill chq-portal-resources-hero">Resources</h1>',
      '<p class="chq-portal-sub">The same for every speaker · nothing here is about your session</p>',
      '<footer class="chq-portal-footer">',
      '<span class="chq-portal-resources-footer-note">Questions? Reply to any of our emails.</span>',
    ]);
    // No docked control on this page (unlike tasks/profile above).
    expect(html).not.toContain('class="chq-portal-dock"');
  });
});

// DEC-613 wave-9 amendment: docs/design/audit/portal-desktop-v12.md:156's
// UNREACHED verdict for this DESKTOP (1600) frame named the missing
// capability -- the mock-set extension above IS that capability, so this
// describe block reaches it off a REAL GET /portal/preview request (organizer
// auth) through the SAME harness, never a second fake-db stack.
describe("Portal SSR desktop frame verdict (Chautauqua Public and Portal.dc.html:1473, w9-re)", () => {
  it("frame :1473 'Portal preview · /portal/preview' (GET /portal/preview) -- DIVERGES: the 'Not shown here' chip set differs from the frame (disposition (b) BLESSED, DEC-902 wave-14m); the Welcome lede's second sentence, back-link placement, and meta-sentence order all MATCH (DEC-902 wave-19 clause (b); wave-20, task w20-g)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1473
    verbatimLine(
      1473,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Portal preview · /portal/preview</span>`,
    );
    const app = await buildPreviewApp();
    const res = await app.request("/portal/preview?eventId=evt-1");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Structural anatomy MATCHES: read-only banner (now carrying its own
    // back link, DEC-902 wave-20), Welcome hero + lede, Resources section
    // (naming the fixture's one resource), Not-shown-here section, in that
    // top-to-bottom order.
    expectInOrder(html, [
      'class="chq-portal-preview-banner" role="note"',
      'Preview · read-only.',
      'class="chq-portal-standalone-link chq-portal-preview-banner-link" href="/admin/settings?section=portal"',
      '‹ Back to settings',
      '<h1 class="chq-portal-hero">Welcome</h1>',
      '<p class="chq-portal-lede">Thanks for speaking at Arbitrary Con.</p>',
      'aria-label="Resources" class="chq-section"',
      '<span class="chq-portal-row-title">Speaker guide</span>',
      'aria-label="Not shown here" class="chq-section"',
    ]);

    // docs/design/Chautauqua Public and Portal.dc.html:1490
    verbatimLine(
      1490,
      `          <a href="#" style="margin-left:auto; font-size:13px; font-weight:700; white-space:nowrap">‹ Back to settings</a>`,
    );
    // MATCHES (DEC-902 wave-20, task w20-g): the frame draws '‹ Back to
    // settings' INSIDE the read-only banner card (margin-left:auto, same
    // row as the two banner sentences, frame :1476-1490); the route now
    // renders it inside the same `.chq-portal-preview-banner` element via
    // `.chq-portal-preview-banner-link`, and there is no second, standalone
    // copy anywhere else on the page.
    const bannerOpen = html.indexOf('class="chq-portal-preview-banner"');
    const bannerClose = html.indexOf("</div>", bannerOpen);
    expect(html.slice(bannerOpen, bannerClose)).toContain("Back to settings");
    // Checked as an actual rendered <a class="..."> use, never a bare
    // substring -- the class token also appears inertly inside the page's
    // inlined <style> block and a nearby source comment (DEC-976's "a CSS
    // selector definition can't be mistaken for a rendered element" rule).
    const backLinkAnchor =
      '<a class="chq-portal-standalone-link chq-portal-preview-banner-link" href="/admin/settings?section=portal">';
    expect(html).toContain(backLinkAnchor + "‹ Back to settings</a>");
    const backLinkIdx = html.indexOf(backLinkAnchor);
    const notShownIdx = html.indexOf('aria-label="Not shown here"');
    expect(backLinkIdx).toBeLessThan(notShownIdx);
    expect((html.match(/Back to settings/g) ?? []).length).toBe(1);

    // docs/design/Chautauqua Public and Portal.dc.html:1495
    verbatimLine(
      1495,
      `          <span style="font-size:15px; line-height:1.65; color:#3F4237">Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.</span>`,
    );
    // MATCHES (DEC-902 wave-19 clause (b)): the frame's fixed second
    // sentence `Everything we need from you is on this page, in order.` is
    // APP-OWNED CHROME, appended after the organiser's stored welcome
    // message as its own node -- src/routes/portal/preview.tsx now renders
    // it unconditionally, even when the stored `welcomeMessage` is null.
    expect(html).toContain("Everything we need from you is on this page, in order.");

    // docs/design/Chautauqua Public and Portal.dc.html:1523
    verbatimLine(
      1523,
      `          <span style="display:block; padding:14px 0 0; font-size:13px; color:#565A4B; line-height:1.55">To see a real speaker's portal you would have to be them — this preview deliberately cannot.</span>`,
    );
    // MATCHES (DEC-902 wave-20, task w20-g): the frame places this sentence
    // at the very END of the page, trailing the "Not shown here" chips.
    // The route now renders the same sentence (verbatim) as the last child
    // of that same section, after its chips -- no longer immediately after
    // the banner.
    expect(html).toContain("To see a real speaker&#39;s portal you would have to be them — this preview deliberately cannot.");
    const metaIdx = html.indexOf("To see a real speaker&#39;s portal you would have to be them");
    const chipsIdx = html.indexOf('chq-portal-not-shown-chip">Their uploaded files</li>');
    expect(metaIdx).toBeGreaterThan(chipsIdx);

    // docs/design/Chautauqua Public and Portal.dc.html:1518-1521
    verbatimLine(
      1518,
      `            <span style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 13px; font-size:13px; color:#565A4B">Their tasks</span>`,
    );
    verbatimLine(
      1519,
      `            <span style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 13px; font-size:13px; color:#565A4B">Their session</span>`,
    );
    verbatimLine(
      1520,
      `            <span style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 13px; font-size:13px; color:#565A4B">Their files</span>`,
    );
    verbatimLine(
      1521,
      `            <span style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 13px; font-size:13px; color:#565A4B">Their notes</span>`,
    );
    // DIVERGES: the frame's "Not shown here" chip row reads FOUR chips --
    // Their tasks / Their session / Their files / Their notes. The route's
    // own header comment (preview.tsx:60-63) says this list is drawn from
    // what the route declines to load (submissions/tasks/files) and ships
    // THREE chips with different labels -- Their submissions / Their tasks /
    // Their uploaded files. Neither "Their session" nor "Their notes" render
    // at all; "Their files" ships as "Their uploaded files" instead.
    expect(html).toContain('chq-portal-not-shown-chip">Their submissions</li>');
    expect(html).toContain('chq-portal-not-shown-chip">Their tasks</li>');
    expect(html).toContain('chq-portal-not-shown-chip">Their uploaded files</li>');
    expect(html).not.toContain(">Their session<");
    expect(html).not.toContain(">Their notes<");
    expect(html).not.toContain('chq-portal-not-shown-chip">Their files</li>');
    expect((html.match(/<li class="chq-portal-not-shown-chip">/g) ?? []).length).toBe(3);
  });
});
