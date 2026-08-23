// PORTAL 390 REQUEST VERDICTS (task w28-e, DEC-976 wave-28 amendment) --
// companion to test/portal-phone-frames.test.ts's CSS-TEXT scan, never a
// replacement (that file's pins stay untouched). jsdom applies no
// stylesheet and evaluates no @media rule, so the CSS-text scan is the
// right tool for phone GEOMETRY (padding/min-height/border) but cannot see
// MARKUP at all -- no H1, no dock band, no back link, no control label.
// This file dispatches REAL requests through the mounted /portal/* route
// sub-apps (never a hand-built-props view call) against the RESPONSE BODY
// and grades exactly the four assertion classes this task's brief names,
// for the three width:390 frames it owns in "docs/design/Chautauqua
// Public and Portal.dc.html": "Speaker portal" (:414-472), "Portal · Your
// tasks" (:476-501), "Portal · Your profile" (:531-559).
//
// MEASUREMENT NOTE for the planner: test/portal-390-frame-verdicts.test.ts
// (committed on main, task w14-sd) already dispatches real requests
// against these same three routes and asserts H1/back-link/dock/section
// structure and order, with docs/design/audit/portal-v12.md's "Portal SSR
// 390 per-frame render verdicts, part 1 of 2" section already recording
// MATCHES/DIVERGES for all three. That file is NOT duplicated here --
// this file exists to isolate exactly the four assertion classes this
// task's brief names (H1-text-equality, dock CARDINALITY zero/one, back-
// link presence, and full control-label coverage under a single fixture)
// as their own directly-citable population, and it surfaces two control-
// label gaps that file's order-only checks do not name (see the "Speaker
// portal" H1-numeral note and the "Your profile" headshot-control note
// below, both filed as findings in docs/design/audit/portal-v12.md's new
// "Request verdicts (wave 28)" section, never fixed here).
//
// Harness copied verbatim from test/portal-page-headings.test.ts's four
// vi.mock blocks + buildApp() (DEC-613: a second copy of a vocabulary is a
// trap -- this is the SAME copy every portal SSR verdict file in this tree
// already carries, not a new one). Fixture: 2 pending task assignments (one
// general, one form), no accepted sessions, no submissions, no completed
// tasks, no headshot -- the exact scenario test/portal-page-headings.test.ts
// and test/portal-390-frame-verdicts.test.ts already use.
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

/** DEC-967 shape: the ACTUAL frame line, so every citation below can
 * assert it byte-for-byte matches the literal the citation claims via an
 * inline `expect(designLine(N)).toBe(...)` -- kept as a receipted `expect(`
 * immediately beneath its own citation comment (app/src/frame-citation.
 * scan.test.ts's UNRECEIPTED_CLAIM_CEILING requires a real `expect(` within
 * 6 source lines of the citation), rather than test/portal-390-frame-
 * verdicts.test.ts's own `verbatimLine` helper, whose internal `expect(`
 * lives in a different file and so cannot receipt a citation here. */
