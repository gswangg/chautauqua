// w24-c (DEC-032/DEC-651 wave-24): the per-frame DESKTOP (Modal) render
// verdict for the seven Settings dialog frames spanning
// docs/design/Chautauqua Settings.dc.html frames 1268 through 1502 --
// "Invite someone", "Invite · the one-time password", "Invite · rejected", "Confirm ·
// reversible", "Confirm · irreversible", "Portal resource · add", and
// "Reset a password". Modelled byte-for-byte on
// Speakers.desktop-frame-verdicts.render.test.tsx (DEC-930 wave-158) and its
// sibling docs/design/audit/speakers-desktop-v12.md.
//
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate. This file
// moves no desktop byte and edits no component/stylesheet -- it renders the
// real route, verdicts what the tree actually produces, and files
// divergences in prose (this file's comments + the sibling .md).
//
// ENTRY RULE (DEC-651 wave-24): every dialog is reached by rendering
// <SettingsPage /> under a MemoryRouter at its real `?section=<key>` URL
// and firing the real control that opens it with fireEvent -- never a
// direct mount of ConfirmDialog or a panel component, which would verdict
// the component instead of what the PAGE actually hands the dialog.
//
// HARD CITATION CONSTRAINT (DEC-032 wave-24): every docs/design citation in
// this file lands in 1215-1506 -- never >=1507 (`Import from Sessionboard`,
// DEVIATIONS §6 deferred) and never inside 1111-1214 (the "Your data" edit
// view, also DEVIATIONS §6 deferred). jsdom applies no stylesheet (no
// @media, no computed geometry), so every assertion here is DOM
// structure/order/text, or a readFileSync of the app's OWN stylesheet TEXT
// for a claim that is inherently a CSS fact -- the design pack is never
// re-read as its own proof (DEC-976/DEC-967). Every citation below sits
// immediately beside a real `expect(` (within EXPECT_PROXIMITY_LINES per
// app/src/frame-citation.scan.test.ts's DESKTOP_UNRECEIPTED_CLAIM_CEILING).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './Settings';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
// DEC-032/DEC-651: this lane's two governing decisions, referenced so the
// dependency is compile-checked (field-guide invariant) rather than a bare
// comment only a human reads.
import { DEC_032, DEC_651 } from '../../../src/decisions';
void DEC_032;
void DEC_651;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-settings-dialogs-desktop-verdicts';

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
});

function mockAllSections(extra: Record<string, unknown> = {}) {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devflow-2028',
      name: 'DevFlow Conf 2028',
      startDate: '2028-05-11',
      endDate: '2028-05-13',
      location: 'Denver, CO',
      timezone: 'America/Denver',
      recordPrefix: 'DF28',
      branding: { logoUrl: '', accentColor: '' },
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([
      { id: 'res-1', kind: 'file', title: 'Speaker handbook 2027.pdf', content: null, fileId: 'file-1', position: 0 },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [],
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 1, speakers: 1, scheduled: 1 },
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
      { id: 'emb1', name: 'Sponsor deck feed', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([
      { id: 'u-self', email: 'self@example.com', role: 'organizer', name: 'Selma Fields' },
      { id: 'u-other', email: 'sbek-reviewer@example.com', role: 'reviewer', name: 'Sam Whitfield' },
    ]),
    'GET /api/v1/tokens': listEnvelope([]),
    ...extra,
  });
  return undefined;
}

