// PORTAL SSR 390 FRAME VERDICTS -- 'Your tasks' and 'Resources' (w31-g,
// DEC-976/DEC-576/DEC-385/DEC-967).
//
// Deepens test/portal-390-frame-verdicts.test.ts's two shallow verdicts for
// these same two frames (`docs/design/Chautauqua Public and
// Portal.dc.html`:476-496 'Portal · Your tasks' and :1561-1583 'Portal ·
// Resources') into a literal-by-literal accounting of every DRAWN (i.e.
// non-`{{ }}`-template) string each frame renders, in drawn order. Template
// placeholders (`{{ t.title }}`, `{{ t.state }}`, `{{ t.due }}`,
// `{{ t.btn }}`, `{{ r.name }}`, `{{ r.detail }}`) are graded by SHAPE only
// (a class/structure assertion), never pinned to a literal string, per
// DEC-967 wave-31's sample-data ruling.
//
// UNIT (DEC-976 wave-31), SSR variant: drives the real Hono app and asserts
// the returned HTML string. Harness (mocks + buildApp + speakerAuth) copied
// verbatim from test/portal-390-frame-verdicts.test.ts (itself copied from
// test/portal-page-headings.test.ts) -- DEC-613: a second copy of a
// vocabulary is a trap, so the seeding and route wiring below are identical,
// not reinvented.
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

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims, so a citation can never silently
 * rot to a wrong line. Copied verbatim from
 * test/portal-390-frame-verdicts.test.ts's own `verbatimLine`. */
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
    getPortalHome: vi.fn(async () => ({ views: [], placements: new Map() })),
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
    getMyResources: vi.fn(async () => [
      {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        resources: [
          {
            id: "res-wiki-1",
            eventId: "evt-1",
            kind: "wiki" as const,
            title: "Speaker FAQ",
            content: "Answers to common questions.",
          },
          {
            id: "res-file-1",
            eventId: "evt-1",
            kind: "file" as const,
            title: "AV requirements",
            content: null,
          },
        ],
      },
    ]),
    getResourceDownloadScope: vi.fn(async () => null),
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
 * strictly after the one before it. Copied verbatim from
 * test/portal-390-frame-verdicts.test.ts. */
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

