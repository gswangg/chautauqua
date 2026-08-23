// w31-h (V12 MOBILE CAMPAIGN, DEC-976/DEC-385/DEC-967): SSR 390 frame
// verdicts for "Portal · Edit your session" (docs/design/Chautauqua Public
// and Portal.dc.html:600-674) and its co-presenter-rejected companion
// state (:1304-1367). Both render from src/routes/portal/edit.tsx.
//
// DEC-976 SSR clause (wave-158): a phone-frame test that reads CSS/component
// TEXT and never dispatches a request is a citation, not a verdict. This
// file drives the real Hono app via `app.request()` end to end -- GET
// /portal/submissions/:id/edit for :600, and POST
// /portal/submissions/:id/participants with a duplicate email for :1304 --
// and reads `res.text()`. The mock stack below mirrors the shape
// test/portal-390-frame-verdicts-session.test.ts already established for
// these same two frames (itself copied from test/portal-page-headings.test.ts's
// vi.mock/buildApp idiom) rather than inventing a fifth/sixth mock stack
// (DEC-613) -- that file is out of scope for this task (HARD BAN, read-only)
// so this one is authored independently against the same real modules, not
// imported from it.
//
// Every citation below is byte-checked against the frame file at assert
// time via verbatimLine() (DEC-967: a citation is not an assertion until
// something reads the byte it names). Literals are asserted in DRAWN order.
// Frame SAMPLE DATA ("First name"/"Last name"/"their@email.com" ghost text
// inside empty input boxes, the submission's own sample title/abstract
// body, "412 / 1,200", "Priya"/"Raman"/"sbek-speaker@example.com") is
// graded by SHAPE only, never pinned verbatim (DEC-967 field-guide rule).

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData, AddCoPresenterResult, PortalParticipant } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";

const REPO_ROOT = join(__dirname, "..");
const FRAME_PATH = join(REPO_ROOT, "docs/design/Chautauqua Public and Portal.dc.html");
const FRAME_LINES = readFileSync(FRAME_PATH, "utf8").split("\n");

/** Self-verifying citation: asserts the frame file's own 1-indexed line
 * `lineNo` actually contains `literal`, so a stale line pointer fails this
 * test itself rather than silently asserting a fact the frame no longer
 * states (DEC-967: "a citation is not an assertion"). Returns nothing --
 * called purely for its assertion side effect, same idiom the campaign's
 * other verbatimLine() helpers use. */
function verbatimLine(lineNo: number, literal: string): void {
  const line = FRAME_LINES[lineNo - 1];
  expect(line, `docs/design/Chautauqua Public and Portal.dc.html has no line ${lineNo}`).toBeDefined();
  expect(line, `expected line ${lineNo} to contain ${JSON.stringify(literal)}`).toContain(literal);
}

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

const EXISTING_PARTICIPANT: PortalParticipant = {
  id: "part-1",
  contactId: "ct-1",
  name: "Priya Raman",
  email: "priya@example.com",
  role: "speaker",
  roleLabel: "Speaker",
  inviteStatus: "accepted",
  visible: true,
};

const DATA: EditableSubmissionData = {
  submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
  // DEC-522: closeDate is a UTC-midnight DAY LABEL (a number), never a
  // string -- Date.UTC keeps this fixture honest with the real repo shape.
  form: { id: "f1", closeDate: Date.UTC(2027, 7, 16), timezone: "America/Los_Angeles" },
  fields: [
    { id: "first_name", section: "speaker", kind: "text", label: "First name", required: true, position: 0 },
  ] as FormFieldDef[],
  answers: { first_name: "Jane" },
  offeredTrackIds: [],
  allTracks: [],
  selectedTrackIds: [],
  formatLabel: null,
};

const addCoPresenterMock = vi.fn<(...args: unknown[]) => Promise<AddCoPresenterResult>>(async () => ({ ok: true }));

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { eventId: "evt-1", eventName: "Arbitrary Con", welcomeMessage: null, accentColor: null, logoUrl: null },
      submissions: [],
      tasks: [],
      contactName: "Jane Speaker",
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
    getMyResources: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return { ...actual, listFields: vi.fn(async () => []) };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (): Promise<EditableSubmissionData | null> => DATA),
    getPortalParticipants: vi.fn(async () => [EXISTING_PARTICIPANT]),
    getAllSubmissionParticipants: vi.fn(async () => [EXISTING_PARTICIPANT]),
    addCoPresenter: (...args: unknown[]) => addCoPresenterMock(...args),
  };
});

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  const profile: ContactProfile = {
    id: "ct-1",
    firstName: "Jane",
    lastName: "Speaker",
    title: null,
    company: null,
    bio: null,
    headshotUrl: null,
    socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
  };
  return { ...actual, getContactProfile: vi.fn(async () => profile) };
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

