// DEC-976 (wave-158 SSR clause): `grep -c 'app.request'` is 0 across every
// SSR "phone-frames" test in this tree — those tests read stylesheet TEXT
// and never dispatch a request, so 20 of 53 phone frames were graded by
// grep. This file builds real `app.request()` verdicts for the four portal
// drill/state frames named by task w14-se (the other four portal frames —
// :505 Hotel stay form was already the target of a companion lane's
// coverage note; here we cover Hotel stay form, Your session, Edit your
// session, and the co-presenter-rejected state). MEASUREMENT ONLY per the
// task: no route module and no .css.ts touched by this commit.
//
// Harness copied from test/portal-page-headings.test.ts (its four vi.mock
// blocks, buildApp() shape, and app.request()/res.text() idiom) rather than
// inventing a fifth mock stack (DEC-613).
//
// ---------------------------------------------------------------------------
// VERDICTS (filed here per DEC-976 wave-105 — this lane does not own
// docs/design/audit/portal-v12.md this batch):
//
// 1. docs/design/Chautauqua Public and Portal.dc.html:502 "Portal · Hotel
//    stay form" (GET /portal/tasks/assign-form-1/form) — DIVERGES. The
//    frame's dock (:518-521) draws a primary+secondary pair ("Send this
//    in" + "Save draft"); src/routes/portal/tasks/views.tsx's taskFormDock
//    renders only the primary. The comment at views.tsx:374-375 already
//    states this is deliberate ("DEVIATIONS.md §6 defers hotel-form
//    save-draft as unbuilt") and test/frame-control-label.scan.test.ts has
//    no blessed-label entry for :520 "Save draft" (unlike :494 "Later",
//    which IS blessed) — so "Save draft" is a real, still-unbuilt gap, not
//    a mis-citation. The frame's back link at :507 "‹ Your portal" also
//    diverges from the rendered "‹ Your tasks" (PortalBackLink resolves
//    "/portal/tasks" through the DEC-914 table) — already a catalogued
//    entry in test/frame-control-label.scan.test.ts:576-581 (blessed as
//    PortalBackLink-composed), so not re-litigated as a fresh finding here.
//
// 2. docs/design/Chautauqua Public and Portal.dc.html:560 "Portal · Your
//    session" (GET /portal/submissions/sub-mine) — MATCHES, with one
//    already-catalogued label divergence. The frame's dock (:587-589) draws
//    "Upload slides" (primary) + "Edit" (secondary); this fixture has no
//    file_request task candidate for "sub-mine" so only the secondary
//    renders (data-dependent, not a code defect — SubmissionDetailPage's
//    dock is `fileRequestTask ? primary : null` + `editable ? secondary :
//    null`), and its label is "Edit submission", not the frame's bare
//    "Edit" — an expansion for clarity, uncatalogued in
//    test/frame-control-label.scan.test.ts but not a broken/missing
//    control. The back link ("‹ Your submissions" vs frame's "‹ Your
//    portal" at :565) is the DEVIATIONS.md-sanctioned entry quoted below.
//
// 3. docs/design/Chautauqua Public and Portal.dc.html:597 "Portal · Edit
//    your session" (GET /portal/submissions/s1/edit) — MATCHES. The
//    frame's dock (:660-665) draws "Save changes" (primary) before
//    "Cancel" (secondary), then the note line below the pair.
//    src/routes/portal/edit.tsx's `editDock` (the copy PortalLayout's
//    footer actually reveals at phone width, portal.css.ts:628-645) renders
//    in exactly that order. The back link "‹ Your session" (:602) matches
//    verbatim.
//
// 4. docs/design/Chautauqua Public and Portal.dc.html:1300 "Portal ·
//    co-presenter rejected" (POST /portal/submissions/s1/participants with
//    a duplicate email) — MATCHES. The frame's callout (:1313-1314)
//    "Nobody was added" / "<name> is already on this session. Everything
//    you typed is still below." and the dock (:1360-1365, byte-identical
//    to :660-665's Save changes/Cancel pair) both render as drawn. Status
//    is 400, not 200 — DEC-029 (wave-108 amendment, edit.tsx:672-693): a
//    refusal re-renders the edit page directly at 400 so the speaker's
//    unsaved typing is never discarded by a redirect. THE TEST MUST PASS
//    on what the route ACTUALLY emits, so this one asserts 400.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData, AddCoPresenterResult, PortalParticipant } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

const REJECTED_PARTICIPANT: PortalParticipant = {
  id: "part-1",
  contactId: "ct-1",
  name: "Priya Raman",
  email: "priya@example.com",
  role: "speaker",
  roleLabel: "Speaker",
  visible: true,
};

const addCoPresenterMock = vi.fn<(...args: unknown[]) => Promise<AddCoPresenterResult>>(async () => ({ ok: true }));

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
    // Frame :1300 fixture: one participant already on the session, so a
    // duplicate-email co-presenter POST can name her in the "Nobody was
    // added" callout exactly as :1314 draws it.
    getPortalParticipants: vi.fn(async () => [REJECTED_PARTICIPANT]),
    addCoPresenter: (...args: unknown[]) => addCoPresenterMock(...args),
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

