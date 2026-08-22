// w26-a (residue part 1 of 2, DEC-976/DEC-651/DEC-032): the per-frame
// DESKTOP (1600) render verdict for the three directory/record frames in
// docs/design/Chautauqua Contacts.dc.html that no in-flight lane claims --
// :28 "Directory · 1600", :229 "Contact · drawer", :808 "New contact".
// v12m-w23-g owns :312/:352/:617/:720 (Duplicates/Segments/Pipeline/Import)
// and says so in its own audit doc; this file never touches those frames or
// their files.
//
// Modelled EXACTLY on the LANDED
// app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) receipt helper, same beforeEach/afterEach
// console guard, same mockApi/listEnvelope test-utils, same MemoryRouter
// route entry (through the real page component, never a sub-component
// mounted directly). jsdom applies no stylesheet (no @media, no computed
// grid-template-columns/font-weight), so every assertion here is DOM
// structure/order/text, or a readFileSync of the APP's OWN stylesheet TEXT
// for any claim that is inherently a CSS fact -- the design pack is never
// re-read as its own proof (DEC-976/DEC-967). Every
// docs/design/...dc.html:<line> citation carries its verbatimLine receipt
// immediately beside the `expect(` it supports.
//
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this file moves no desktop
// byte and edits no component or stylesheet, even where a real divergence
// is found -- it renders what the tree actually produces and files
// divergences in prose in the sibling audit doc.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsPage } from './Contacts';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests } from '../lib/useCurrentEvent';
import type { ContactDetail } from './contacts/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-contacts-desktop-verdicts';
const CONTACT_ID = 'ct-desktop-1';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  resetEventsCacheForTests();
});

/** Base mocks every ContactsPage mount needs (stats/segments/duplicates/
 * contacts/events all fire unconditionally on mount, regardless of which
 * ?tab=/?openContact= state is showing). Copied from the landed
 * Contacts.frame-verdicts.render.test.tsx's own mockContactsBase. matchMedia
 * is deliberately left un-stubbed here -- useIsPhone reads false whenever
 * matchMedia is absent, i.e. every desktop width and jsdom by default. */
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

function baseContactDetail(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    id: CONTACT_ID,
    firstName: 'Priya',
    lastName: 'Raman',
    email: 'priya@example.com',
    company: 'Latticework Systems',
    title: 'Principal Engineer',
    labels: [],
    phone: '+1 415 555 0134',
    notes: 'Prefers a morning slot.',
    bio: 'Leads the build-tooling platform team.',
    socialLinks: { twitter: '', linkedin: '', github: '', website: '' },
    customFields: {},
    history: {
      submissions: [],
      submissionsTotal: 0,
      emails: [],
      emailsTotal: 0,
      events: [],
      eventsTotal: 0,
    },
    ...overrides,
  };
}

