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
      '<h1 class="chq-portal-hero">Your tasks</h1>',
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

  it("frame :531 'Portal · Your profile' (GET /portal/profile) -- DIVERGES: the H1 reads 'My Profile' where the frame draws 'Your profile', and the docked footer has no secondary", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:531 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(531, FRAME_LINE);
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();

    // Frame :528-556 draws: back link '‹ Your portal', h1 'Your profile',
    // a headshot section, profile fields, then a docked footer with a
    // PRIMARY 'Save' + a bordered SECONDARY 'Cancel'. The route matches
    // back link + headshot section + field anatomy, but the H1 text
    // itself reads 'My Profile' (ProfilePage, src/routes/portal/profile.tsx)
    // -- a different string from the frame's 'Your profile' -- and the
    // docked footer (profileDock) renders only 'Save profile', with no
    // Cancel control (DEC-576's "never manufactured just to fill the band"
    // rule, recorded in that file's own comment as a DEVIATIONS.md entry).
    expectInOrder(html, [
      '<a href="/portal" class="chq-portal-back">‹ Your portal</a>',
      '<h1 class="chq-portal-hero">My Profile</h1>',
      '<section aria-label="Headshot" class="chq-section chq-portal-profile-head">',
      '<section aria-label="Profile details" class="chq-section">',
      '<footer class="chq-portal-footer">',
      '<div class="chq-portal-dock">',
      '<button type="submit" form="chq-portal-profile-form" class="chq-btn chq-btn-primary">Save profile</button>',
    ]);
    expect(html).not.toContain(">Your profile<");
    const dockOpen = html.indexOf('<div class="chq-portal-dock">');
    const dockClose = html.indexOf("</div>", dockOpen);
    const dockBody = html.slice(dockOpen, dockClose);
    expect((dockBody.match(/<button/g) ?? []).length).toBe(1);
    expect(html).not.toContain(">Cancel<");
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
      '<h1 class="chq-portal-hero chq-portal-resources-hero">Resources</h1>',
      '<p class="chq-portal-sub">The same for every speaker · nothing here is about your session</p>',
      '<footer class="chq-portal-footer">',
      '<span class="chq-portal-resources-footer-note">Questions? Reply to any of our emails.</span>',
    ]);
    // No docked control on this page (unlike tasks/profile above).
    expect(html).not.toContain('class="chq-portal-dock"');
  });
});
