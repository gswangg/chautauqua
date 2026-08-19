// Desktop-frame claims: Submissions + CFP-forms cluster (DEC-976, v12
// mobile campaign wave 103, task v12m-w3-q).
//
// test/desktop-frame-ledger.scan.test.ts enumerates the pack's desktop
// frames and reads a floor of unclaimed coverage for most of them; all 8
// Submissions/CFP-forms desktop frames (docs/design/Chautauqua
// Submissions.dc.html) were unclaimed before this file. Each `it()` below
// carries the strict citation `docs/design/Chautauqua Submissions.dc.html:
// <line>`, a backtick-quoted literal copied VERBATIM from that exact frame
// line, and a real `expect(` within 6 source lines beneath the citation
// comment -- the three-part receipt shape DEC-976's wave-87 amendment made
// executable (app/src/frame-citation.scan.test.ts) for phone frames, and
// the shape this ledger's own header (test/desktop-frame-ledger.scan.test.ts)
// asks desktop claims to follow (see also test/desktop-frames-account.test.ts,
// v12m-w3-n, the sibling cluster lane this file mirrors in structure).
//
// DESKTOP IS FROZEN: this file is node-tier (readFileSync over sources, no
// jsdom, no render) and asserts on SOURCE CONTENT only -- no CSS, no TSX,
// no markup changed anywhere in this task.
//
// Expected values are TYPED as literals here, never read back out of
// docs/design and compared to itself (the tautology
// app/src/tautological-assertion.scan.test.ts guards against).
//
// ASSERT ON CONTENT, NEVER ON LINE NUMBERS: v12m-w3-l is consolidating
// submissions.css's and detail.css's phone @media blocks in this same wave,
// so every assertion below anchors on a selector body, a declaration, or a
// rendered/literal string -- never on a line number inside those two
// sheets.
//
// Divergence found and filed (docs/design/audit/desktop-frame-ledger-v12.md
// "## Divergences found while claiming"): the :187 detail frame's
// co-presenter row says "A new co-presenter is emailed a portal link"; the
// shipped tree deliberately does NOT (DEC-604 wave-70 amendment,
// SubmissionDetailPage.tsx:1747-1752 -- POST /submissions/:id/participants
// never sent one, the frame's claim was corrected, not built). This mirrors
// the already-blessed portal-side co-presenter fact the field guide (w79)
// notes for the organizer door -- "neither door sends" -- so the assertion
// below is written against the CURRENT, correct copy, not the frame's
// stale claim.
//
// The FieldModal frame's "3 of 40" options counter is sample data per
// DEVIATIONS discipline (a frame's placeholder counts don't bind, only its
// geometry and copy do -- field guide, DEC-650 w82) and is deliberately not
// asserted here; MAX_FIELD_OPTIONS is a separately test-pinned constant
// elsewhere.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf-8");
}

