// PORTAL 390 REQUEST VERDICTS -- the two remaining frames (task w9-rd,
// DEC-967 wave-9 amendment). Companion to test/portal-remaining-phone-
// frames.test.ts, never a replacement (that file's citations stay
// untouched). That file renders ResourcesPage/EditPage as pure components
// to a string and reads the design file back -- it issues no requests, so
// its verdict is a citation, not a conformance measurement. This file
// dispatches REAL requests through the mounted /portal/* route sub-apps
// (never a hand-built-props view call) against the RESPONSE BODY for the
// two width:390 frames test/portal-phone-frames.render.test.ts's request
// coverage does not reach: "Portal · Resources" (:1557-1583) and
// "Portal · co-presenter rejected" (:1300-1372), both in "docs/design/
// Chautauqua Public and Portal.dc.html".
//
// Harness copied verbatim from test/portal-phone-frames.render.test.ts's
// vi.mock blocks + buildApp() (itself copied from test/portal-page-
// headings.test.ts) -- DEC-613: a second copy of a vocabulary is a trap,
// so this is the SAME copy every portal SSR verdict file in this tree
// already carries, extended with only what this task's two frames need:
// getMyResources returns a real resource group (Resources renders its
// non-empty state) and the portal-edit mock gains addCoPresenter, mocked
// to return the CO_PRESENTER_DUPLICATE_MESSAGE refusal DEC-651 requires
// this task drive through the real POST route rather than by mounting a
// refusal component directly.
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
import { CO_PRESENTER_DUPLICATE_MESSAGE } from "../src/server/repo/portal-edit";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: the ACTUAL frame line, so every citation below can assert
 * it byte-for-byte matches the literal the citation claims. */
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
    getMyTaskAssignments: vi.fn(async () => []),
    getAssignmentScope: vi.fn(async () => null),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async () => null),
    // v12m-w9-rd: unlike the three-frame harness this is copied from, the
    // "Portal · Resources" frame needs a non-empty resource group so its
    // row markup ("Open" control, footer note) actually renders.
    getMyResources: vi.fn(async () => [
      {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        resources: [{ id: "res-1", kind: "file", title: "Speaker deck template", content: null, fileId: "file-1" }],
      },
    ]),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    listFields: vi.fn(async () => []),
  };
});

// v12m-w9-rd: the co-presenter refusal must be a REAL refusal driven
// through the real POST route (DEC-651), never a hand-built props call --
// addCoPresenter itself is mocked here (its own duplicate-detection lives
// behind a D1 uniqueIndex/onConflictDoNothing this in-process harness has
// no database for), everything downstream of that mocked return value
// (the render, the error-shape gating, the DEC-029 second-submit wiring)
// is the real route/view code under test.
const loadEditableSubmissionMock = vi.fn(
  async (): Promise<EditableSubmissionData | null> => ({
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
  }),
);
const getPortalParticipantsMock = vi.fn(async () => [
  {
    id: "p-1",
    contactId: "ct-2",
    name: "Priya Raman",
    email: "priya@example.com",
    role: "speaker" as const,
    roleLabel: "Speaker",
    visible: true,
  },
]);
const addCoPresenterMock = vi.fn(
  async (..._args: unknown[]) =>
    ({ ok: false, errors: { email: CO_PRESENTER_DUPLICATE_MESSAGE } }) as
      | { ok: true }
      | { ok: false; errors: Record<string, string> },
);

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: (...args: unknown[]) => loadEditableSubmissionMock(...(args as [])),
    getPortalParticipants: (...args: unknown[]) => getPortalParticipantsMock(...(args as [])),
    getAllSubmissionParticipants: (...args: unknown[]) => getPortalParticipantsMock(...(args as [])),
    addCoPresenter: (...args: unknown[]) => addCoPresenterMock(...(args as [])),
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

const CSRF_TOKEN = "test-csrf-token";

function postDuplicateCoPresenter(app: Hono<AppEnv>) {
  const params = new URLSearchParams();
  params.append(CSRF_COOKIE_NAME, CSRF_TOKEN);
  params.append("firstName", "Priya");
  params.append("lastName", "Raman");
  params.append("email", "priya@example.com");
  params.append("role", "moderator");
  return app.request("/portal/submissions/s1/participants", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
    },
    body: params.toString(),
  });
}

