// PORTAL SESSION 390 REQUEST VERDICTS (task w9-rc, DEC-967 wave-9
// amendment) -- companion to test/portal-session-phone-frames.test.ts's
// CSS-TEXT + pure-component `.toString()` pins (which issue ZERO requests
// and so cannot see whether the drawn markup renders off a real route) and
// to test/portal-phone-frames.render.test.ts, whose request coverage stops
// at frames :414-472, :476-501 and :531-559. This file dispatches REAL
// requests through the mounted /portal/* route sub-apps (never a
// hand-built-props view call) against the RESPONSE BODY for the three
// remaining width:390 frames in "docs/design/Chautauqua Public and
// Portal.dc.html": "Portal · Hotel stay form" (:502-527),
// "Portal · Your session" (:560-596) and "Portal · Edit your session"
// (:597-679) -- extents derived by test/phone-frame-ledger.scan.test.ts's
// own grammar (a `font-size:19px` + `>TITLE</span>` label line starts a
// frame, the extent runs to the next label line in the file).
//
// Harness copied verbatim from test/portal-phone-frames.render.test.ts's
// four vi.mock blocks + buildApp() (DEC-613: a second copy of a vocabulary
// is a trap -- this is the SAME copy every portal SSR verdict file in this
// tree already carries, not a new one), extended only where a route this
// file exercises reads a repo function the existing mock left un-stubbed
// (getPortalSubmissionDetail for the session-detail route). Fixture: one
// pending form-kind task assignment ("Hotel stay form"), no accepted
// sessions, no headshot -- matching test/portal-phone-frames.render.test.ts's
// scenario wherever this file's routes overlap it.
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
import type { PortalSubmissionDetail } from "../src/server/repo/portal";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: the ACTUAL frame line, so every citation below can
 * assert it byte-for-byte matches the literal the citation claims via an
 * inline `expect(designLine(N)).toBe(...)` immediately beneath its own
 * citation comment. */
function designLine(lineNo: number): string {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  return line;
}

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

const assignFormOne = {
  id: "assign-form-1",
  taskId: "task-2",
  eventId: "evt-1",
  kind: "form" as const,
  title: "Hotel stay form",
  description: null,
  dueDate: null,
  assignedAt: 0,
  required: false,
  status: "pending" as const,
  formId: "f1",
  deliverableKind: null,
  fileId: null,
  responseJson: null,
  timezone: "UTC",
  completedAt: null,
};

const submissionDetail: PortalSubmissionDetail = {
  id: "s1",
  eventId: "evt-1",
  ref: "DFC-014",
  title: "Taming 40-Minute CI",
  description: "Our monorepo CI took 40 minutes on a good day.",
  status: "accepted",
  statusLabel: "Accepted",
  submittedAt: 0,
  timezone: "UTC",
  answers: [],
  trackName: null,
  format: null,
  day: null,
  startMin: null,
  endMin: null,
  roomName: null,
};

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
    getMyTaskAssignments: vi.fn(async () => [assignFormOne]),
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
    getPortalSubmissionDetail: vi.fn(async () => submissionDetail),
    getMyResources: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    listFields: vi.fn(async () => [
      { id: "f1", formId: "form-1", locked: false, section: "session", kind: "text", label: "Do you need a hotel room?", required: true, position: 0 },
    ]),
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
        { id: "last_name", section: "speaker", kind: "text", label: "Last name", required: true, position: 1 },
      ] as FormFieldDef[],
      answers: { first_name: "Jane", last_name: "Doe" },
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

function countTags(html: string, tag: string): number {
  const matches = html.match(new RegExp(`<${tag}[ >]`, "g"));
  return matches ? matches.length : 0;
}

function h1Text(html: string): string {
  const m = /<h1[^>]*>([^<]*)<\/h1>/.exec(html);
  if (!m) throw new Error("no <h1> found");
  return m[1]!;
}

