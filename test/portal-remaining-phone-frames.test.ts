// v12m-w5-a: Portal's last two 390 frames (DEC-029 wave-87 amendment) --
// "Portal · Resources" (docs/design/Chautauqua Public and Portal.dc.html:1561)
// `width:390px; height:844px` -- v9-f (DEC-976 wave-91) receipt below.
it("v9-f receipt: frame container (:1561) is the standard 390x844 phone card", () => {
  expect(dcLine(1561)).toContain("width:390px; height:844px");
});
// and "Portal · co-presenter rejected" (:1304). Each assertion below cites
// the exact dc.html line it pins, quotes that line's literal verbatim, and
// asserts what the literal declares -- either against the rendered SSR
// markup (src/routes/portal/tasks/views.tsx's ResourcesPage,
// src/routes/portal/edit.tsx's ParticipantsSection via EditPage) or against
// the ONE new `@media (max-width: 700px)` block this task appended to the
// end of src/routes/portal/portal.css.ts (the existing phone block near
// :444 is untouched -- v12m-w3-a/-b own it).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ResourcesPage } from "../src/routes/portal/tasks/views";
import { EditPage } from "../src/routes/portal/edit";
import { CO_PRESENTER_DUPLICATE_MESSAGE } from "../src/server/repo/portal-edit";
import type { PortalParticipant, EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { PortalResourceGroup } from "../src/server/repo/portal/resources";

const REPO_ROOT = join(__dirname, "..");
const DC_HTML = readFileSync(
  join(REPO_ROOT, "docs/design/Chautauqua Public and Portal.dc.html"),
  "utf-8",
).split("\n");
// dc.html lines are reported 1-based; array is 0-based.
const dcLine = (n: number) => DC_HTML[n - 1];

const PORTAL_CSS_TS = readFileSync(join(REPO_ROOT, "src/routes/portal/portal.css.ts"), "utf-8");

/** The one new block this task appended at the very end of the exported
 * template string -- isolated so every assertion below is provably reading
 * NEW growth, never the frozen/mid-rewrite block near :444. */
function appendedPhoneBlock(): string {
  const marker = "/* v12m-w5-a: Portal's last two 390 frames";
  const idx = PORTAL_CSS_TS.indexOf(marker);
  expect(idx, "expected the v12m-w5-a append marker in portal.css.ts").toBeGreaterThan(-1);
  return PORTAL_CSS_TS.slice(idx);
}
const APPENDED = appendedPhoneBlock();

const BRANDING = { eventName: "Arbitrary Con", welcomeMessage: null, accentColor: null, logoUrl: null };

// ---------------------------------------------------------------------------
// "Portal · Resources" (frame extent docs/design/...html:1561-1583)
// ---------------------------------------------------------------------------
describe('"Portal · Resources" 390 frame (docs/design/Chautauqua Public and Portal.dc.html:1561)', () => {
  // `width:390px; height:844px` -- the standard phone-frame card this
  // describe block's whole extent is drawn inside.
  it("frame container (:1561) is the standard 390x844 phone card, and the tree actually gives this page phone-card treatment", () => {
    expect(dcLine(1561)).toContain("width:390px; height:844px");
    // The frame's citation is not self-proving (DEC-967) -- assert the
    // rendered page is the exact shell the appended @media (max-width:700px)
    // block conditions its phone geometry on, so this frame's 390 width
    // maps onto a real, narrower-than-700 override in the tree.
    expect(html).toContain('class="chq-portal-shell"');
    expect(APPENDED).toContain("@media (max-width: 700px)");
    expect(APPENDED).toMatch(/\.chq-portal-shell\b/);
  });

  const groups: PortalResourceGroup[] = [
    {
      eventId: "evt-1",
      eventName: "Arbitrary Con",
      resources: [{ id: "res-1", kind: "file", title: "Speaker deck template", content: null, fileId: "file-1" }],
    },
  ];
  const html = ResourcesPage({ branding: BRANDING, groups, csrfToken: "tok", speakerName: "Priya Raman" }).toString();

  it("back link (:1563) reads '‹ Your portal'", () => {
    const line = dcLine(1563);
    expect(line).toContain('‹ Your portal');
    expect(html).toContain("Your portal");
  });

  it("H1 (:1564) is a 25px back-linked drill, not the 27px cluster-landing token", () => {
    const line = dcLine(1564);
    expect(line).toContain('font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05');
    expect(html).toContain('class="chq-portal-hero chq-portal-resources-hero"');
    expect(APPENDED).toMatch(
      /\.chq-portal-resources-hero\s*\{\s*font-size:\s*var\(--chq-type-page-title-phone-drill\);\s*\}/,
    );
  });

  it("subtitle (:1565) states the shared, not-about-your-session fact -- absent from the app before this task", () => {
    const line = dcLine(1565);
    expect(line).toContain("The same for every speaker · nothing here is about your session");
    expect(html).toContain("The same for every speaker · nothing here is about your session");
  });

  it("row control (:1575) is labelled 'Open', not 'Download', and floors at 44px in the appended block", () => {
    const line = dcLine(1575);
    expect(line).toContain('min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600; flex-shrink:0">Open<');
    expect(html).toContain(">Open</a>");
    expect(html).not.toContain(">Download</a>");
    expect(APPENDED).toMatch(
      /\.chq-portal-resource-row \.chq-portal-actions \.chq-btn\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*0 14px;[^}]*font-size:\s*13px;[^}]*font-weight:\s*600;/,
    );
  });

  it("docked footer (:1580/:1581) carries the reply-to-any-email note through PortalLayout's footerExtra slot", () => {
    const dockLine = dcLine(1580);
    const noteLine = dcLine(1581);
    expect(dockLine).toContain("border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px");
    expect(noteLine).toContain("Questions? Reply to any of our emails.");
    expect(html).toContain('class="chq-portal-resources-footer-note"');
    expect(html).toContain("Questions? Reply to any of our emails.");
    // the docked container itself (.chq-portal-footer border-top/background/
    // padding) is the pre-existing shared shell footer near :444 -- frozen,
    // not re-asserted here; only this note's own presence/placement is new.
  });

  it("zero-state (unclaimed elsewhere) never renders the row/footer markup", () => {
    const empty = ResourcesPage({ branding: BRANDING, groups: [], csrfToken: "tok", speakerName: "Priya Raman" }).toString();
    expect(empty).toContain("No resources yet.");
    expect(empty).not.toContain(">Open</a>");
  });
});