describe('"Portal · Edit your session" 390 (docs/design/Chautauqua Public and Portal.dc.html:600-674 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0;`)', () => {
  it("GET /portal/submissions/s1/edit renders drawn literals in drawn order", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();

    // :602 -- back link, 44px floor
    verbatimLine(602, "‹ Your session");
    verbatimLine(602, "min-height:44px");
    const backIdx = html.indexOf("‹ Your session");
    expect(backIdx).toBeGreaterThan(-1);

    // :603 -- H1
    verbatimLine(603, "Edit your session");
    const h1Idx = html.indexOf('<h1 class="chq-portal-hero chq-portal-hero-drill">Edit your session</h1>');
    expect(h1Idx).toBeGreaterThan(backIdx);

    // :604 -- close-date sub line, graded by SHAPE (the date itself is
    // composed from form.closeDate/timezone, never a fixed frame literal).
    verbatimLine(604, "You can change this until the form closes on");
    const subIdx = html.indexOf("You can change this until the form closes on");
    expect(subIdx).toBeGreaterThan(h1Idx);

    // :624 -- "On this session · <n>" section rule. The frame's sample "· 1"
    // is SAMPLE DATA (this fixture seeds one participant so the count also
    // happens to read 1, but the assertion below is on the label + a live
    // count, not the frame's literal digit).
    verbatimLine(624, "On this session");
    const sectionIdx = html.indexOf("On this session");
    expect(sectionIdx).toBeGreaterThan(subIdx);
    expect(html).toContain('<span class="chq-portal-session-count">1</span>');

    // :628/:629/:631 -- participant row, graded by SHAPE (name/role/note are
    // `{{ }}` template bindings, never fixed frame text). This fixture's
    // seeded participant surfaces as one live row.
    const rowIdx = html.indexOf('<li class="chq-portal-participant-row">');
    expect(rowIdx).toBeGreaterThan(sectionIdx);
    expect(html.indexOf("Priya Raman", rowIdx)).toBeGreaterThan(rowIdx);
    expect(html.indexOf("Speaker", rowIdx)).toBeGreaterThan(rowIdx);

    // :638 -- "Add a co-presenter" section head
    verbatimLine(638, "Add a co-presenter");
    const addHeadIdx = html.indexOf("Add a co-presenter");
    expect(addHeadIdx).toBeGreaterThan(rowIdx);

    // :640 -- the co-presenter add row's caption. The app's truthful
    // sentence IS the drawn text: asserted verbatim (byte-checked against
    // the frame line by verbatimLine above).
    const CAPTION =
      "Adding them puts a row in the list above straight away. No email goes to them — tell them yourself, and your organiser decides when co-presenters appear on the public site.";
    verbatimLine(640, CAPTION);
    expect(html).toContain(CAPTION);
    const captionIdx = html.indexOf("Adding them puts a row in the list above straight away");
    expect(captionIdx).toBeGreaterThan(addHeadIdx);

    // :664 -- "Add co-presenter" button, DEC-029 structural guarantee: a
    // SECOND SUBMIT of #chq-portal-edit-form via formaction/formenctype, not
    // a second form -- so in-progress title/abstract/track edits ride along
    // instead of being discarded.
    verbatimLine(664, "Add co-presenter");
    const addBtnMatch = html.match(
      /<button type="submit" form="chq-portal-edit-form" formaction="\/portal\/submissions\/s1\/participants" formenctype="multipart\/form-data" class="chq-btn chq-btn-secondary">Add co-presenter<\/button>/,
    );
    expect(addBtnMatch, "expected the Add co-presenter button to be a formaction second submit of #chq-portal-edit-form").not.toBeNull();
    expect(html.indexOf(addBtnMatch![0])).toBeGreaterThan(captionIdx);

    // Every co-presenter control carries form="chq-portal-edit-form" (DEC-029):
    // no control below the caption spawns a second <form>.
    expect(html).not.toMatch(/<form[^>]*id="(?!chq-portal-edit-form)/);
    for (const inputId of ["cp-first-name", "cp-last-name", "cp-email", "cp-role"]) {
      const idIdx = html.indexOf(`id="${inputId}"`);
      expect(idIdx, `expected #${inputId} to exist`).toBeGreaterThan(-1);
      expect(html.slice(idIdx, idIdx + 400)).toContain('form="chq-portal-edit-form"');
    }

    // :669/:670/:672 -- the phone dock: Save changes leads, Cancel follows,
    // then the consequence note below the pair (DEC-576).
    verbatimLine(669, "Save changes");
    verbatimLine(670, "Cancel");
    verbatimLine(672, "Title and abstract show on the public pages · co-presenters do not");
    const dockMatch = html.match(/<div class="chq-portal-edit-dock">.*?<\/div>\s*<\/div>/s);
    expect(dockMatch).not.toBeNull();
    const dockHtml = dockMatch![0];
    const saveIdx = dockHtml.indexOf("Save changes");
    const cancelIdx = dockHtml.indexOf(">Cancel<");
    const noteIdx = dockHtml.indexOf("Title and abstract show on the public pages · co-presenters do not");
    expect(saveIdx).toBeGreaterThan(-1);
    expect(cancelIdx).toBeGreaterThan(saveIdx);
    expect(noteIdx).toBeGreaterThan(cancelIdx);
  });
});