// `?section=<key>&edit=1` is the real URL SummarySection's own "Change"
// drill mints (DEC-728) -- the edit-drilled single-panel view is where the
// editable People/Resources controls (Invite someone table, Add/Delete on
// resources) actually live; the read view only carries a summary row. This
// also scopes the tree to ONE panel, so a query like `getByRole('button',
// { name: 'Delete' })` can't cross-match a different panel's same-named
// control (both PeopleRolesPanel's Delete-adjacent controls and
// SavedEmbedsPanel's own Delete render unconditionally elsewhere).
function renderSection(section: string, extra: Record<string, unknown> = {}) {
  mockAllSections(extra);
  return render(
    <MemoryRouter initialEntries={[`/settings?section=${section}&edit=1`]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

// Public pages has no edit view (DEC-896 B10 DROP) -- SavedEmbedsPanel
// renders its full Edit/Turn on-off/Delete/Build capability set
// unconditionally at the plain read URL.
function renderPublicPages() {
  mockAllSections();
  return render(
    <MemoryRouter initialEntries={['/settings?section=public-pages&view=embeds']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('v12 Settings DESKTOP Modal frames: per-frame render verdict receipts (w24-c, DEC-032/DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :1271 "Invite someone"
  // ---------------------------------------------------------------------
  describe('frame :1271 "Invite someone"', () => {
    it('MATCHES: opened from the real "Invite someone" control at ?section=people, header carries title+subtitle+Close, primary "Create the account" precedes "Cancel"', async () => {
      renderSection('people');
      await waitFor(() => expect(screen.getByText('self@example.com')).toBeInTheDocument());

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);

      const dialog = screen.getByRole('dialog');
      // docs/design/Chautauqua Settings.dc.html:1278 -- title `Invite someone`.
      verbatimLine(1278, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Invite someone</span>');
      expect(within(dialog).getByText('Invite someone')).toBeInTheDocument();
      // docs/design/Chautauqua Settings.dc.html:1279 -- subtitle `They can sign in as soon as you do this`.
      verbatimLine(1279, '          <span style="font-size:13px; color:#565A4B">They can sign in as soon as you do this</span>');
      expect(within(dialog).getByText('They can sign in as soon as you do this')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1311 -- primary `Create the account` then `Cancel`, in that order.
      verbatimLine(1311, '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Create the account</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span></div>');
      expect(within(dialog).getAllByRole('button', { name: /Create the account|Cancel/ }).map((b) => b.textContent)).toEqual(['Create the account', 'Cancel']);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1319 "Invite · the one-time password"
  // ---------------------------------------------------------------------
  describe('frame :1319 "Invite · the one-time password"', () => {
    it('MATCHES: the SAME dialog\'s reveal step -- title "{name} can now sign in", subtitle "{email} · {role}", Done then "Invite someone else"', async () => {
      renderSection('people', {
        'POST /api/v1/users': {
          status: 201,
          body: { id: 'u-new', email: 'sam@example.com', role: 'reviewer', password: 'tr9-mossy-plinth-42', welcomeEmail: 'not_sent_no_event' },
        },
      });
      await waitFor(() => expect(screen.getByText('self@example.com')).toBeInTheDocument());

      fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Sam' } });
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Whitfield' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

      await waitFor(() => expect(screen.getByText('tr9-mossy-plinth-42')).toBeInTheDocument());
      const dialog = screen.getByRole('dialog');

      // docs/design/Chautauqua Settings.dc.html:1326 -- title `Sam Whitfield can now sign in`.
      verbatimLine(1326, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Sam Whitfield can now sign in</span>');
      expect(within(dialog).getByText('Sam Whitfield can now sign in')).toBeInTheDocument();
      // docs/design/Chautauqua Settings.dc.html:1327 -- subtitle `sam@example.com · Reviewer`.
      verbatimLine(1327, '          <span style="font-size:13px; color:#565A4B">sam@example.com · Reviewer</span>');
      expect(within(dialog).getByText('sam@example.com · Reviewer')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1344 -- `Done` then `Invite someone else`, same order in the tree.
      verbatimLine(
        1344,
        '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Done</span><a href="#" style="font-size:13px; font-weight:700; padding:0 6px">Invite someone else</a></div>',
      );
      expect(within(dialog).getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Invite someone else' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1352 "Invite · rejected"
  // ---------------------------------------------------------------------
  describe('frame :1352 "Invite · rejected"', () => {
    it('CONFORMS (DEC-651 wave-9 amendment): the header retitles to "Nobody was invited" on a duplicate-email refusal, and the actions row draws primary -> Cancel -> escape in one row, matching frame :1384', async () => {
      renderSection('people', {
        'POST /api/v1/users': {
          status: 409,
          body: { error: { code: 'conflict', message: 'A user with this email already exists', fields: { email: 'already in use' } } },
        },
      });
      await waitFor(() => expect(screen.getByText('self@example.com')).toBeInTheDocument());

      fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
      expect(screen.getByRole('dialog').querySelector('.chq-modal-title')).toHaveTextContent('Invite someone');

      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Otherton' } });
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Person' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sbek-reviewer@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

      await screen.findByRole('button', { name: /Open .*'s row/ });
      const dialog = screen.getByRole('dialog');

      // docs/design/Chautauqua Settings.dc.html:1359 -- rejected-state title `Nobody was invited`. CONFORMS.
      verbatimLine(1359, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Nobody was invited</span>');
      expect(within(dialog).getByText('Nobody was invited')).toBeInTheDocument();
      expect(within(dialog).queryByText('Invite someone')).not.toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1360 -- subtitle `The address is already in use`. MATCHES.
      verbatimLine(1360, '          <span style="font-size:13px; color:#565A4B">The address is already in use</span>');
      expect(within(dialog).getByText('The address is already in use')).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1384 -- ONE row: `Create the account`, `Cancel`, `Open Sam's row`, in that
      // order. CONFORMS: the tree now renders the escape route as the actions row's THIRD control, matching DOM order.
      // The frame's literal names the contact by first name only ("Sam"); the tree names by the SAME `personLabel`
      // helper every other row uses (full name, falling back to email when a row carries no name) -- an intentional,
      // consistent vocabulary choice, not a divergence (DEC-757).
      verbatimLine(1384, '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Create the account</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span><a href="#" style="font-size:13px; font-weight:700; padding:0 6px">Open Sam\'s row</a></div>');
      const actionsRow = screen.getByRole('button', { name: "Open Sam Whitfield's row" }).closest('.chq-modal-actions') as HTMLElement;
      expect(within(actionsRow).getAllByRole('button', { name: /Create the account|Cancel|Open .*'s row/ }).map((b) => b.textContent)).toEqual(['Create the account', 'Cancel', "Open Sam Whitfield's row"]);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1392 "Confirm · reversible" -- SavedEmbeds "Turn off" dialog,
  // reached via ?section=public-pages&view=embeds (SavedEmbedsPanel always
  // mounts with editing=true there, per PublicPagesPanel.tsx).
  // ---------------------------------------------------------------------
  describe('frame :1392 "Confirm · reversible"', () => {
    it('DIVERGES (additively): title+body MATCH but the tree\'s ConfirmDialog carries no header subtitle slot at all -- the frame\'s "It is embedded on notion.so" line has no DOM counterpart', async () => {
      renderPublicPages();
      await waitFor(() => expect(screen.getByText('Sponsor deck feed')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
      const dialog = screen.getByRole('dialog');

      // docs/design/Chautauqua Settings.dc.html:1399 -- title `Turn off "Sponsor deck feed"?`.
      verbatimLine(1399, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Turn off “Sponsor deck feed”?</span>');
      expect(within(dialog).getByText('Turn off Sponsor deck feed?')).toBeInTheDocument();
      // docs/design/Chautauqua Settings.dc.html:1400 -- subtitle `It is embedded on notion.so`, which the tree never renders.
      verbatimLine(1400, '          <span style="font-size:13px; color:#565A4B">It is embedded on notion.so</span>');
      expect(within(dialog).queryByText('It is embedded on notion.so')).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1406 -- primary `Turn it off` then `Cancel`, MATCHING order and labels.
      verbatimLine(1406, '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Turn it off</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span></div>');
      expect(within(dialog).getAllByRole('button', { name: /Turn it off|Cancel/ }).map((b) => b.textContent)).toEqual(['Turn it off', 'Cancel']);
      expect(within(dialog).getByText(/The embed will render nothing wherever it is pasted/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1414 "Confirm · irreversible" -- Resources delete dialog,
  // ?section=portal.
  // ---------------------------------------------------------------------
  describe('frame :1414 "Confirm · irreversible"', () => {
    it('MATCHES (DEC-941 wave-9 amendment): the confirm\'s TITLE names the resource, same object-naming form as the frame; the DEVIATIONS §6 deferred download-count subtitle and the frame\'s "Delete it" primary stay unbuilt/unadopted', async () => {
      renderSection('portal');
      await waitFor(() => expect(screen.getByText('Speaker handbook 2027.pdf')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = screen.getByRole('dialog');

      // docs/design/Chautauqua Settings.dc.html:1421 -- title `Delete "Speaker handbook 2027.pdf"?`. Wave-9: ResourcesPanel.tsx now
      // builds this exact object-naming form (DEC-941 wave-9 amendment) instead of a fixed generic title.
      verbatimLine(1421, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Delete “Speaker handbook 2027.pdf”?</span>');
      expect(within(dialog).getByText('Delete "Speaker handbook 2027.pdf"?')).toBeInTheDocument();
      expect(within(dialog).queryByText('Delete this resource?')).not.toBeInTheDocument();
      // The body no longer repeats the quoted filename (DEC-613: one copy of the name, now in the title) --
      // it keeps only the consequence sentence.
      expect(
        within(dialog).getByText('Speakers lose the download from their portal. This cannot be recovered.'),
      ).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1422 -- subtitle `Downloaded 18 times by 12 speakers`, DEVIATIONS §6 deferred: no download-count column/endpoint exists. Verdict DIVERGES-by-deferral, build nothing.
      verbatimLine(1422, '          <span style="font-size:13px; color:#565A4B">Downloaded 18 times by 12 speakers</span>');
      expect(within(dialog).queryByText(/Downloaded \d+ times by \d+ speakers/)).not.toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1429 -- `Type the file name to confirm` MATCHES: irreversible weight, primary disabled until typed.
      verbatimLine(1429, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Type the file name to confirm</span>');
      expect(within(dialog).getByText(/Type "Speaker handbook 2027.pdf" to confirm/)).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1432 -- frame primary `Delete it`; the tree's `Delete resource` is a
      // ruled, DELIBERATE non-adoption (DEC-941 wave-9 amendment): app/src/confirm-primary-object.scan.test.ts
      // requires a destructive primary to name its object, and DEC-967 rules frame sample prose is not product
      // copy -- so this is a settled ruling, not an open gap.
      verbatimLine(
        1432,
        '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Delete it</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span></div>',
      );
      expect(within(dialog).queryByRole('button', { name: 'Delete it' })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Delete resource' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1440 "Portal resource · add"
  // ---------------------------------------------------------------------
  describe('frame :1440 "Portal resource · add"', () => {
    it('MATCHES: opened from "Add a resource" at ?section=portal, header title+subtitle verbatim, primary "Add it" precedes Cancel', async () => {
      renderSection('portal');
      await waitFor(() => expect(screen.getByText('Speaker handbook 2027.pdf')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Add a resource' }));
      const dialog = screen.getByRole('dialog');

      // docs/design/Chautauqua Settings.dc.html:1447 -- title `Add a resource`, MATCHES verbatim.
      verbatimLine(1447, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Add a resource</span>');
      expect(within(dialog).getByText('Add a resource')).toBeInTheDocument();
      // docs/design/Chautauqua Settings.dc.html:1448 -- subtitle `Shown to every speaker in their portal`, MATCHES verbatim.
      verbatimLine(1448, '          <span style="font-size:13px; color:#565A4B">Shown to every speaker in their portal</span>');
      expect(within(dialog).getByText('Shown to every speaker in their portal')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1469 -- primary `Add it` then `Cancel`, MATCHING order and label.
      verbatimLine(1469, '        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap"><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Add it</span><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span></div>');
      expect(within(dialog).getAllByRole('button', { name: /Add it|Cancel/ }).map((b) => b.textContent)).toEqual(['Add it', 'Cancel']);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1477 "Reset a password"
  // ---------------------------------------------------------------------
  describe('frame :1477 "Reset a password"', () => {
    it('DIVERGES: the frame draws this as a Modal (bordered header, title, subtitle, Close); the tree opens no dialog at all -- the reveal renders inline in the row with no header contract', async () => {
      renderSection('people', {
        'POST /api/v1/users/u-other/reset-password': {
          status: 200,
          body: { email: 'sbek-reviewer@example.com', password: 'kf4-amber-lintel-08' },
        },
      });
      await waitFor(() => expect(screen.getByText('sbek-reviewer@example.com')).toBeInTheDocument());

      const otherRow = screen.getByText('sbek-reviewer@example.com').closest('li')!;
      fireEvent.click(within(otherRow).getByRole('button', { name: 'Reset password' }));
      fireEvent.click(within(otherRow).getByRole('button', { name: 'Confirm reset' }));

      await waitFor(() => expect(screen.getByText('kf4-amber-lintel-08')).toBeInTheDocument());

      // docs/design/Chautauqua Settings.dc.html:1484 -- Modal header title `Sam Whitfield can sign in again`. No `role="dialog"` exists anywhere in the tree for this reveal.
      verbatimLine(1484, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Sam Whitfield can sign in again</span>');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Sam Whitfield can sign in again')).not.toBeInTheDocument();

      // docs/design/Chautauqua Settings.dc.html:1491 -- section label `New password · shown once` inside the frame's body; the content still renders, just with no dialog chrome around it.
      verbatimLine(1491, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">New password · shown once</span>');
      expect(screen.getByText('New password · shown once')).toBeInTheDocument();
      expect(screen.getByText('kf4-amber-lintel-08')).toBeInTheDocument();
    });
  });
});