describe("Portal SSR 390 frame verdicts -- 'Your tasks' & 'Resources' (w31-g)", () => {
  it("frame :476-496 'Portal · Your tasks' (GET /portal/tasks) -- 5 of 8 drawn literals asserted", async () => {
    verbatimLine(476, FRAME_LINE);
    // :478 the back link's literal.
    verbatimLine(
      478,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>',
    );
    // :479 the h1's literal.
    verbatimLine(
      479,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your tasks</h1>',
    );
    // :493-494 the docked footer's PRIMARY ("Mark the release signed") +
    // bordered SECONDARY ("Later").
    verbatimLine(
      493,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Mark the release signed</span>',
    );
    verbatimLine(
      494,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Later</span>',
    );

    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // 1/8 & 2/8 (ASSERTED, exact literal): the 44px back link and the h1.
    expectInOrder(html, [
      '<a href="/portal" class="chq-portal-back">‹ Your portal</a>',
      '<h1 class="chq-portal-hero chq-portal-hero-drill">Your tasks</h1>',
    ]);

    // 3/8, 4/8, 5/8 (ASSERTED BY SHAPE per DEC-967 -- never pinned to a
    // literal string): each task row draws a title, a state chip, and an
    // action-button stack, in that order, matching the frame's
    // title/state/btn anatomy at :485/:486/:489. (`{{ t.due }}` at :488 is
    // the frame's 4th per-row placeholder; both seeded assignments carry
    // `dueDate: null`, so DEC_826's effective-due computation legitimately
    // renders no due line for either row here -- absence-by-fixture-state,
    // not a divergence -- which is why only 3 of the 4 per-row placeholders
    // are exercised by this fixture.)
    expectInOrder(html, [
      '<div class="chq-portal-row" id="task-assign-1">',
      '<span class="chq-portal-row-title">',
      "Confirm bio",
      '<span class="chq-flag">To do</span>',
      '<div class="chq-portal-actions">',
      '<button type="submit" class="chq-btn chq-btn-primary">Mark complete</button>',
      '<div class="chq-portal-row" id="task-assign-form-1">',
      '<span class="chq-portal-row-title">',
      "Speaker questionnaire",
    ]);
    expect(html).not.toMatch(/class="chq-portal-due"/);

    // 6/8, 7/8, 8/8 (the dock band, :492-495): geometry MATCHES (border-top
    // band, one real control) but the frame's own two literals do not --
    // DEVIATIONS §6 (DEC-967 wave-106, honoured per this task's tie-break)
    // rules the portal task model complete-or-not only, so "Mark the
    // release signed" is frame SAMPLE DATA standing in for whatever the
    // real next-incomplete-task's own control says (here "Mark complete",
    // reused verbatim from the row rather than duplicated -- DIVERGES on
    // literal text, MATCHES on control identity/geometry), and "Later" is a
    // real, permanent, blessed omission: no snooze/defer/dismiss verb
    // exists anywhere in src/routes/portal/** or src/server/repo/portal*,
    // so a second dock control is never manufactured to fill the band.
    const footerOpen = html.indexOf('<footer class="chq-portal-footer">');
    expect(footerOpen).toBeGreaterThanOrEqual(0);
    const dockOpen = html.indexOf('<div class="chq-portal-dock">', footerOpen);
    expect(dockOpen).toBeGreaterThanOrEqual(0);
    const dockClose = html.indexOf("</div>", dockOpen);
    const dockBody = html.slice(dockOpen, dockClose);
    expect((dockBody.match(/<button|<a /g) ?? []).length).toBe(1);
    expect(dockBody).toContain('class="chq-btn chq-btn-primary"');
    expect(dockBody).not.toContain("Mark the release signed");
    expect(html).not.toContain(">Later<");
  });

  it("frame :1561-1583 'Portal · Resources' (GET /portal/resources) -- 5 of 7 drawn literals asserted", async () => {
    verbatimLine(1561, FRAME_LINE);
    // :1563 the back link's literal.
    verbatimLine(
      1563,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>',
    );
    // :1564 the h1's literal.
    verbatimLine(
      1564,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Resources</h1>',
    );
    // :1565 the subtitle -- DEC-029 rules it real product copy (keeps a
    // speaker from reading a shared resource as personal), not sample data.
    verbatimLine(
      1565,
      '        <span style="font-size:13px; color:#565A4B; line-height:1.5">The same for every speaker · nothing here is about your session</span>',
    );
    // :1575 each row's control literal -- "Open", never "Download" (DEC-029:
    // this same route serves both inline wiki resources and streamed file
    // resources, so "Download" lies on half the population).
    verbatimLine(
      1575,
      '            <span style="border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; color:#2E2A24; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600; flex-shrink:0">Open</span>',
    );
    // :1581 the undocked footer's one line.
    verbatimLine(
      1581,
      '        <span style="font-size:12px; color:#565A4B; line-height:1.5">Questions? Reply to any of our emails.</span>',
    );

    const app = await buildApp();
    const res = await app.request("/portal/resources");
    expect(res.status).toBe(200);
    const html = await res.text();

    // 1/7 through 3/7 (ASSERTED, exact literal): back link, h1, subtitle.
    expectInOrder(html, [
      '<a href="/portal" class="chq-portal-back">‹ Your portal</a>',
      '<h1 class="chq-portal-hero chq-portal-hero-drill chq-portal-resources-hero">Resources</h1>',
      '<p class="chq-portal-sub">The same for every speaker · nothing here is about your session</p>',
    ]);

    // 4/7, 5/7 (ASSERTED BY SHAPE per DEC-967 -- `{{ r.name }}`/`{{ r.detail
    // }}` at :1572/:1573 are template placeholders, never pinned): each row
    // draws a title, then for a file resource (never a wiki one -- the
    // frame's own control literal below is never true for a wiki row) the
    // control.
    expectInOrder(html, [
      '<span class="chq-portal-row-title">AV requirements</span>',
      '<div class="chq-portal-actions">',
      '<a href="/portal/resources/res-file-1/download" class="chq-btn chq-btn-secondary">Open</a>',
    ]);
    // The route's own literal is "Open", matching :1575 exactly -- the
    // former "Download" wording (a lie on the wiki half of the population,
    // DEC-029) is gone.
    expect(html).not.toContain(">Download<");

    // 6/7 (the frame's undocked footer note, ASSERTED, exact literal), 7/7
    // (no dock at all on this page -- MATCHES the frame's absence of a
    // control in its own footer band at :1580-1582).
    expectInOrder(html, [
      '<footer class="chq-portal-footer">',
      '<span class="chq-portal-resources-footer-note">Questions? Reply to any of our emails.</span>',
    ]);
    expect(html).not.toContain('class="chq-portal-dock"');
  });
});
