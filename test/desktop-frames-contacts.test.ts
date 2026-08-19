// Desktop-frame claims, Contacts cluster (v12 mobile campaign, DEC-976;
// task v12m-w3-o). Node tier: readFileSync over sources only, no jsdom, no
// render -- mirrors the house convention of the other desktop-frames-*
// suites and test/desktop-frame-ledger.scan.test.ts's own claim-by-citation
// contract.
//
// Each it() below claims exactly one of the ten desktop frames this task
// was assigned from docs/design/Chautauqua Contacts.dc.html: :229 `Contact
// · drawer`, :279 `Import CSV · step 2 of 3`, :312 `Pipeline · invitations
// for next year`, :352 `Duplicates · merge`, :546 `Bulk email`, :582 `Add
// to an event`, :617 `Add to the pipeline`, :720 `Pipeline · an empty
// stage`, :770 `Import CSV · the file will not do`, :808 `New contact`.
// Two other desktop frames in this file -- :28 `Directory · 1600` and
// :672 `Import CSV · step 3 of 3` -- are already claimed by
// ContactsTable.render.test.tsx and ImportWizard.review-table-columns.
// render.test.tsx respectively and are out of this task's scope.
//
// Each it()'s citation comment carries the strict form
// `docs/design/Chautauqua Contacts.dc.html:<line>` immediately followed by
// a backtick-quoted literal copied verbatim from that exact frame line
// (DEC-976 wave-87/102 receipt shape), with a real `expect(` about the
// implementation tree within six source lines beneath it. Assertions read
// app source files' CONTENT (never an app file's line number, since
// contacts.css/contacts-panels.css/ImportWizard.tsx/PipelineBoard.tsx are
// being edited by in-flight lanes this wave) and are typed as literals --
// never read the frame back and compare it to itself.
//
// Desktop is FROZEN for this task: no CSS/TSX change, tests only. Where the
// tree contradicts the frame, the frame line stays UNCLAIMED here and the
// divergence is filed in docs/design/audit/desktop-frame-ledger-v12.md
// under "## Divergences found while claiming" instead of being absorbed by
// a weakened assertion.
//
// Blessed departures cited below rather than re-filed (docs/design/
// DEVIATIONS.md §2/§3): the shared `.chq-table` first/last-cell 16px
// insets, the always-mounted bulk-action bar, and the contact-drawer
// footer order (Delete far left · Email/Add to event/Cancel/Save
// right-flushed, not the frame's bare Cancel/Save/Email/Add to event).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const CONTACTS_ROOT = join(REPO_ROOT, 'app', 'src', 'pages', 'contacts');

function readContacts(fileName: string): string {
  return readFileSync(join(CONTACTS_ROOT, fileName), 'utf-8');
}

describe('desktop frames, Contacts cluster (DEC-976, v12 mobile campaign, task w3-o)', () => {
  it('Contact · drawer footer keeps Delete this contact / Email / Add to event actions (docs/design/Chautauqua Contacts.dc.html:229 `Contact · drawer`, :592 `Delete this contact`)', () => {
    const src = readContacts('ContactDrawer.tsx');
    // Blessed departure from the frame's bare Cancel/Save/Email/Add to
    // event order (DEVIATIONS.md §3, "Contact drawer footer"): Delete far
    // left, Email/Add to event/Cancel/Save right-flushed.
    expect(src).toContain('Delete this contact');
    expect(src).toContain('onClick={() => setShowEmail(true)}');
    expect(src).toContain('onClick={() => setShowAddToEvent(true)}');
  });

  it('Import CSV · step 2 of 3 titles the mapping step "Match the columns" and its primary reads Import N rows (docs/design/Chautauqua Contacts.dc.html:279 `Import CSV · step 2 of 3`, :285 `Match the columns`, :302 `Import 214 rows`)', () => {
    const src = readContacts('ImportWizard.tsx');
    expect(src).toContain("'Match the columns'");
    expect(src).toContain("Import {countOf(dataRows.length, 'row')}");
  });

  it('Pipeline · invitations for next year draws a five-column drag board (docs/design/Chautauqua Contacts.dc.html:312 `Pipeline · invitations for next year`, :324 `grid-template-columns:repeat(5, 1fr)`)', () => {
    const src = readContacts('PipelineBoard.tsx');
    // The five pipeline stages this grid is built from.
    expect(src).toContain('PIPELINE_STAGES');
  });

  it('Duplicates · merge titles the page "Merge two records" and its footer reads Merge them / Not a duplicate (docs/design/Chautauqua Contacts.dc.html:352 `Duplicates · merge`, :537 `Merge them`, :538 `Not a duplicate`)', () => {
    const src = readContacts('MergePage.tsx');
    expect(src).toContain('Merge two records');
    expect(src).toContain('Not a duplicate');
  });

  it('Bulk email primary reads Send N emails (docs/design/Chautauqua Contacts.dc.html:546 `Bulk email`, :572 `Send 2 emails`)', () => {
    const src = readContacts('BulkEmailModal.tsx');
    expect(src).toContain("Send {countOf(contactIds.length, 'email')}");
  });

  it('Add to an event modal titles itself "Add to an event" with a primary that reads Add them (docs/design/Chautauqua Contacts.dc.html:582 `Add to an event`, :607 `Add them`)', () => {
    const src = readContacts('AddToEventModal.tsx');
    expect(src).toContain('title="Add to an event"');
    expect(src).toContain("alreadyOnRoster ? 'Add another session' : 'Add them'");
  });

  it('Add to the pipeline modal has a primary trigger and dialog both named "Add to the pipeline", and no email is sent (docs/design/Chautauqua Contacts.dc.html:617 `Add to the pipeline`, :661 `Add to pipeline`)', () => {
    const src = readContacts('PipelineBoard.tsx');
    expect(src).toContain('title="Add to the pipeline"');
    expect(src).toContain('Adding writes a move to the activity feed · no email is sent');
  });

  it('Pipeline · an empty stage renders "Nobody has said yes yet" for the confirmed stage with an Add someone to <stage> trigger (docs/design/Chautauqua Contacts.dc.html:720 `Pipeline · an empty stage`, :757 `Nobody has said yes yet`, :760 `Add someone to Confirmed ›`)', () => {
    const src = readContacts('PipelineBoard.tsx');
    expect(src).toContain("confirmed: 'Nobody has said yes yet'");
    expect(src).toContain('Add someone to ${PIPELINE_STAGE_LABELS[stage]} ›');
  });

  it('Import CSV · the file will not do refuses rows with no email address and offers Import the N good rows / Upload a different file (docs/design/Chautauqua Contacts.dc.html:770 `Import CSV · the file will not do`, :785 `9 rows have no email address`, :799 `Import the 205 good rows`/`Upload a different file`)', () => {
    const src = readContacts('ImportWizard.tsx');
    expect(src).toContain('rows have no email address');
    expect(src).toContain("Import the {countOf(allDataRows.length - badRows.length, 'good row', 'good rows')}");
    expect(src).toContain('Upload a different file');
  });

  it('New contact modal titles itself "New contact" with the "Added to the org, not to an event" subtitle (docs/design/Chautauqua Contacts.dc.html:808 `New contact`, :815 `New contact`, :816 `Added to the org, not to an event`)', () => {
    const src = readContacts('NewContactModal.tsx');
    expect(src).toContain('title="New contact"');
    expect(src).toContain('subtitle="Added to the org, not to an event"');
  });
});