describe('v12 phone frame "Portal · Resources" (:1557-1583, GET /portal/resources)', () => {
  it("frame container (:1561) is the standard 390x844 phone card", () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1561
    // `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    expect(designLine(1561)).toBe(
      `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`,
    );
  });

  it("back link (:1563) reads '‹ Your portal'", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1563
    // `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
    expect(designLine(1563)).toBe(
      `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Your portal");
  });

  it("H1 (:1564) reads 'Resources'", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1564
    // `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Resources</h1>`
    expect(designLine(1564)).toBe(
      `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Resources</h1>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    const html = await res.text();
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    const m = /<h1[^>]*>([^<]*)<\/h1>/.exec(html);
    expect(m?.[1]).toBe("Resources");
  });

  it("subtitle (:1565) states the shared, not-about-your-session fact", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1565
    // `        <span style="font-size:13px; color:#565A4B; line-height:1.5">The same for every speaker · nothing here is about your session</span>`
    expect(designLine(1565)).toBe(
      `        <span style="font-size:13px; color:#565A4B; line-height:1.5">The same for every speaker · nothing here is about your session</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    const html = await res.text();
    expect(html).toContain("The same for every speaker · nothing here is about your session");
  });

  it("row control (:1575) is labelled 'Open', not 'Download'", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1575
    // `            <span style="border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; color:#2E2A24; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600; flex-shrink:0">Open</span>`
    expect(designLine(1575)).toBe(
      `            <span style="border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; color:#2E2A24; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600; flex-shrink:0">Open</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    const html = await res.text();
    expect(html).toContain(">Open</a>");
    expect(html).not.toContain(">Download</a>");
  });

  it("docked footer note (:1581) carries the reply-to-any-email note", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1581
    // `        <span style="font-size:12px; color:#565A4B; line-height:1.5">Questions? Reply to any of our emails.</span>`
    expect(designLine(1581)).toBe(
      `        <span style="font-size:12px; color:#565A4B; line-height:1.5">Questions? Reply to any of our emails.</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    const html = await res.text();
    expect(html).toContain("Questions? Reply to any of our emails.");
  });
});

describe('v12 phone frame "Portal · co-presenter rejected" (:1300-1372, real POST refusal through POST /portal/submissions/:id/participants)', () => {
  it("frame container (:1304) is the standard 390x844 phone card", () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1304
    // `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    expect(designLine(1304)).toBe(
      `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`,
    );
  });

  it("callout head (:1313) reads 'Nobody was added', driven by a real duplicate refusal", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1313
    // `          <span style="font-size:14px; font-weight:700; line-height:1.4">Nobody was added</span>`
    expect(designLine(1313)).toBe(
      `          <span style="font-size:14px; font-weight:700; line-height:1.4">Nobody was added</span>`,
    );
    const app = await buildApp();
    const res = await postDuplicateCoPresenter(app);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("<h2>Nobody was added</h2>");
  });

  it("callout body (:1314) names the person already on the session and states typed values survived", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1314
    // `          <span style="font-size:13px; line-height:1.55; color:#3F4237">Priya is already on this session. Everything you typed is still below.</span>`
    expect(designLine(1314)).toBe(
      `          <span style="font-size:13px; line-height:1.55; color:#3F4237">Priya is already on this session. Everything you typed is still below.</span>`,
    );
    const app = await buildApp();
    const res = await postDuplicateCoPresenter(app);
    const html = await res.text();
    expect(html).toContain("Priya Raman is already on this session. Everything you typed is still below.");
  });

  it("field sentence (:1349) still renders the server's own duplicate message, unchanged", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1349
    // `          <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">This person is already a participant on this submission.</span>`
    expect(designLine(1349)).toBe(
      `          <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">This person is already a participant on this submission.</span>`,
    );
    const app = await buildApp();
    const res = await postDuplicateCoPresenter(app);
    const html = await res.text();
    expect(html).toContain(CO_PRESENTER_DUPLICATE_MESSAGE);
  });

  it("DEC-029 second-submit wiring survives the refusal render -- every co-presenter control still carries form=\"chq-portal-edit-form\"", async () => {
    const app = await buildApp();
    const res = await postDuplicateCoPresenter(app);
    const html = await res.text();
    expect(html).toContain("<h2>Nobody was added</h2>");
    for (const id of ["cp-first-name", "cp-last-name", "cp-email", "cp-role"]) {
      const start = html.indexOf(`id="${id}"`);
      expect(start, `expected #${id} in the refusal render`).toBeGreaterThan(-1);
      const windowStart = Math.max(0, start - 200);
      const tagWindow = html.slice(windowStart, start + 200);
      expect(tagWindow).toContain('form="chq-portal-edit-form"');
    }
  });
});
