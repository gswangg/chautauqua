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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";
import { getContactProfile } from "../src/server/repo/profile";
import { PORTAL_CSS as RAW_PORTAL_CSS } from "../src/routes/portal/portal.css";
import { stripCssComments } from "./helpers/strip-css-comments";
import { splitMediaBlocks, phoneMediaBlocks } from "./helpers/css-media-blocks";

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
  const __m: any = {
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
  const { homeFromLegacy } = await import("./helpers/person-view-fixture");
  __m.getPortalHome = vi.fn(async () =>
    homeFromLegacy({
      sessions: await __m.getMySessions(),
      tasks: await __m.getMyTaskAssignments(),
      invitations: await __m.getMyInvitations(),
    }),
  );
  return __m;
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
    getAllSubmissionParticipants: vi.fn(async () => []),
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
// makeChain-style fake-db stack) is how the harness reached the general
// /portal/preview (removed by multi-portal decision 74; the resources page
// below still reads these) -- its GET /preview handler read
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
  it("frame :414 'Speaker portal' (GET /portal) -- SUPERSEDED by the Portals frame's one-home-per-person (docs/design/multi-portal, flow 6): profile first, then one section per participation, then 'Your submissions' and the footer band", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:414 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(414, FRAME_LINE);
    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Frame :410-462's three-section anatomy ("Waiting on you" / "Your
    // session" / "Done") is replaced by the multi-portal home (Portals
    // frame flow 6, docs/design/multi-portal/DECISIONS.md): the person's own
    // items under "Your profile" (done ones folded in place, not a separate
    // Done section), then a section per participation. "Your submissions"
    // (DEC-729) and the footer band's Resources link (DEC-988) stay.
    expectInOrder(html, [
      '<section class="chq-home-section" aria-label="Your profile">',
      '<div class="chq-home-label">Your profile</div>',
      '<section aria-label="Your submissions" class="chq-section">',
      '<div class="chq-portal-footer-band">',
      '<span class="chq-portal-footer-who">Priya Raman</span>',
      '<a href="/portal/resources" class="chq-portal-footer-resources">Resources</a>',
      '<a href="/portal/profile" class="chq-portal-footer-profile">Profile</a>',
    ]);
    expect(html).toContain('aria-label="Your submissions"');
    expect(html).not.toContain('aria-label="Waiting on you"');
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
      '<button type="submit" form="chq-portal-profile-form" class="chq-portal-profile-dock chq-btn chq-btn-primary">Save profile</button>',
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

// Multi-portal decision 74: the frame's general preview (:1473, a portal
// with nobody signed in) is superseded by preview as a person
// (src/routes/portal/preview-person.tsx, the Portals frame's flow 4) --
// /portal/preview is no longer mounted, so there is no page to grade.
describe("Portal SSR desktop frame verdict (Chautauqua Public and Portal.dc.html:1473, w9-re)", () => {
  it("frame :1473 'Portal preview · /portal/preview' -- SUPERSEDED by preview as a person (multi-portal decision 74)", () => {
    const frame = readFileSync(join(process.cwd(), "docs/design/Chautauqua Public and Portal.dc.html"), "utf8").split("\n");
    expect(frame[1473 - 1]).toContain("Portal preview · /portal/preview");
    expect(existsSync(join(process.cwd(), "src/routes/portal/preview.tsx"))).toBe(false);
    expect(readFileSync(join(process.cwd(), "src/index.ts"), "utf8")).not.toContain("routes/portal/preview\"");
    expect(readFileSync(join(process.cwd(), "docs/design/multi-portal/DECISIONS.md"), "utf8")).toMatch(/\| 74 \|/);
  });
});

// w38-f (DEC-576): profile.tsx renders a Save primary TWICE -- once inline
// inside .chq-portal-actions-footer, once through PortalLayout's dock slot
// (profileDock, now carrying its own .chq-portal-profile-dock token).
// portal.css.ts must stand exactly one of the two down at any width. Keyed
// on the CSS RULES (not the prose comment beside them, which can rot
// independently of the rule it describes) using the same
// splitMediaBlocks/resolvePhoneDeclaration helpers the sheet's other CSS
// pins already share (DEC-613), plus the real SSR response to prove both
// buttons still exist in the markup for the CSS toggle to act on.
describe("portal profile dock -- exactly one visible Save control at any width (DEC-576 w38-f)", () => {
  const PORTAL_CSS = stripCssComments(RAW_PORTAL_CSS);

  /** Top-level (outside every @media block) declared value of `property` on
   * the rule naming `selector` -- mirrors portal-desktop-measure.test.ts's
   * own `topLevelRuleBody`, built on top of the shared splitMediaBlocks
   * helper rather than re-deriving brace matching a third time. */
  function topLevelDeclaration(css: string, selector: string, property: string): string | undefined {
    const { outside } = splitMediaBlocks(css);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = outside.match(new RegExp(`${escaped}(?![\\w-])\\s*\\{([^}]*)\\}`));
    if (!match) return undefined;
    const declMatch = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`).exec(match[1] ?? "");
    return declMatch?.[1]?.trim();
  }

  it("desktop (top level): the dock copy is hidden, the in-flow footer copy is not", () => {
    expect(topLevelDeclaration(PORTAL_CSS, ".chq-portal-profile-dock", "display")).toBe("none");
    expect(topLevelDeclaration(PORTAL_CSS, ".chq-portal-actions-footer", "display")).not.toBe("none");
  });

  // portal.css.ts's tail composes THREE separate `@media (max-width: 700px)`
  // blocks (EMPTY_PHONE_CSS's own, this sheet's own, ERROR_STATES_PHONE_CSS's
  // own -- see the DEC-385 wave-143 comment above the sheet's own opener), so
  // `resolvePhoneDeclaration`'s "the sheet's SINGLE terminal phone block"
  // premise does not hold here; phoneMediaBlocks() (which returns every
  // block, not just the first) is the correct helper for this sheet.
  function phoneDeclaration(css: string, selector: string, property: string): string | undefined {
    const blocks = phoneMediaBlocks(css).join("\n");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = blocks.match(new RegExp(`${escaped}(?![\\w-])\\s*\\{([^}]*)\\}`));
    if (!match) return undefined;
    const declMatch = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`).exec(match[1] ?? "");
    return declMatch?.[1]?.trim();
  }

  it("390 (the sheet's own phone block): the dock copy is revealed, the in-flow footer copy is hidden", () => {
    expect(phoneDeclaration(PORTAL_CSS, ".chq-portal-profile-dock", "display")).toBe("flex");
    expect(phoneDeclaration(PORTAL_CSS, ".chq-portal-actions-footer", "display")).toBe("none");
  });

  it("GET /portal/profile still renders both Save buttons in markup, distinguished only by the class the CSS above toggles", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect((html.match(/<button[^>]*class="chq-portal-profile-dock chq-btn chq-btn-primary"[^>]*>Save profile<\/button>/g) ?? []).length).toBe(1);
    const footerOpen = html.indexOf('<div class="chq-portal-actions-footer">');
    const footerClose = html.indexOf("</div>", html.indexOf("</div>", footerOpen) + 1);
    const footerBody = html.slice(footerOpen, footerClose);
    expect((footerBody.match(/<button type="submit" class="chq-btn chq-btn-primary">Save profile<\/button>/g) ?? []).length).toBe(1);
    expect(footerBody).not.toContain("chq-portal-profile-dock");
  });
});