function designLine(lineNo: number): string {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  return line;
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

function countTags(html: string, tag: string): number {
  const matches = html.match(new RegExp(`<${tag}[ >]`, "g"));
  return matches ? matches.length : 0;
}

function h1Text(html: string): string {
  const m = /<h1[^>]*>([^<]*)<\/h1>/.exec(html);
  if (!m) throw new Error("no <h1> found");
  return m[1]!;
}

describe('v12 phone frame "Speaker portal" (:414-472, GET /portal)', () => {
  it("exactly one <h1>-equivalent hero, CONFORMS on the literal (frame spells the count, the route now spells it too, DEC-380 wave-22 amendment)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:420
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Two things to do</span>`
    expect(designLine(420)).toBe(
      `        <span style="font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Two things to do</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(countTags(html, "h1")).toBe(1);
    // Byte-equal match: the frame's own literal spells the count in words
    // ("Two"); the route now composes the SAME spelling through
    // src/domain/count-copy.ts's capitalizeFirst(spellCount(n)) +
    // plural(n, "thing") pair (DEC-380 wave-22 amendment) -- countOf (the
    // numeral register, DEC-925) stays reserved for data-dense surfaces.
    // Two things to do (n=2, this fixture's two pending task assignments)
    // -> the route's actual H1 text is "Two things to do", byte-equal to
    // the frame's literal.
    expect(h1Text(html)).toBe("Two things to do");
  });

  it("draws no dock band -- the frame's footer (:463-465) is a plain name/link band, not a pinned action dock", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:463
    // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; align-items:center; gap:12px">`
    expect(designLine(463)).toBe(
      `      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; align-items:center; gap:12px">`,
    );
    const app = await buildApp();
    const res = await app.request("/portal");
    const html = await res.text();
    // No .chq-portal-dock element on this route -- the frame draws no
    // pinned primary/secondary action pair on its landing page, only the
    // name/company clause + Profile link, and the route agrees.
    expect(html).not.toContain('class="chq-portal-dock"');
  });

  it("every static (non-data-driven) control label the frame draws inside its extent is present in the body", async () => {
    const app = await buildApp();
    const res = await app.request("/portal");
    const html = await res.text();
    // The "Your session"/"Upload again"/"Read notes" card only renders when
    // getMySessions returns an accepted session; this fixture (copied from
    // test/portal-page-headings.test.ts) has none, so the section label
    // itself (part of the always-drawn chq-section skeleton) is checked,
    // never the session-only row labels -- out of scope for this fixture,
    // not a finding.

    // docs/design/Chautauqua Public and Portal.dc.html:417
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px">chautauqua</span>`
    expect(designLine(417)).toBe(
      `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px">chautauqua</span>`,
    );
    expect(html).toContain(">chautauqua<");

    // docs/design/Chautauqua Public and Portal.dc.html:426
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Waiting on you</span>`
    expect(designLine(426)).toBe(
      `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Waiting on you</span>`,
    );
    expect(html).toContain(">Waiting on you<");

    // docs/design/Chautauqua Public and Portal.dc.html:440
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Your session</span>`
    expect(designLine(440)).toBe(
      `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Your session</span>`,
    );
    expect(html).toContain(">Your session<");

    // docs/design/Chautauqua Public and Portal.dc.html:453
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Done</span>`
    expect(designLine(453)).toBe(
      `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Done</span>`,
    );
    expect(html).toContain(">Done<");

    // docs/design/Chautauqua Public and Portal.dc.html:465
    // `<a href="#" style="margin-left:auto; font-size:13px; font-weight:700">Profile</a>`
    expect(designLine(465)).toBe(`        <a href="#" style="margin-left:auto; font-size:13px; font-weight:700">Profile</a>`);
    expect(html).toContain('class="chq-portal-footer-profile">Profile<');
  });
});

describe('v12 phone frame "Portal · Your tasks" (:476-501, GET /portal/tasks)', () => {
  it("exactly one <h1>, text equal to the frame's drawn literal", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:479
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your tasks</h1>`
    expect(designLine(479)).toBe(
      `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your tasks</h1>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(countTags(html, "h1")).toBe(1);
    expect(h1Text(html)).toBe("Your tasks");
  });

  it("back-link label '‹ Your portal' renders once", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:478
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
    expect(designLine(478)).toBe(
      `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    const html = await res.text();
    expect(html).toContain('class="chq-portal-back">‹ Your portal<');
  });

  it("dock band renders exactly once, DIVERGES on control count (frame draws a primary+secondary pair, the route dock holds one control -- already blessed in DEVIATIONS.md)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:492
    // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
    expect(designLine(492)).toBe(
      `      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    const html = await res.text();
    expect((html.match(/class="chq-portal-dock"/g) ?? []).length).toBe(1);
    // "Later" (:494 second dock button) has no verb behind it (DEVIATIONS.md
    // "Portal task-list dock 'Later'") -- never rendered, at any state.
    expect(html).not.toContain(">Later<");
  });
});

describe('v12 phone frame "Portal · Your profile" (:531-559, GET /portal/profile)', () => {
  it("exactly one <h1>, text equal to the frame's drawn literal", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:534
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your profile</h1>`
    expect(designLine(534)).toBe(
      `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your profile</h1>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(countTags(html, "h1")).toBe(1);
    expect(h1Text(html)).toBe("Your profile");
  });

  it("back-link label '‹ Your portal' renders once", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:533
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
    expect(designLine(533)).toBe(
      `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect(html).toContain('class="chq-portal-back">‹ Your portal<');
  });

  it("dock band renders exactly once, DIVERGES on control count (no Cancel -- already blessed in DEVIATIONS.md)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:550
    // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
    expect(designLine(550)).toBe(
      `      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect((html.match(/class="chq-portal-dock"/g) ?? []).length).toBe(1);
    expect(html).not.toContain(">Cancel<");
  });

  it("MATCHES (DEC-576 wave-21): the frame's 'Replace' headshot control label renders as the bordered pill when a headshot is already on file", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:541
    // `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Replace</span>`
    expect(designLine(541)).toBe(
      `            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Replace</span>`,
    );
    const { getContactProfile } = await import("../src/server/repo/profile");
    vi.mocked(getContactProfile).mockResolvedValueOnce({
      id: "ct-1",
      firstName: "Priya",
      lastName: "Raman",
      title: null,
      company: null,
      bio: null,
      headshotUrl: "https://example.test/headshot.jpg",
      socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
    });
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect((html.match(/class="chq-portal-headshot-pick"/g) ?? []).length).toBe(1);
    expect(html).toContain(">Replace<input");
  });

  it("MATCHES (DEC-576 wave-21 clause (b)): the control label reads 'Add a headshot' when none is on file", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:541
    // `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Replace</span>`
    expect(designLine(541)).toBe(
      `            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Replace</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    const html = await res.text();
    expect((html.match(/class="chq-portal-headshot-pick"/g) ?? []).length).toBe(1);
    expect(html).toContain(">Add a headshot<input");
  });
});