describe('v12 phone frame "Portal · Hotel stay form" (:502-527, GET /portal/tasks/:assignmentId/form)', () => {
  it("exactly one <h1>, text equal to the frame's drawn literal", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:508
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Hotel stay form</h1>`
    expect(designLine(508)).toBe(
      `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Hotel stay form</h1>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks/assign-form-1/form");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(countTags(html, "h1")).toBe(1);
    expect(h1Text(html)).toBe("Hotel stay form");
  });

  it("back link renders once, MATCHES the literal (DEC-029 wave-21: frame draws '‹ Your portal', the route's href now points at /portal so the DEC-914 label table resolves to the same 'Your portal')", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:507
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
    expect(designLine(507)).toBe(
      `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks/assign-form-1/form");
    const html = await res.text();
    expect(html).toContain('<a href="/portal" class="chq-portal-back">‹ Your portal<');
    expect(html).not.toContain('class="chq-portal-back">‹ Your tasks<');
  });

  it("dock band renders exactly once, holding the frame's primary verb 'Send this in' -- the frame's bordered 'Save draft' secondary is unbuilt (already blessed in DEVIATIONS.md)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:518
    // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
    expect(designLine(518)).toBe(
      `      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`,
    );
    // docs/design/Chautauqua Public and Portal.dc.html:519
    // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Send this in</span>`
    expect(designLine(519)).toBe(
      `        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Send this in</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks/assign-form-1/form");
    const html = await res.text();
    expect((html.match(/class="chq-portal-dock"/g) ?? []).length).toBe(1);
    expect(html).toContain(">Send this in<");
    // docs/design/Chautauqua Public and Portal.dc.html:520
    // `<span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Save draft</span>`
    expect(designLine(520)).toBe(
      `        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Save draft</span>`,
    );
    expect(html).not.toContain(">Save draft<");
  });

  it("field label from the field-count clause's register renders in the body (:514 field-row label span)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:514
    // `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">{{ q.label }}</span>`
    expect(designLine(514)).toBe(
      `            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">{{ q.label }}</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/tasks/assign-form-1/form");
    const html = await res.text();
    expect(html).toContain("Do you need a hotel room?");
  });
});

describe('v12 phone frame "Portal · Your session" (:560-596, GET /portal/submissions/:id)', () => {
  it("exactly one <h1>, text equal to the frame's drawn literal", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:566
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your session</h1>`
    expect(designLine(566)).toBe(
      `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your session</h1>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(countTags(html, "h1")).toBe(1);
    expect(h1Text(html)).toBe("Your session");
  });

  it("back link renders once, MATCHES the literal (DEC-029 wave-21: frame draws '‹ Your portal', the route's href now points at /portal so the DEC-914 label table resolves to the same 'Your portal')", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:565
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
    expect(designLine(565)).toBe(
      `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1");
    const html = await res.text();
    expect(html).toContain('<a href="/portal" class="chq-portal-back">‹ Your portal<');
    expect(html).not.toContain('class="chq-portal-back">‹ Your submissions<');
  });

  it("status eyebrow renders once, composing the fixture's status/date onto the frame's own badge register", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:569
    // `<span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Accepted · 14 Mar</span>`
    expect(designLine(569)).toBe(
      `        <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#4E5C31">Accepted · 14 Mar</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1");
    const html = await res.text();
    expect(html).toContain('class="chq-flag chq-portal-status-badge"');
    expect(html).toContain("Accepted");
  });

  it("no Slides deliverable row -- the fixture has no deliverable, so the empty-state copy renders, never the frame's illustrative filename/version row", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:582
    // `<span style="font-size:14px; font-weight:600">taming-ci-devflow.pdf</span>`
    expect(designLine(582)).toBe(
      `            <span style="font-size:14px; font-weight:600">taming-ci-devflow.pdf</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1");
    const html = await res.text();
    expect(html).not.toContain("taming-ci-devflow.pdf");
  });
});

describe('v12 phone frame "Portal · Edit your session" (:597-679, GET /portal/submissions/:id/edit)', () => {
  it("exactly one <h1>, text equal to the frame's drawn literal", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:603
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Edit your session</h1>`
    expect(designLine(603)).toBe(
      `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Edit your session</h1>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(countTags(html, "h1")).toBe(1);
    expect(h1Text(html)).toBe("Edit your session");
  });

  it("back link renders once, MATCHES the literal (frame draws '‹ Your session', the route's DEC-914 label table resolves the per-submission destination /portal/submissions/:id to the same 'Your session' label)", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:602
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your session</a>`
    expect(designLine(602)).toBe(
      `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your session</a>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    const html = await res.text();
    expect(html).toContain('class="chq-portal-back">‹ Your session<');
  });

  it("First name precedes Last name in DOM order, off the real route", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:644
    // `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">First name</span>`
    expect(designLine(644)).toBe(
      `              <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">First name</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    const html = await res.text();
    const firstIdx = html.indexOf('name="firstName"');
    const lastIdx = html.indexOf('name="lastName"');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(lastIdx).toBeGreaterThan(firstIdx);
  });

  it("dock band renders exactly once, ordering Save changes then Cancel then the consequence note, off the real route", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:669
    // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save changes</span>`
    expect(designLine(669)).toBe(
      `          <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save changes</span>`,
    );
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    const html = await res.text();
    expect((html.match(/class="chq-portal-dock"/g) ?? []).length).toBe(1);
    const dockIdx = html.indexOf('class="chq-portal-edit-dock"');
    const buttonsIdx = html.indexOf('class="chq-portal-edit-dock-buttons"');
    const saveIdx = html.indexOf("Save changes", buttonsIdx);
    const cancelIdx = html.indexOf(">Cancel<", saveIdx);
    const noteIdx = html.lastIndexOf("Title and abstract show on the public pages");
    expect(dockIdx).toBeGreaterThan(-1);
    expect(buttonsIdx).toBeGreaterThan(dockIdx);
    expect(saveIdx).toBeGreaterThan(buttonsIdx);
    expect(cancelIdx).toBeGreaterThan(saveIdx);
    expect(noteIdx).toBeGreaterThan(cancelIdx);
  });
});
