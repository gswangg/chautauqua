// w26-b (DEC-976/DEC-651/DEC-032): the per-frame DESKTOP (1600) render
// verdict for the five Contacts import/bulk-modal frames waves 23/25 did
// NOT claim -- Contacts' 12 desktop frames are covered in two lanes: this
// file owns the import wizard (:279/:672/:770), Bulk email (:546) and Add
// to an event (:582); the remaining 7 (directory rail + drawer family) are
// owned by a sibling lane -- see docs/design/audit/contacts-import-desktop-
// v12.md's own header for the split.
//
// Harness copied verbatim (verbatimLine receipts, console guard,
// mockApi/listEnvelope, MemoryRouter) from the LANDED
// app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx.
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this file renders the real
// route/component, verdicts what the tree actually produces, and files
// divergences in prose -- it moves no byte and edits no component or
// stylesheet, even where a real divergence is found below.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ImportWizard } from './contacts/ImportWizard';
import { BulkEmailModal } from './contacts/BulkEmailModal';
import { AddToEventModal } from './contacts/AddToEventModal';
import { mockApi, listEnvelope } from '../test-utils/mockApi';
import { resetEventsCacheForTests } from '../lib/useCurrentEvent';
import type { ImportPlan } from './contacts/types';
import type { ContactDetail, ContactListItem } from './contacts/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Speakers.desktop-frame-verdicts.
 * render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('v12 Contacts import/bulk-modal DESKTOP (1600) frames: per-frame render verdict receipts (w26-b)', () => {
  // ---------------------------------------------------------------------
  // Frame :279 "Import CSV · step 2 of 3" (Subscreen)
  // ---------------------------------------------------------------------
  describe('frame :279 "Import CSV · step 2 of 3"', () => {
    const CSV = [
      'First Name,Last Name,Email,Company',
      'John,Doe,john@example.com,Acme',
      'Jane,Smith,jane@example.com,Beta',
    ].join('\n');

    async function renderMatchStep() {
      render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
      fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
      await screen.findByLabelText('Map column Email');
    }

    it('DIVERGES: the frame draws ONE escape (a head "Cancel" link) with the primary action and dedupe caption living INSIDE the content; the tree draws TWO escapes (a head "Close" button plus a footer "Cancel" button) with the primary in a separate footer bar', async () => {
      await renderMatchStep();
      // docs/design/Chautauqua Contacts.dc.html:288 -- the frame's ONLY
      // escape for this step is a head-band "Cancel" link (no footer bar
      // is drawn at all; the primary sits in the content, beside the
      // dedupe caption at :302-303).
      verbatimLine(288, '        <a href="#" style="font-size:13px; font-weight:700">Cancel</a>');
      verbatimLine(
        302,
        '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:11px 17px; font-size:14px; font-weight:700">Import 214 rows</span>',
      );
      const head = document.querySelector('.chq-modal-head') as HTMLElement;
      // ModalFrame always renders its own head Close control -- "Close",
      // never the frame's "Cancel" wording -- as this step's ONLY head
      // escape.
      expect(within(head).getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(within(head).queryByText('Cancel')).not.toBeInTheDocument();
      // The tree's primary+"Cancel" pair lives in ModalFrame's OWN footer
      // (.chq-modal-actions), a sibling of the content -- never inline
      // beside the dedupe caption the way the frame draws it.
      const actionsBar = document.querySelector('.chq-modal-actions') as HTMLElement;
      const footerButtons = within(actionsBar).getAllByRole('button').map((b) => b.textContent);
      expect(footerButtons).toEqual(['Import 2 rows', 'Cancel']);
    });

    it('MATCHES: title "Match the columns" and one full-width row per column (name/sample, arrow, target)', async () => {
      await renderMatchStep();
      // docs/design/Chautauqua Contacts.dc.html:285 -- the step's H1/H2.
      verbatimLine(
        285,
        '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.035em; line-height:1">Match the columns</span>',
      );
      expect(screen.getByRole('heading', { name: 'Match the columns' })).toBeInTheDocument();
      // docs/design/Chautauqua Contacts.dc.html:292 -- one grid row per
      // column: name+sample on the left, an arrow, the target select.
      verbatimLine(
        292,
        '          <div style="display:grid; grid-template-columns:1fr 26px 1fr; gap:14px; align-items:center; padding-bottom:12px; border-bottom:1px solid #E1DDCE">',
      );
      const rows = document.querySelectorAll('.chq-contacts-import-column-row');
      expect(rows).toHaveLength(4); // First Name, Last Name, Email, Company
      const firstRow = rows[0] as HTMLElement;
      expect(firstRow.querySelector('.chq-contacts-import-column-header')?.textContent).toBe('First Name');
      expect(firstRow.querySelector('.chq-contacts-import-column-arrow')?.textContent).toBe('→');
      expect(firstRow.querySelector('select')).toBeInTheDocument();
    });

    it('DIVERGES (blessed, DEC-663 wave-108 amendment): the frame\'s dedupe caption reads a plan-sourced "N rows match existing contacts by email" count this step cannot compute yet; the tree ships a differently-worded, truthfully-computed in-file-collision count instead', async () => {
      const DUPE_CSV = [
        'First Name,Last Name,Email,Company',
        'John,Doe,john@example.com,Acme',
        'John,Doe,john@example.com,Acme',
      ].join('\n');
      render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
      fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: DUPE_CSV } });
      await screen.findByLabelText('Map column Email');
      // docs/design/Chautauqua Contacts.dc.html:303 -- the frame's caption,
      // sourced from the dry run's plan (which does not exist at this
      // step).
      verbatimLine(
        303,
        '          <span style="font-size:13px; color:#565A4B">9 rows match existing contacts by email · they will be updated</span>',
      );
      expect(screen.queryByText(/rows match existing contacts by email/)).not.toBeInTheDocument();
      expect(screen.getByText('Same-file email repeat: 1 row · the later row wins')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :672 "Import CSV · step 3 of 3"
  // ---------------------------------------------------------------------
  describe('frame :672 "Import CSV · step 3 of 3"', () => {
    const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme'].join('\n');
    const PLAN: ImportPlan = {
      rows: [
        {
          line: 2,
          email: 'john@example.com',
          action: 'update',
          contactId: 'ct-john',
          overwrites: [{ field: 'company', from: 'OldCo', to: 'Acme' }],
        },
      ],
      created: 0,
      updated: 1,
      skipped: 0,
    };

    async function renderReviewStep() {
      mockApi({ 'POST /api/v1/contacts/import': PLAN });
      render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
      fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
      fireEvent.click(await screen.findByRole('button', { name: 'Import 1 row' }));
      await screen.findByText('0 new · 1 updated');
    }

    it('DIVERGES: the frame draws this step as a chromeless 1600px full-width surface (badge "1600", not "Modal"/"Subscreen") with no head-band escape at all; the tree keeps it inside the SAME 640px ModalFrame dialog (scrim, "Close" head button, footer actions bar) as every other step', async () => {
      await renderReviewStep();
      // docs/design/Chautauqua Contacts.dc.html:719 -- the step's own
      // section badge reads "1600" (a full-page-width state), unlike
      // :279's "Subscreen"/:546's "Modal" badges above.
      verbatimLine(
        719,
        '      <span style="font-size:11px; font-weight:700; letter-spacing:0.1em; background:#4E5C31; color:#F7F9F0; padding:5px 10px; border-radius:4px">1600</span>',
      );
      expect(document.querySelector('.chq-scrim')).toBeInTheDocument();
      expect(document.querySelector('.chq-modal:not(.is-wide)')).toBeNull();
      const modal = document.querySelector('.chq-modal.is-wide');
      expect(modal).toBeInTheDocument(); // ModalFrame's 640px "wide" variant, never 1600px chrome.
      expect(within(document.querySelector('.chq-modal-head') as HTMLElement).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('MATCHES: an update row discloses its overwrites as struck-through old → new, field-labelled', async () => {
      await renderReviewStep();
      // docs/design/Chautauqua Contacts.dc.html:697 -- `{{ ch.field }}
      // ~~{{ ch.from }}~~ → {{ ch.to }}`, capitalised human label, an
      // explicit strike-through then arrow (never a bare diff string).
      verbatimLine(
        697,
        '                  <span style="font-size:13px; line-height:1.5"><span style="font-weight:600">{{ ch.field }}</span> <span style="color:#565A4B; text-decoration:line-through; text-decoration-color:#A8A392">{{ ch.from }}</span> → {{ ch.to }}</span>',
      );
      const table = screen.getByRole('table');
      const strikeOld = within(table).getByText('OldCo');
      expect(strikeOld.tagName).toBe('S');
      expect(strikeOld).toHaveClass('chq-contacts-import-overwrite-old');
      const detail = strikeOld.closest('li') as HTMLElement;
      expect(within(detail).getByText('Company')).toBeInTheDocument();
      expect(detail.textContent).toBe('Company OldCo → Acme');
    });

    it('MATCHES: the footer draws exactly Back (secondary) then the primary Import-N-rows control, in that order', async () => {
      await renderReviewStep();
      // docs/design/Chautauqua Contacts.dc.html:709-710 -- Back, then the
      // primary "Import 214 rows".
      verbatimLine(
        709,
        '            <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Back</span>',
      );
      verbatimLine(
        710,
        '            <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Import 214 rows</span>',
      );
      // DEC-575 wave-9 amendment: the footer now takes the frame's exact
      // membership and order -- Back, then the primary, no Cancel.
      const actionsBar = document.querySelector('.chq-modal-actions') as HTMLElement;
      const footerLabels = within(actionsBar).getAllByRole('button').map((b) => b.textContent);
      expect(footerLabels).toEqual(['Back', 'Import 1 row']);
      expect(within(actionsBar).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :770 "Import CSV · the file will not do" (Modal)
  // ---------------------------------------------------------------------
  describe('frame :770 "Import CSV · the file will not do"', () => {
    const CSV_WITH_MISSING_EMAILS = [
      'First Name,Last Name,Email,Company',
      'John,Doe,john@example.com,Acme',
      'Jane,Smith,,Beta',
      'Bob,Lee,n/a,Gamma',
    ].join('\n');

    async function renderRefusal() {
      render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
      fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV_WITH_MISSING_EMAILS } });
      await screen.findByText(/rows have no email address/);
    }

    it('DIVERGES: the frame titles this state "Nothing was imported" with a Close head control; the tree keeps step 2\'s "Match the columns" title while this block is showing, with no distinct dialog identity of its own', async () => {
      await renderRefusal();
      // docs/design/Chautauqua Contacts.dc.html:777 -- the frame's own
      // dialog H1 for this refusal.
      verbatimLine(
        777,
        '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Nothing was imported</span>',
      );
      // docs/design/Chautauqua Contacts.dc.html:780 -- the frame's Close.
      verbatimLine(780, '        <a href="#" style="font-size:13px; font-weight:700">Close</a>');
      expect(screen.queryByRole('heading', { name: 'Nothing was imported' })).not.toBeInTheDocument();
      // The tree is still step 2's "Match the columns" dialog underneath
      // this refusal block, not a dedicated "Nothing was imported" state.
      expect(screen.getByRole('heading', { name: 'Match the columns' })).toBeInTheDocument();
    });

    it('DIVERGES: the frame\'s heading is a bare count ("N rows have no email address"); the tree names both the offending count AND the total ("N of M rows...")', async () => {
      await renderRefusal();
      // docs/design/Chautauqua Contacts.dc.html:785 -- the frame's bare
      // heading, no "of M" denominator.
      verbatimLine(
        785,
        '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:700">9 rows have no email address</span>',
      );
      expect(screen.queryByText(/^\d+ rows have no email address$/)).not.toBeInTheDocument();
      expect(screen.getByText('2 of 3 rows have no email address')).toBeInTheDocument();
    });

    it('MATCHES: the explanatory sentence and the three-action footer (primary partial-import, secondary re-upload, tertiary download-the-bad-rows) render in the frame\'s order', async () => {
      await renderRefusal();
      // docs/design/Chautauqua Contacts.dc.html:786 -- the explanatory
      // sentence, verbatim.
      verbatimLine(
        786,
        '            <span style="font-size:14px; line-height:1.55; color:#3F4237">Email is how a contact is matched and how anything reaches them, so a row without one cannot be created.</span>',
      );
      expect(
        screen.getByText('Email is how a contact is matched and how anything reaches them, so a row without one cannot be created.'),
      ).toBeInTheDocument();
      // docs/design/Chautauqua Contacts.dc.html:799-800 -- primary /
      // secondary / tertiary, in that order.
      verbatimLine(
        799,
        '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Import the 205 good rows</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Upload a different file</span>',
      );
      verbatimLine(800, '          <a href="#" style="font-size:13px; font-weight:700; padding:0 6px">Download the 9 rows</a></div>');
      const actionsBar = document.querySelector('.chq-modal-actions') as HTMLElement;
      const labels = within(actionsBar)
        .getAllByRole('button')
        .map((b) => b.textContent);
      expect(labels).toEqual(['Import the 1 good row', 'Upload a different file', 'Download the 2 rows']);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :546 "Bulk email" (Modal)
  // ---------------------------------------------------------------------
  describe('frame :546 "Bulk email"', () => {
    function renderCompose() {
      return render(
        <BulkEmailModal
          contactIds={['ct-1', 'ct-2']}
          eventId="evt-1"
          onClose={() => {}}
          recipientNames={['Priya Raman', 'Marcus Okafor']}
        />,
      );
    }

    it('MATCHES: the H1 names the count and the sub names the recipients, per the frame', () => {
      renderCompose();
      // docs/design/Chautauqua Contacts.dc.html:552-553 -- "Email 2
      // contacts" over "Priya Raman, Marcus Okafor".
      verbatimLine(
        552,
        '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Email 2 contacts</span>',
      );
      verbatimLine(553, '          <span style="font-size:13px; color:#565A4B">Priya Raman, Marcus Okafor</span>');
      expect(screen.getByRole('heading', { name: 'Email 2 contacts' })).toBeInTheDocument();
      expect(screen.getByText('Priya Raman, Marcus Okafor')).toBeInTheDocument();
    });

    it('DIVERGES (blessed, pre-flight ruling per this component\'s own citation of frame 08-contacts--10): the frame\'s footer is Send-N-emails + Cancel; the tree\'s compose-step footer is Preview + Cancel, deferring Send behind a preview/confirm step', () => {
      renderCompose();
      // docs/design/Chautauqua Contacts.dc.html:572-573 -- the frame's
      // footer for THIS state (the compose step, before any preview).
      verbatimLine(
        572,
        '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Send 2 emails</span>',
      );
      verbatimLine(
        573,
        '          <span style="border:1px solid #BAB6A6; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Cancel</span>',
      );
      const actionsBar = document.querySelector('.chq-modal-actions') as HTMLElement;
      const labels = within(actionsBar).getAllByRole('button').map((b) => b.textContent);
      expect(labels).toEqual(['Preview', 'Cancel']);
      expect(screen.queryByRole('button', { name: 'Send 2 emails' })).not.toBeInTheDocument();
    });

    it('MATCHES: the merge-fields footnote renders verbatim', () => {
      renderCompose();
      // docs/design/Chautauqua Contacts.dc.html:570 -- standing note,
      // verbatim, literal placeholder tokens (never resolved client-side).
      verbatimLine(
        570,
        '        <span style="font-size:13px; color:#565A4B; line-height:1.5">Sent one at a time · logged in Comms history · {first_name} and {company} resolve per contact</span>',
      );
      expect(
        screen.getByText('Sent one at a time · logged in Comms history · {first_name} and {company} resolve per contact'),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :582 "Add to an event" (Modal)
  // ---------------------------------------------------------------------
  describe('frame :582 "Add to an event"', () => {
    const CONTACT: ContactListItem = {
      id: 'ct-1',
      firstName: 'Priya',
      lastName: 'Raman',
      email: 'priya@example.com',
      labels: [],
    };
    const NO_HISTORY: ContactDetail = {
      ...CONTACT,
      socialLinks: { twitter: '', linkedin: '', github: '', website: '' },
      customFields: {},
      history: { submissions: [], submissionsTotal: 0, emails: [], emailsTotal: 0, events: [], eventsTotal: 0 },
    };

    afterEach(() => {
      resetEventsCacheForTests();
    });

    async function renderModal() {
      mockApi({
        'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
        'GET /api/v1/contacts/ct-1': NO_HISTORY,
      });
      render(
        <MemoryRouter>
          <AddToEventModal contact={CONTACT} onClose={() => {}} />
        </MemoryRouter>,
      );
      await screen.findByRole('button', { name: 'DevFlow Conf 2027' });
    }

    it('MATCHES: the H1 names the action and the sub names the contact, per the frame', async () => {
      await renderModal();
      // docs/design/Chautauqua Contacts.dc.html:582 draws the badge/section
      // eyebrow; the modal's own title reuses that exact string.
      verbatimLine(
        582,
        '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Add to an event</span>',
      );
      expect(screen.getByRole('heading', { name: 'Add to an event' })).toBeInTheDocument();
      expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    });

    it('MATCHES: the footer draws exactly the primary Add-them then secondary Cancel, in the frame\'s order', async () => {
      await renderModal();
      // docs/design/Chautauqua Contacts.dc.html:607-608 -- "Add them" then
      // "Cancel".
      verbatimLine(
        607,
        '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Add them</span>',
      );
      verbatimLine(
        608,
        '          <span style="border:1px solid #BAB6A6; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Cancel</span>',
      );
      const actionsBar = document.querySelector('.chq-modal-actions') as HTMLElement;
      const labels = within(actionsBar).getAllByRole('button').map((b) => b.textContent);
      expect(labels).toEqual(['Add them', 'Cancel']);
    });

    it('DIVERGES: the frame draws exactly three role chips (Speaker/Reviewer/Guest); the tree offers the app\'s real PARTICIPANT_ROLE_OPTIONS vocabulary (Speaker/Co-presenter/Moderator/Panelist) -- a different count and two of three labels, with the first option still pre-selected in both', async () => {
      await renderModal();
      // docs/design/Chautauqua Contacts.dc.html:601-603 -- exactly three
      // chips, Speaker (selected) / Reviewer / Guest.
      verbatimLine(
        601,
        '            <span style="border:1px solid #4E5C31; border-radius:4px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 15px; font-size:14px; font-weight:700">Speaker</span>',
      );
      verbatimLine(
        602,
        '            <span style="border:1px solid #BAB6A6; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 15px; font-size:14px">Reviewer</span>',
      );
      verbatimLine(
        603,
        '            <span style="border:1px solid #BAB6A6; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 15px; font-size:14px">Guest</span>',
      );
      const group = screen.getByRole('group', { name: 'As' });
      const buttons = within(group).getAllByRole('button');
      // DEC-714 (see AddToEventModal.tsx's own compile-checked marker):
      // this control deliberately offers the app's OWN role vocabulary,
      // never a hardcoded Speaker/Reviewer/Guest list -- 'reviewer' is an
      // account role and 'guest' has no representation in the data model,
      // so the frame's own two non-Speaker chips could not be built
      // honestly. Four options, not three; "Speaker" is still first and
      // still pre-selected, matching the frame on that one point only.
      expect(buttons.map((b) => b.textContent)).toEqual(['Speaker', 'Co-presenter', 'Moderator', 'Panelist']);
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
      expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