describe('"Portal · co-presenter rejected" 390', () => {
  it("POST /portal/submissions/s1/participants with a duplicate email renders the DEC-029 three-part refusal disclosure at 400, edits preserved", async () => {
    addCoPresenterMock.mockResolvedValueOnce({
      ok: false,
      errors: { email: "This person is already a participant on this submission" },
    });
    const app = await buildApp();
    const params = new URLSearchParams();
    params.append("chq_csrf", "test-csrf-token");
    // DEC-029 structural guarantee under test: an in-progress edit to a
    // field OTHER than the co-presenter block rides along on this second
    // submit and must be echoed back on the 400 re-render, not discarded.
    params.append("field__first_name", "Edited Live");
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

    // DEC-029 (wave-108 amendment, edit.tsx): a refusal re-renders the edit
    // page directly at 400 -- never a redirect, which would discard the
    // speaker's unsaved typing.
    // docs/design/Chautauqua Public and Portal.dc.html:1304-1367 `<div
    // style="width:390px; height:844px; background:#F4F1E8;` -- the
    // co-presenter-rejected frame extent this file grades.
    expect(res.status).toBe(400);
    const html = await res.text();

    // Part 1 -- the callout, headed "Nobody was added" (:1313), naming WHO
    // is already on the session and stating everything typed is still
    // below (:1314).
    verbatimLine(1313, "Nobody was added");
    verbatimLine(1314, "is already on this session. Everything you typed is still below.");
    const calloutMatch = html.match(/<div class="chq-error-summary chq-portal-copresenter-notice" role="alert">.*?<\/div>/s);
    expect(calloutMatch, "expected the refusal callout").not.toBeNull();
    const calloutHtml = calloutMatch![0];
    expect(calloutHtml).toContain("Nobody was added");
    // named by the matched participant, never a generic "This person"
    // (DEC-967: the frame's sample "Priya" is SHAPE, the app's own
    // resolved match is the assertable fact).
    expect(calloutHtml).toContain("Priya Raman is already on this session. Everything you typed is still below.");

    // Part 2 -- the email field marked at its own left edge (the flagged
    // class portal.css.ts paints border-left on, read-only per this task's
    // ban on portal.css.ts).
    const emailIdx = html.indexOf('id="cp-email"');
    expect(emailIdx).toBeGreaterThan(-1);
    expect(html.slice(emailIdx, emailIdx + 200)).toContain("chq-portal-copresenter-email-flagged");

    // Part 3 -- the field-level sentence beneath it (:1349's server text,
    // routed as a real field error, not fabricated a second time).
    const fieldErrorMatch = html.slice(emailIdx).match(/<p role="alert" class="chq-field-error">\s*([^<]*)<\/p>/);
    expect(fieldErrorMatch, "expected a field-level error beneath the email field").not.toBeNull();
    expect(fieldErrorMatch![1]!.trim()).toBe("This person is already a participant on this submission");

    // DEC-029 structural guarantee that makes the promise true: every
    // co-presenter control still carries form="chq-portal-edit-form", and
    // Add co-presenter is still a formaction second submit -- unchanged on
    // the refusal re-render, same as the plain edit frame.
    const addBtnMatch = html.match(
      /<button type="submit" form="chq-portal-edit-form" formaction="\/portal\/submissions\/s1\/participants" formenctype="multipart\/form-data" class="chq-btn chq-btn-secondary">Add co-presenter<\/button>/,
    );
    expect(addBtnMatch).not.toBeNull();

    // And the guarantee's actual payoff: the in-progress title/abstract
    // edit posted alongside this submit (field_first_name) survives the
    // refusal instead of being discarded by a redirect.
    expect(html).toContain('value="Edited Live"');

    // :1362/:1363 -- the same edit-dock band (Save changes/Cancel), present
    // on the refusal re-render too.
    verbatimLine(1362, "Save changes");
    verbatimLine(1363, "Cancel");
    expect(html).toContain('<div class="chq-portal-edit-dock">');
    const dockMatch = html.match(/<div class="chq-portal-edit-dock">.*?<\/div>\s*<\/div>/s);
    expect(dockMatch).not.toBeNull();
    expect(dockMatch![0].indexOf("Save changes")).toBeLessThan(dockMatch![0].indexOf(">Cancel<"));
  });
});
