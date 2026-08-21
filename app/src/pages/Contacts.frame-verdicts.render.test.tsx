// w13-ri (DEC-976 wave-157): Contacts is a Tier-0 mobile-campaign cluster
// whose five width:390px frames in `docs/design/Chautauqua Contacts.dc.html`
// (Contacts :179, Contact :407, Pipeline :447, Import CSV :487, Merge :522)
// had NEVER been rendered against a per-frame verdict before this file --
// several of their sub-components carry separate CLOSED claims in
// docs/mobile-campaign.md that were closed on grep evidence, not a render.
// Modelled EXACTLY on Settings.frame-verdicts.render.test.tsx: one it() per
// frame, entered through the REAL route each frame is actually reached by
// (never a sub-component -- ImportWizard/PipelineBoard/MergePage -- mounted
// directly, which is exactly how the earlier CLOSED claims avoided testing
// the route). jsdom applies no stylesheet (no @media), so every assertion
// below is about DOM STRUCTURE/ORDER, never computed geometry. Full verdict
// prose lives in docs/design/audit/contacts-v12.md; this file is the render
// RECEIPT each verdict row cites.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { ContactsPage } from './Contacts';
import { MergePage } from './contacts/MergePage';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests } from '../lib/useCurrentEvent';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-contacts-frame-verdicts';

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
  resetEventsCacheForTests();
});

/** Base mocks every ContactsPage mount needs (stats/segments/duplicates/
 * contacts/events all fire unconditionally on mount, regardless of which
 * ?tab= panel is showing -- ContactsApp.tsx's directory list, stats,
 * segments and duplicate-preview effects are not panel-gated). */
function mockContactsBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/contacts/stats': {
      total: 318,
      speakerCount: 41,
      returningSpeakers: 0,
      eventCount: 1,
      topCompanies: [],
    },
    'GET /api/v1/segments': listEnvelope([]),
    'GET /api/v1/contacts/duplicates': listEnvelope([]),
    'GET /api/v1/contacts': listEnvelope([
      { id: 'ct1', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', company: 'Latticework Systems', title: 'Principal Engineer', labels: [] },
    ]),
    'GET /api/v1/events': listEnvelope([]),
    ...overrides,
  });
}