// ---------------------------------------------------------------------------
// "Portal · co-presenter rejected" (frame extent docs/design/...html:1304-1372)
// ---------------------------------------------------------------------------
describe('"Portal · co-presenter rejected" 390 frame (docs/design/Chautauqua Public and Portal.dc.html:1304)', () => {
  // `width:390px; height:844px` -- the standard phone-frame card this
  // describe block's whole extent is drawn inside.
  it("frame container (:1304) is the standard 390x844 phone card, and the tree actually gives this page phone-card treatment", () => {
    expect(dcLine(1304)).toContain("width:390px; height:844px");
    // Same real-tree check as the Resources frame above: the rendered edit
    // page is the exact shell the appended @media (max-width:700px) block
    // conditions its phone geometry on.
    expect(html).toContain('class="chq-portal-shell"');
    expect(APPENDED).toContain("@media (max-width: 700px)");
    expect(APPENDED).toMatch(/\.chq-portal-shell\b/);
  });

  const participants: PortalParticipant[] = [
    { id: "p-1", contactId: "ct-2", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
  ];
  const DATA: EditableSubmissionData = {
    submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
    form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
    fields: [],
    answers: {},
    offeredTrackIds: [],
    allTracks: [],
    selectedTrackIds: [],
  };
  const html = EditPage({
    branding: BRANDING,
    submissionId: "s1",
    data: DATA,
    answers: {},
    selectedTrackIds: [],
    csrfToken: "tok",
    editable: true,
    tracksEditable: true,
    participants,
    speakerName: "Priya Raman",
    participantErrors: { email: CO_PRESENTER_DUPLICATE_MESSAGE },
    participantValues: { firstName: "Priya", lastName: "Raman", email: "priya@example.com", role: "moderator" },
  }).toString();

  it("callout body (:1314) names the person already on the session and states typed values survived", () => {
    const line = dcLine(1314);
    expect(line).toContain("Priya is already on this session. Everything you typed is still below.");
    expect(html).toContain("Priya Raman is already on this session. Everything you typed is still below.");
  });

  it("callout head (:1313) reads 'Nobody was added'", () => {
    const line = dcLine(1313);
    expect(line).toContain('font-size:14px; font-weight:700; line-height:1.4">Nobody was added<');
    expect(html).toContain("<h2>Nobody was added</h2>");
  });

  it("callout box (:1312) is border-left:4px, radius 5px, tinted background -- a modifier beside the frozen .chq-error-summary class, never redefining it", () => {
    const line = dcLine(1312);
    expect(line).toContain("border:1px solid #1B1D17; border-left:4px solid #1B1D17; border-radius:5px; background:#EFEBDF; padding:14px 16px");
    expect(html).toContain('class="chq-error-summary chq-portal-copresenter-notice"');
    expect(APPENDED).toMatch(
      /\.chq-portal-copresenter-notice\s*\{[^}]*border-left:\s*4px solid var\(--chq-ink\);[^}]*border-radius:\s*5px;[^}]*background:\s*var\(--chq-surface-sunk\);[^}]*padding:\s*14px 16px;/,
    );
  });

  it("email field (:1348) takes a 3px left rule when it's the rejected field", () => {
    const line = dcLine(1348);
    expect(line).toContain("border:1px solid #1B1D17; border-left:3px solid #1B1D17");
    expect(html).toContain('class="chq-input chq-portal-copresenter-email-flagged"');
    expect(APPENDED).toMatch(/\.chq-portal-copresenter-email-flagged\s*\{\s*border-left:\s*3px solid var\(--chq-ink\);\s*\}/);
  });

  it("field sentence (:1349) still renders the server's own duplicate message, unchanged -- server text untouched", () => {
    const line = dcLine(1349);
    expect(line).toContain("This person is already a participant on this submission.");
    expect(html).toContain(CO_PRESENTER_DUPLICATE_MESSAGE);
  });

  it("name grid (:1335) goes two-up at 10px gap on phone, overriding the desktop flex-wrap technique", () => {
    const line = dcLine(1335);
    expect(line).toContain("display:grid; grid-template-columns:1fr 1fr; gap:10px");
    expect(APPENDED).toMatch(
      /\.chq-portal-copresenter-names\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*1fr 1fr;\s*gap:\s*10px;\s*\}/,
    );
  });

  it("fields (:1338) reach the frame's 48px floor on phone, one step above the shared 46px", () => {
    const line = dcLine(1338);
    expect(line).toContain("min-height:48px");
    expect(APPENDED).toMatch(
      /\.chq-portal-copresenter-names \.chq-input,\s*\n\s*\.chq-portal-copresenter-email-role \.chq-input,\s*\n\s*\.chq-portal-copresenter-role select\s*\{\s*min-height:\s*48px;\s*\}/,
    );
  });

  it("ordinary field-validation errors never trigger the duplicate callout (unchanged gating)", () => {
    const plain = EditPage({
      branding: BRANDING,
      submissionId: "s1",
      data: DATA,
      answers: {},
      selectedTrackIds: [],
      csrfToken: "tok",
      editable: true,
      tracksEditable: true,
      participants,
      speakerName: "Priya Raman",
      participantErrors: { firstName: "First name is required" },
    }).toString();
    // Not a bare substring check: "Nobody was added" also appears once in
    // this task's own portal.css.ts comment, inlined into every page via
    // PortalLayout's <style>. The actual gate is the notice element itself.
    expect(plain).not.toContain("<h2>Nobody was added</h2>");
  });
});