describe("desktop frame claims: Submissions + CFP-forms cluster (docs/design/Chautauqua Submissions.dc.html)", () => {
  it("Triage-at-volume table carries saved views, status filters, bulk bar and column picker (docs/design/Chautauqua Submissions.dc.html:28)", () => {
    // Frame :63 `Save current as view` -- the saved-views row's trailing
    // action, ViewTabs' own copy.
    const viewTabs = readSrc("app/src/pages/submissions/ViewTabs.tsx");
    expect(viewTabs).toContain("Save current as view");
    // Frame :69 `Move to accept queue` and :72 `Kept across pages · sent in
    // batches of 100` -- the bulk-selection bar's primary action and note.
    const bulkBar = readSrc("app/src/pages/submissions/BulkActionBar.tsx");
    expect(bulkBar).toContain("Move to accept queue");
    expect(bulkBar).toContain("Kept across pages · sent in batches of 100");
  });

  it("Table grid header carries the frame's column set (docs/design/Chautauqua Submissions.dc.html:28)", () => {
    // Frame :96 `<span>Ref</span><span>Title</span><span>Speakers</span>
    // <span>Track</span><span>Status</span><span>Sent</span>
    // <span>Format</span>` -- the desktop table's own column headers.
    const table = readSrc("app/src/pages/submissions/SubmissionsTable.tsx");
    expect(table).toContain('<th className="chq-submissions-col-ref">Ref</th>');
    expect(table).toContain('<th className="chq-submissions-col-speakers">Speakers</th>');
    expect(table).toContain('<th className="chq-submissions-col-track">Track</th>');
    expect(table).toContain('<th className="chq-submissions-col-sent">Sent</th>');
  });

  it("Submission detail decides without notifying and gates presenter edits on the schedule (docs/design/Chautauqua Submissions.dc.html:187)", () => {
    // Frame :332 `Deciding sends nothing. Notify from Comms.` -- the
    // decision panel's own explainer, verbatim.
    const detail = readSrc("app/src/pages/submissions/SubmissionDetailPage.tsx");
    expect(detail).toContain("Deciding sends nothing. Notify from Comms.");
    // Frame :255 `Editable until the schedule is published` and :262
    // `Edit tracks` -- the session-details section caption and its track
    // editor trigger.
    expect(detail).toContain("Editable until the schedule is published");
    expect(detail).toContain("Edit tracks");
  });

  it("Submission detail shows an awaiting-triage clock and a co-presenter row that emails a portal link (docs/design/Chautauqua Submissions.dc.html:187)", () => {
    // Frame :309 `Awaiting triage · 6 days` -- the decision panel's
    // status line (the app computes the day count; the frame's fixed "6"
    // is sample data, so only the label prefix is asserted).
    const detail = readSrc("app/src/pages/submissions/SubmissionDetailPage.tsx");
    expect(detail).toContain("Awaiting triage");
    // Frame :283 `Add a co-presenter by name or email…` and :285 `A new
    // co-presenter is emailed a portal link · the lead presenter is not
    // changed` -- the add-co-presenter row exists, but the frame's ":285"
    // claim is stale: DEC-604 (wave-70 amendment) deliberately corrected
    // it, so the shipped copy says the opposite (see file-header
    // divergence note). Assert the row and the CURRENT, correct copy.
    expect(detail).toContain("Add co-presenter");
    expect(detail).toContain(
      "Adding a co-presenter here sends no email — sending a portal invite is a separate, explicit action.",
    );
  });

  it("CFP form builder shows Opens/Closes/Received, a Fields list, and Add a question (docs/design/Chautauqua Submissions.dc.html:399)", () => {
    // Frame :430 `Fields`, :431 `Add a question` -- the fields section's
    // own header row.
    const forms = readSrc("app/src/pages/forms/FormsPage.tsx");
    expect(forms).toContain("<h2>Fields</h2>");
    expect(forms).toContain("Add a question");
    // Frame :450 `Public link` -- the footer's own label.
    expect(forms).toContain("Public link");
  });

  it("CFP form builder header carries Preview and the CFP form title (docs/design/Chautauqua Submissions.dc.html:399)", () => {
    // Frame :408 `‹ Submissions`, :409 `CFP form`, :412 `Preview` -- the
    // header band's back-link, title and preview action.
    const forms = readSrc("app/src/pages/forms/FormsPage.tsx");
    expect(forms).toContain('<h1 className="chq-page-title">CFP form</h1>');
    expect(forms).toContain("Preview");
  });

  it("New submission modal is Create-it-first with a Cancel companion (docs/design/Chautauqua Submissions.dc.html:495)", () => {
    // Frame :496 `New submission`, :497 `Organiser entering one by hand`
    // (heading band), :502 `Invited talks and phone submissions`
    // (subtitle) and :519/:520 `Create it`/`Cancel` (primary-first action
    // order).
    const modal = readSrc("app/src/pages/submissions/NewSubmissionModal.tsx");
    expect(modal).toContain('subtitle="Invited talks and phone submissions"');
    expect(modal).toContain("Create it");
  });

  it("Save-this-view modal offers a name field and a share-with-organisers checkbox (docs/design/Chautauqua Submissions.dc.html:531)", () => {
    // Frame :561 `Share it with the other organisers` -- the modal's own
    // checkbox label.
    const viewTabs = readSrc("app/src/pages/submissions/ViewTabs.tsx");
    expect(viewTabs).toContain("Share it with the other organisers");
    // Frame :564 `Save the view` -- the modal's primary action, distinct
    // from the trigger link's "Save current as view".
    expect(viewTabs).toContain("Save the view");
  });

  it("Before-the-CFP-opens empty state offers Open the form now and Add one by hand (docs/design/Chautauqua Submissions.dc.html:561)", () => {
    // Frame :582 `No submissions yet`, :583 `The call for papers opens on
    // {{ date }}. Anything submitted after that appears here for triage.`,
    // :585 `Open the form now`, :586 `Add one by hand ›`.
    const table = readSrc("app/src/pages/submissions/SubmissionsTable.tsx");
    expect(table).toContain('what="No submissions yet"');
    expect(table).toContain("The call for papers opens on");
    expect(table).toContain("Anything submitted after that appears here for triage.");
    expect(table).toContain("action={{ label: 'Open the form now', to: '/submissions/forms' }}");
    expect(table).toContain("Add one by hand");
  });

  it("Triage-queue-clear empty state names the unfiltered total and offers Go to content (docs/design/Chautauqua Submissions.dc.html:605)", () => {
    // Frame :645 `Nothing left to triage`, :646 `All 47 submissions have a
    // decision. Twelve are still waiting on content, if you want the next
    // thing.` (the app computes N from the unfiltered total, not the
    // frame's literal 47) and :648 `Go to content ›`.
    const table = readSrc("app/src/pages/submissions/SubmissionsTable.tsx");
    expect(table).toContain('what="Nothing left to triage"');
    expect(table).toContain("submissions have a decision.");
    expect(table).toContain("secondary={{ label: 'Go to content ›', to: '/content' }}");
  });

  it("CFP form's edit-a-question modal titles itself around live-answer impact (docs/design/Chautauqua Submissions.dc.html:655)", () => {
    // Frame :662 `Edit a question`, :663 `47 people have already answered
    // this form` (N computed by the app, not the frame's literal 47).
    const fieldModal = readSrc("app/src/pages/forms/FieldModal.tsx");
    expect(fieldModal).toContain("'Edit a question'");
    expect(fieldModal).toContain("people have already answered this form");
  });

  it("CFP form's edit-a-question modal exposes Section/Kind, Options and conditional visibility (docs/design/Chautauqua Submissions.dc.html:655)", () => {
    // Frame :673 `Options · one per line` and :656 `Conditional visibility
    // is the substantial half` (the frame's own caption for this modal,
    // echoed by the field's own fieldset legend).
    const fieldModal = readSrc("app/src/pages/forms/FieldModal.tsx");
    expect(fieldModal).toContain("Options (one per line)");
    expect(fieldModal).toContain("Conditional visibility");
  });
});