describe('v12 Contacts 390 frames: per-frame render verdict receipts (w13-ri, DEC-976)', () => {
  // Frame :179-223 "Contacts" -- caption at :175.
  it('frame :179 Contacts landing -- DIVERGES: desktop table (checkbox column, header row, per-row "Open") and the full rule-builder render unchanged, not the frame\'s headerless card list with a per-row "Email" action', async () => {
    verbatimLine(175, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Contacts</span>");
    stubPhoneMatchMedia();
    mockContactsBase();

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Contacts', level: 1 })).toBeInTheDocument();
    const table = await screen.findByRole('table');
    // Frame :186-198 draws a search box + "All of ... + Rule" chip row +
    // an All/Speakers/Reviewers pill row, then a headerless per-row list
    // (name / company·role / tags, a single boxed "Email" action, :209)
    // ending in a footer tab strip (:214-221) -- none of that is what
    // mounts here. The actual read is the SAME desktop
    // `<table class="chq-table chq-contacts-table">` (checkbox column,
    // "Name and email"/"Company"/"Labels" headers) every width renders.
    const headerCells = within(table).getAllByRole('columnheader');
    expect(headerCells.map((c) => c.textContent)).toEqual(['', 'Name and email', 'Company', 'Labels', '']);
    await waitFor(() => expect(within(table).getByText('Priya Raman')).toBeInTheDocument());
    // Frame :209's per-row action is a boxed "Email"; the actual row's
    // action button reads "Open" instead.
    expect(within(table).queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(within(table).getByRole('checkbox', { name: 'Select all on page' })).toBeInTheDocument();
  });

  // Frame :407-437 "Contact · 390" -- caption at :403.
  it('frame :407 Contact -- DIVERGES: reached as a role="dialog" portal (h2 title, an always-on "Close" control) not the frame\'s own full-screen route with only a "‹ Contacts" back link; the two-control dock itself matches', async () => {
    verbatimLine(403, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Contact · 390</span>");
    stubPhoneMatchMedia();
    mockContactsBase({
      'GET /api/v1/contacts/ct1': {
        id: 'ct1',
        firstName: 'Priya',
        lastName: 'Raman',
        email: 'priya@example.com',
        company: 'Latticework Systems',
        title: 'Principal Engineer',
        labels: [],
        phone: null,
        notes: null,
        bio: null,
        headshotUrl: null,
        socialLinks: { twitter: '', linkedin: '', github: '', website: '' },
        customFields: {},
        history: { submissions: [], submissionsTotal: 0, emails: [], emailsTotal: 0, events: [], eventsTotal: 0 },
      },
    });

    render(
      <MemoryRouter initialEntries={['/contacts?openContact=ct1']}>
        <ContactsPage />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument());

    // Frame :410 draws the record name as the screen's own H1; the drawer
    // renders it through ModalFrame's shared H2 (`.chq-modal-title`).
    expect(within(dialog).queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Priya Raman' })).toBeInTheDocument();
    // Frame :409 draws exactly one control in the head band, the "‹
    // Contacts" back link -- no separate close/X. ModalFrame always adds
    // its own "Close" button beside the back link.
    expect(within(dialog).getByRole('button', { name: '‹ Contacts' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    // Frame :433-436's dock (DEC-959, previously verified by
    // ContactDrawer.phoneRead.render.test.tsx) still matches exactly.
    const dock = dialog.querySelector('[data-chq-phone-dock]');
    expect(dock).not.toBeNull();
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons.map((b) => b.textContent)).toEqual(['Email Priya', 'Edit']);
  });

  // Frame :447-477 "Pipeline · 390" -- caption at :443.
  it('frame :447 Pipeline -- MATCHES: back link, H1 + "N people" caption, stage chip strip, per-row "Move ›" and the "Add someone"/"Filter" dock all render as drawn', async () => {
    verbatimLine(443, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Pipeline · 390</span>");
    stubPhoneMatchMedia();
    mockContactsBase({
      'GET /api/v1/pipeline': listEnvelope([
        {
          id: 'entry-1',
          contactId: 'ct1',
          firstName: 'Priya',
          lastName: 'Raman',
          company: 'Latticework Systems',
          stage: 'identified',
          fitScore: null,
          rationale: null,
          stageSince: 1000,
          declineReason: null,
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
        <ContactsPage />
      </MemoryRouter>,
    );

    // Frame :449 back link, :450 H1, :451 "20 people" caption.
    expect(screen.getByRole('button', { name: '‹ Contacts' })).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 1, name: 'Pipeline' });
    expect(heading).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 people')).toBeInTheDocument());
    // Frame :453-457 chip strip (Identified/Contacted/Interested/Confirmed/
    // Declined), each carrying a count.
    const chipStrip = document.querySelector('.chq-contacts-pipeline-phone-stages');
    expect(chipStrip).not.toBeNull();
    expect(within(chipStrip as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Identified · 1',
      'Contacted · 0',
      'Interested · 0',
      'Confirmed · 0',
      'Declined · 0',
    ]);
    // Frame :460-471 per-row card ending in a "Move ›" control (:470).
    const phoneList = document.querySelector('.chq-contacts-pipeline-phone-list');
    expect(phoneList).not.toBeNull();
    await waitFor(() => expect(within(phoneList as HTMLElement).getByText('Priya Raman')).toBeInTheDocument());
    expect(
      within(phoneList as HTMLElement).getByRole('button', { name: /^Move Priya Raman out of/ }).textContent,
    ).toBe('Move ›');
    // Frame :473-476 dock: "Add someone" (primary) / "Filter" (secondary).
    const dock = document.querySelector('[data-chq-phone-dock]');
    expect(dock).not.toBeNull();
    expect(within(dock as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Add someone',
      'Filter',
    ]);
  });

  // Frame :487-512 "Import CSV · 390" -- caption at :483.
  it('frame :487 Import CSV -- DIVERGES: no "‹ Contacts" back link (ModalFrame renders "Close" instead, no backLink prop wired) -- the one-column-per-screen pager body and its "Next column"/"Skip" dock otherwise match (findings 1-2 RESOLVED, contacts-v12.md)', async () => {
    verbatimLine(483, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Import CSV · 390</span>");
    stubPhoneMatchMedia();
    mockContactsBase();

    render(
      <MemoryRouter initialEntries={['/contacts?import=1']}>
        <ContactsPage />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    fireEvent.change(within(dialog).getByLabelText('Or paste CSV text'), {
      target: { value: 'First Name,Last Name,Email,Company\nPriya,Raman,priya@example.com,Latticework' },
    });

    // Frame :490 H1 "Match the columns" -- renders as the dialog's shared
    // H2 title (same register as the Contact frame's Finding 4).
    await waitFor(() => expect(within(dialog).getByRole('heading', { level: 2, name: 'Match the columns' })).toBeInTheDocument());
    // Frame :489's "‹ Contacts" back link has no counterpart here -- the
    // wizard never passes ModalFrame a `backLink`, so only "Close" renders.
    expect(within(dialog).queryByRole('button', { name: '‹ Contacts' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    // Frame body :494-496 eyebrow/name/samples, :499 "Import it as" rule,
    // :501-506 radio targets -- the phone pager (RESOLVED findings 1-2).
    const phoneColumn = document.querySelector('.chq-contacts-import-phone-column');
    expect(phoneColumn).not.toBeNull();
    expect(within(phoneColumn as HTMLElement).getByText('Column 1 of 4')).toBeInTheDocument();
    expect(within(phoneColumn as HTMLElement).getByText('First Name')).toBeInTheDocument();
    expect(within(phoneColumn as HTMLElement).getByText('Import it as')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Map column First Name' })).toBeInTheDocument();
    // Frame :508-511 dock: "Next column" (primary) / "Skip" (secondary).
    const dock = document.querySelector('[data-chq-phone-dock]');
    expect(dock).not.toBeNull();
    expect(within(dock as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Next column',
      'Skip',
    ]);
  });

  // Frame :522-540 "Merge · 390" -- caption at :518.
  it('frame :522 Merge -- DIVERGES: an extra "which record to keep" radio-pick list renders above the compare rows with no counterpart in the frame body, which goes straight from the head band into the field-by-field rows', async () => {
    verbatimLine(518, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Merge · 390</span>");
    const group = {
      contactIds: ['ct1', 'ct2'],
      reason: 'email' as const,
      contacts: [
        { id: 'ct1', firstName: 'Marcus', lastName: 'Okafor', email: 'marcus@example.com', company: 'Acme', title: 'Lead', createdAt: 1000 },
        { id: 'ct2', firstName: 'Marcus', lastName: 'O.', email: 'marcus.o@example.com', company: 'Acme', title: null, createdAt: 2000 },
      ],
    };
    mockApi({
      'GET /api/v1/contacts/duplicates': { items: [group], total: 6, position: 1 },
      'GET /api/v1/contacts/merge/preview': {
        fields: [{ key: 'email', label: 'Email', kept: 'marcus@example.com', discarded: ['marcus.o@example.com'], outcome: 'keep' }],
        impact: { submissions: 3, tasks: 1 },
        blocked: null,
      },
    });

    render(
      <MemoryRouter initialEntries={['/contacts/merge?ids=ct1,ct2']}>
        <MergePage />
      </MemoryRouter>,
    );

    // Frame :525 back link "‹ Duplicates", :525 H1 "Merge two records".
    expect(screen.getByRole('link', { name: /Duplicates$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Merge two records' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Field/)).toBeInTheDocument());

    // Frame body goes straight from the head band (:522-526) into the
    // field-by-field rows (:528-534) -- no picker block. The actual page
    // renders `.chq-contacts-merge-picks`, one radio per contact.
    const picks = document.querySelector('.chq-contacts-merge-picks');
    expect(picks).not.toBeNull();
    expect(within(picks as HTMLElement).getAllByRole('radio')).toHaveLength(2);

    // Frame :531/:532's per-field keep/drop pair and :537's "Merge them" /
    // "Not a duplicate" footer (RULED, w2-c) still match.
    await waitFor(() => expect(screen.getByText('marcus@example.com')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Merge into/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not a duplicate' })).toBeInTheDocument();
  });
});