describe("portal 390 frame verdicts — drill/state frames (DEC-976 wave-158)", () => {
  it("MATCHES/DIVERGES: docs/design/Chautauqua Public and Portal.dc.html:502 'Portal · Hotel stay form' (GET /portal/tasks/assign-form-1/form) — dock primary matches, secondary 'Save draft' is unbuilt", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/tasks/assign-form-1/form");
    expect(res.status).toBe(200);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:518
    // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
    // draws the pinned dock band. views.tsx renders the SAME band as
    // `chq-portal-taskform-dock`.
    expect(html).toContain('<div class="chq-portal-taskform-dock">');

    // docs/design/Chautauqua Public and Portal.dc.html:519
    // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Send this in</span>`
    // — the primary verb, rendered twice (dock + in-flow second submit),
    // both product bytes below.
    const sendCount = (html.match(/Send this in/g) ?? []).length;
    expect(sendCount).toBe(2);

    // docs/design/Chautauqua Public and Portal.dc.html:520
    // `<span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Save draft</span>`
    // — DIVERGES: no "Save draft" control exists anywhere on this page.
    expect(html).not.toContain("Save draft");

    // docs/design/Chautauqua Public and Portal.dc.html:511
    // `<span style="font-size:13px; color:#565A4B; line-height:1.55">5 questions · used to book your room</span>`
    // — the live field count composes instead of the frame's fixed "5"; this
    // fixture's listFields mock returns zero fields, so the count reads 0,
    // never the frame's literal "5" (COMPOSED-from-data, not a defect).
    expect(html).toContain("0 questions");
  });

  it("MATCHES: docs/design/Chautauqua Public and Portal.dc.html:560 'Portal · Your session' (GET /portal/submissions/sub-mine) — dock renders the data-eligible half of the primary/secondary pair", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:566
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your session</h1>`
    expect(html).toContain('<h1 class="chq-portal-hero">Your session</h1>');

    // docs/design/Chautauqua Public and Portal.dc.html:589
    // `<span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Edit</span>`
    // — this fixture's editable submission renders the dock's secondary as
    // "Edit submission" (an expansion of the frame's bare "Edit"), inside
    // the real `.chq-portal-dock` band (not the in-flow copy).
    expect(html).toContain('<div class="chq-portal-dock"><a href="/portal/submissions/sub-mine/edit" class="chq-btn chq-btn-secondary">Edit submission</a></div>');

    // docs/design/Chautauqua Public and Portal.dc.html:588
    // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Upload slides</span>`
    // — no primary renders: no `file_request` assignment is in scope here,
    // so SubmissionDetailPage's `fileRequestTask` resolves null (data-
    // dependent omission, not a missing control).
    expect(html).not.toContain("Upload slides");
  });

  it("MATCHES: docs/design/Chautauqua Public and Portal.dc.html:597 'Portal · Edit your session' (GET /portal/submissions/s1/edit) — the phone dock's Save changes/Cancel order matches the frame", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:603
    // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Edit your session</h1>`
    expect(html).toContain('<h1 class="chq-portal-hero chq-portal-hero-drill">Edit your session</h1>');

    // docs/design/Chautauqua Public and Portal.dc.html:661-663
    // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save changes</span>` / `Cancel`
    // — the phone-revealed `.chq-portal-edit-dock` copy: primary before
    // secondary, matching this order.
    const dockMatch = html.match(/<div class="chq-portal-edit-dock">.*?<\/div>\s*<\/div>/s);
    expect(dockMatch).not.toBeNull();
    const dockHtml = dockMatch![0];
    expect(dockHtml.indexOf("Save changes")).toBeGreaterThan(-1);
    expect(dockHtml.indexOf("Save changes")).toBeLessThan(dockHtml.indexOf("Cancel"));

    // docs/design/Chautauqua Public and Portal.dc.html:602
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your session</a>`
    // (PortalBackLink's JSX text `&lsaquo; {label}` decodes to the literal
    // "‹" character on serialization — not the raw entity bytes.)
    expect(html).toContain("‹ Your session");
  });

  it("MATCHES: docs/design/Chautauqua Public and Portal.dc.html:1300 'Portal · co-presenter rejected' (POST /portal/submissions/s1/participants, duplicate email) — refusal callout and dock render as drawn", async () => {
    addCoPresenterMock.mockResolvedValueOnce({
      ok: false,
      errors: { email: "This person is already a participant on this submission" },
    });
    const app = await buildApp();
    const params = new URLSearchParams();
    params.append("chq_csrf", "test-csrf-token");
    params.append("firstName", "Priya");
    params.append("lastName", "Raman");
    params.append("email", "priya@example.com");
    params.append("role", "co-presenter");
    const res = await app.request("/portal/submissions/s1/participants", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "chq_csrf=test-csrf-token",
      },
      body: params.toString(),
    });
    // DEC-029 (wave-108 amendment, edit.tsx:672-693): a refusal re-renders
    // the edit page directly at 400 (never a redirect, which would discard
    // the speaker's unsaved typing) — the route's ACTUAL status, not the
    // 200 most of this suite's routes emit.
    expect(res.status).toBe(400);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:1313
    // `<span style="font-size:14px; font-weight:700; line-height:1.4">Nobody was added</span>`
    expect(html).toContain("Nobody was added");

    // docs/design/Chautauqua Public and Portal.dc.html:1314
    // `<span style="font-size:13px; line-height:1.55; color:#3F4237">Priya is already on this session. Everything you typed is still below.</span>`
    // — the matched participant's own name (edit.tsx's `duplicateMatch`),
    // not a generic "This person".
    expect(html).toContain("Priya Raman is already on this session. Everything you typed is still below.");

    // docs/design/Chautauqua Public and Portal.dc.html:1362-1363
    // `<span style="flex:1; background:#4E5C31; ...">Save changes</span>` / `Cancel`
    // — same edit-dock band as the plain edit-your-session frame, present
    // on the refusal re-render too.
    expect(html).toContain('<div class="chq-portal-edit-dock">');
    expect(html).toContain("Save changes");
  });
});