describe('v12 Contacts DESKTOP (1600) frames: per-frame render verdict receipts (w26-a, DEC-976/DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Directory · 1600"
  // ---------------------------------------------------------------------
  describe('frame :28 "Directory · 1600"', () => {
    it('MATCHES: title-row action cluster order (Import CSV, Export CSV, New contact)', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      const actions = document.querySelector('.chq-contacts-title-actions');
      const labels = within(actions as HTMLElement).getAllByRole('button', { hidden: false }).map((b) => b.textContent);
      const linkLabels = within(actions as HTMLElement).queryAllByRole('link').map((a) => a.textContent);
      // docs/design/Chautauqua Contacts.dc.html:60-62 -- the desktop action
      // cluster reads Import CSV, Export CSV (an `<a>`, hence the CSV export
      // href), New contact, in that order.
      verbatimLine(60, '            <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Import CSV</a>');
      expect([...labels.filter((l) => l === 'Import CSV'), ...linkLabels, ...labels.filter((l) => l === 'New contact')]).toEqual([
        'Import CSV',
        'Export CSV',
        'New contact',
      ]);
    });

    it('MATCHES: the title-row summary carries the eventCount-1/returningSpeakers-0 3-clause shape, and the head count reads "N of M"', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      // docs/design/Chautauqua Contacts.dc.html:57 -- the frame's own
      // 3-clause summary literal (people/speakers/possible-duplicates), the
      // shape ContactsApp.tsx's `summary` reproduces with live figures.
      verbatimLine(57, '            <span style="font-size:13px; color:#565A4B">318 people · 41 speakers · 6 possible duplicates</span>');
      const summary = document.querySelector('.chq-summary')?.textContent;
      expect(summary).toBe('318 people · 41 speakers · 0 possible duplicates');
      await waitFor(() =>
        expect(document.querySelector('.chq-contacts-head-count')?.textContent).toMatch(/^\d+ of \d+$/),
      );
    });

    it('MATCHES: the tab chip strip order is Directory, Duplicates·N, Segments·N, Pipeline, with search + segment select at the right end', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
      // docs/design/Chautauqua Contacts.dc.html:67-70 -- Directory,
      // Duplicates · 6, Segments · 5, Pipeline, in that order.
      verbatimLine(67, '          <span style="background:#1B1D17; color:#F4F1E8; border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600">Directory</span>');
      expect(tabs).toEqual(['Directory', 'Duplicates · 0', 'Segments · 0', 'Pipeline']);
      expect(screen.getByRole('searchbox', { name: 'Search contacts' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Segment filter' })).toBeInTheDocument();
    });

    it('MATCHES: the directory table head reads Name and email / Company / Labels, and a row renders name+email, company+title, labels, an "Open" action', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      const table = await screen.findByRole('table');
      const headCells = within(table).getAllByRole('columnheader').map((c) => c.textContent);
      // docs/design/Chautauqua Contacts.dc.html:98 -- the desktop table
      // head's five columns (checkbox is the un-labelled first span).
      verbatimLine(98, '              <span>☐</span><span>Name and email</span><span>Company</span><span>Labels</span><span></span>');
      expect(headCells).toEqual(['', 'Name and email', 'Company', 'Labels', '']);

      const row = within(table).getByText('Priya Raman').closest('tr') as HTMLElement;
      expect(within(row).getByText('priya@example.com')).toBeInTheDocument();
      expect(within(row).getByText('Latticework Systems')).toBeInTheDocument();
      expect(within(row).getByText('Principal Engineer')).toBeInTheDocument();
      // docs/design/Chautauqua Contacts.dc.html:112 -- the row's own action
      // is `Open`, never the phone frame's `Email`.
      verbatimLine(112, '                <a href="#" style="font-size:12px; font-weight:700; align-self:center">Open</a>');
      expect(within(row).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    });

    it('MATCHES: the pager reads "Showing N of M" with Previous/Next', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('table');
      // docs/design/Chautauqua Contacts.dc.html:116 -- "Showing 2 of 2
      // matching" left, Previous/Next right, in that DOM order.
      verbatimLine(116, '              <span style="font-size:13px; color:#565A4B">Showing 2 of 2 matching</span>');
      const pager = document.querySelector('.chq-pager');
      expect(pager?.textContent).toMatch(/^Showing 1[–-]1 of 1/);
      expect(within(pager as HTMLElement).getByRole('button', { name: 'Previous' })).toBeInTheDocument();
      expect(within(pager as HTMLElement).getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });

    it('MATCHES: the directory rail renders "Where they work" and "Saved segments" section heads, in that order', async () => {
      mockContactsBase({
        'GET /api/v1/contacts/stats': {
          total: 318,
          speakerCount: 41,
          returningSpeakers: 0,
          eventCount: 1,
          topCompanies: [{ company: 'Latticework Systems', count: 7 }],
        },
      });
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      // docs/design/Chautauqua Contacts.dc.html:127 -- "Where they work",
      // the rail's first section.
      verbatimLine(127, '                <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Where they work</span>');
      const rail = document.querySelector('.chq-contacts-rail');
      const sectionLabels = [...(rail as HTMLElement).querySelectorAll('.chq-section-label')].map((el) => el.textContent);
      expect(sectionLabels).toEqual(expect.arrayContaining(['Where they work', 'Saved segments']));
      const whereIdx = sectionLabels.indexOf('Where they work');
      const savedIdx = sectionLabels.indexOf('Saved segments');
      expect(whereIdx).toBeLessThan(savedIdx);
      await waitFor(() =>
        expect(within(rail as HTMLElement).getByRole('button', { name: 'Latticework Systems' })).toBeInTheDocument(),
      );
    });
  });

  // ---------------------------------------------------------------------
  // Frame :229 "Contact · drawer"
  // ---------------------------------------------------------------------
  describe('frame :229 "Contact · drawer"', () => {
    function mockDrawerOpen() {
      return mockContactsBase({
        [`GET /api/v1/contacts/${CONTACT_ID}`]: baseContactDetail(),
      });
    }

    it('MATCHES: the drawer opens with a "Close" control and the contact\'s name/company-title header', async () => {
      mockDrawerOpen();
      render(
        <MemoryRouter initialEntries={[`/contacts?openContact=${CONTACT_ID}`]}>
          <ContactsPage />
        </MemoryRouter>,
      );
      const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
      // docs/design/Chautauqua Contacts.dc.html:238 -- the drawer's header
      // Close control.
      verbatimLine(238, '        <a href="#" style="font-size:13px; font-weight:700">Close</a>');
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(within(dialog).getByRole('heading', { name: 'Priya Raman' })).toBeInTheDocument();
      expect(dialog.textContent).toMatch(/Latticework Systems.*Principal Engineer/);
    });

    it('MATCHES: field groups render in frame order Contact, Profile, then an event-scoped group, then Notes', async () => {
      mockDrawerOpen();
      render(
        <MemoryRouter initialEntries={[`/contacts?openContact=${CONTACT_ID}`]}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Priya Raman' });
      // docs/design/Chautauqua Contacts.dc.html:936/942/946/952 (the
      // contactGroups data array feeding the frame's sc-for) -- Contact,
      // Profile, "This event", Notes.
      verbatimLine(936, "        { name: 'Contact', rows: [");
      const groupTitles = [...document.querySelectorAll('.chq-contacts-record-group-head .chq-section-label')].map(
        (el) => el.textContent,
      );
      expect(groupTitles).toEqual(['Contact', 'Profile', 'On this event', 'Notes']);
    });

    it('DIVERGES: the frame\'s sticky action bar reads Delete this contact, Cancel, Save, Email, Add to event (in that literal order); the tree keeps Delete far left but orders its right-hand group Email, Add to event, Cancel, Save', async () => {
      mockDrawerOpen();
      render(
        <MemoryRouter initialEntries={[`/contacts?openContact=${CONTACT_ID}`]}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Priya Raman' });
      // docs/design/Chautauqua Contacts.dc.html:265-268 -- the frame's own
      // literal order: Delete this contact, Cancel, Save, Email, Add to
      // event.
      verbatimLine(265, '        <div style="position:sticky; bottom:0; background:#F4F1E8; border-top:1px solid #D3CFC0; margin:0 -26px -28px; padding:16px 26px; display:flex; align-items:center; gap:12px">');
      const actionsBar = document.querySelector('.chq-contacts-drawer-actions');
      const buttonLabels = within(actionsBar as HTMLElement).getAllByRole('button').map((b) => b.textContent);
      expect(buttonLabels).toEqual(['Delete this contact', 'Email', 'Add to event', 'Cancel', 'Save']);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :808 "New contact"
  // ---------------------------------------------------------------------
  describe('frame :808 "New contact"', () => {
    it('MATCHES: header title/subtitle plus field order First name/Last name, Email, Company/Title', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      screen.getByRole('button', { name: 'New contact' }).click();
      const dialog = await screen.findByRole('dialog', { name: 'New contact' });
      // docs/design/Chautauqua Contacts.dc.html:816 -- the subtitle "Added
      // to the org, not to an event".
      verbatimLine(816, '          <span style="font-size:13px; color:#565A4B">Added to the org, not to an event</span>');
      expect(within(dialog).getByText('Added to the org, not to an event')).toBeInTheDocument();

      const labels = within(dialog)
        .getAllByText(/^(First name|Last name|Email|Company(?: · optional)?|Title(?: · optional)?)$/)
        .map((el) => el.textContent);
      // docs/design/Chautauqua Contacts.dc.html:821-838 -- First name/Last name
      // paired, then Email, then Company/Title paired. The frame's own section
      // labels have no "optional" suffix -- NewContactModal.tsx adds one (FormRow's
      // `optional` prop, DEC-917's shared ' · optional' marker) via the shared
      // form-row convention every other modal uses, additive text only, order unaffected.
      verbatimLine(821, '        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">');
      expect(labels).toEqual(['First name', 'Last name', 'Email', 'Company · optional', 'Title · optional']);
    });

    it('MATCHES: the action row is Add the contact (primary) then Cancel, matching the frame\'s literal order', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      screen.getByRole('button', { name: 'New contact' }).click();
      const dialog = await screen.findByRole('dialog', { name: 'New contact' });
      // docs/design/Chautauqua Contacts.dc.html:847 -- `Add the contact`
      // then `Cancel`, in that literal DOM order.
      verbatimLine(847, '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Add the contact</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span></div>');
      const actionsBar = dialog.querySelector('.chq-modal-actions');
      const buttonLabels = within(actionsBar as HTMLElement).getAllByRole('button').map((b) => b.textContent);
      expect(buttonLabels).toEqual(['Add the contact', 'Cancel']);
    });

    it('MATCHES: the closing scope note names "Add to an event" verbatim as the row-level path onto an event', async () => {
      mockContactsBase();
      render(
        <MemoryRouter initialEntries={['/contacts']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      await screen.findByRole('heading', { name: 'Contacts', level: 1 });
      screen.getByRole('button', { name: 'New contact' }).click();
      const dialog = await screen.findByRole('dialog', { name: 'New contact' });
      // docs/design/Chautauqua Contacts.dc.html:846 -- the frame's exact
      // scope sentence, "Add to an event" bolded.
      verbatimLine(846, '        <span style="font-size:13px; color:#565A4B; line-height:1.55">This adds someone to your directory. To put them on an event, use <strong style="color:#3F4237">Add to an event</strong> on their row afterwards.</span>');
      expect(dialog.textContent).toMatch(
        /This adds someone to your directory\. To put them on an event, use Add to an event on their\s*row afterwards\./,
      );
    });
  });
});
