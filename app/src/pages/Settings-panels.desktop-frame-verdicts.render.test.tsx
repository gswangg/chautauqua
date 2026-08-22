// w24-b (DEC-032, DEC-651): the per-frame DESKTOP (1600) render verdict for
// the remaining Settings edit views + the refusal band, four frames --
// Chautauqua Settings.dc.html :869 (Speaker portal edit), :950 (People and
// roles edit), :1021 (one saved embed edit), :1215 (save rejected by the
// server). Sibling to Speakers.desktop-frame-verdicts.render.test.tsx
// (DEC-930 wave-158's two-file pair) and its own new audit doc,
// docs/design/audit/settings-panels-desktop-v12.md.
//
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate, so this file
// moves no desktop byte and edits no component/stylesheet -- it renders the
// real route, verdicts what the tree actually produces, and files
// divergences in prose.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx
// (same verbatimLine(lineNo, literal) helper) and
// Settings.frame-verdicts.render.test.tsx (the phone sibling, same
// mockApi/listEnvelope fixtures + console-error guard). jsdom applies no
// stylesheet (no @media, no computed geometry), so every assertion here is
// DOM structure/order/text, or a readFileSync of the app's own stylesheet
// TEXT for a claim that is inherently a CSS fact -- the design pack is
// never re-read as its own proof (DEC-976/DEC-967).
//
// DEC-651 wave-24 amendment: a Modal/Menu/STATE frame is verdicted by
// operating the control that opens it on the real route -- a direct
// component mount verdicts the component, not the screen. :1021 (a nested
// edit view) is reached by firing the real "Edit" link from the Saved
// embeds screen; :1215 (a STATE frame) is reached by driving a real
// mockApi PATCH rejection through EventSettingsPanel's save flow, never by
// rendering a refusal band directly.
//
// DEC-032 wave-24 amendment (HARD CITATION CONSTRAINT): Chautauqua
// Settings.dc.html lines 1111-1214 are the DEVIATIONS §6 deviation-deferred
// extent for "Settings · editing your data", and >=1507 is the extent for
// "Import from Sessionboard". This file cites NO line in either range --
// every :1215 citation below sits at or after line 1215.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './Settings';
import { listEnvelope, mockApi, errorEnvelope } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine (in
 * turn copied from Settings.frame-verdicts.render.test.tsx). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-settings-panels-desktop-verdicts';

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

const EVENT_DETAIL = {
  id: EVENT_ID,
  slug: 'devcon-2026',
  name: 'DevCon 2026',
  startDate: '2026-09-01',
  endDate: '2026-09-03',
  location: 'Austin, TX',
  timezone: 'America/Chicago',
  recordPrefix: 'DC26',
  branding: { logoUrl: '', accentColor: '' },
};

/** Copied from Settings.frame-verdicts.render.test.tsx's own
 * mockAllSections -- every section's read fixtures, so drilling into any
 * one edit view never 404s a sibling panel's GET. */
function mockAllSections(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: EVENT_DETAIL,
    'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Hall', capacity: 500 }]),
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Thanks for speaking at DevCon. Everything we need from you is on this page, in order.',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([
      { id: 'res1', kind: 'wiki', title: 'Travel info', content: 'Fly into AUS.', fileId: null, position: 0 },
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
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 3, speakers: 2, scheduled: 1 },
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
      { id: 'emb1', name: 'AI track sessions', surface: 'sessions', format: 'iframe', options: { trackId: 'trk1', fields: ['title', 'speakers'] }, enabled: true },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([
      { id: 'u-self', email: 'self@example.com', role: 'organizer' },
      { id: 'u-other', email: 'other@example.com', role: 'reviewer' },
    ]),
    'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
    ...overrides,
  });
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('v12 Settings DESKTOP (1600) edit-view + refusal frames: per-frame render verdict receipts (w24-b, DEC-032/DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :869 "Settings · editing the speaker portal"
  // ---------------------------------------------------------------------
  describe('frame :869 "Settings · editing the speaker portal"', () => {
    it('RESOLVED (wave 9, DEC-919 amendment): the frame draws a boxed static readout of the welcome text ABOVE the editable field; the tree now builds it', async () => {
      verbatimLine(
        869,
        '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Settings · editing the speaker portal</span>',
      );
      mockAllSections();
      renderAt('/settings?section=portal&edit=1');
      const section = await screen.findByRole('region', { name: 'Speaker portal' });
      const textarea = await within(section).findByLabelText('Welcome note');
      expect(textarea.tagName).toBe('TEXTAREA');
      // The frame's boxed 96px static readout, drawn ABOVE the actual
      // editable field, now renders via a `-edit` modifier class carrying
      // the frame's desktop measure, fed by the STORED welcome text.
      // docs/design/Chautauqua Settings.dc.html:905 --
      // `<div style="border:1px solid #BAB6A6; border-radius:4px; background:#FAF8F2; padding:13px; min-height:96px; font-size:15px; line-height:1.65; color:#3F4237">Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.</div>`
      verbatimLine(905, '              <div style="border:1px solid #BAB6A6; border-radius:4px; background:#FAF8F2; padding:13px; min-height:96px; font-size:15px; line-height:1.65; color:#3F4237">Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.</div>');
      const readout = section.querySelector('.chq-settings-portal-welcome-readout-edit');
      expect(readout).not.toBeNull();
      expect(readout).toHaveTextContent(
        'Thanks for speaking at DevCon. Everything we need from you is on this page, in order.',
      );
      expect(readout!.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('MATCHES: "What speakers may edit" pills and the Resources · N heading render in the edit form, in that order', async () => {
      mockAllSections();
      renderAt('/settings?section=portal&edit=1');
      const section = await screen.findByRole('region', { name: 'Speaker portal' });
      await within(section).findByLabelText('Welcome note');
      const pillsHead = within(section).getByText('What speakers may edit');
      const resourcesHead = within(section).getByText('Resources · 1');
      // docs/design/Chautauqua Settings.dc.html:906 --
      // `<span style="font-size:12px; color:#565A4B; line-height:1.5">Takes the full measure · appears above the task list</span>`
      verbatimLine(906, '              <span style="font-size:12px; color:#565A4B; line-height:1.5">Takes the full measure · appears above the task list</span>');
      // DEC-919 wave-9 amendment: the caption now renders exactly once,
      // below the readout, no longer doubled as the textarea's field hint.
      expect(within(section).getAllByText('Takes the full measure · appears above the task list')).toHaveLength(1);
      expect(pillsHead.compareDocumentPosition(resourcesHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('MATCHES: the edit form footer is Cancel then Save changes', async () => {
      mockAllSections();
      renderAt('/settings?section=portal&edit=1');
      const section = await screen.findByRole('region', { name: 'Speaker portal' });
      await within(section).findByLabelText('Welcome note');
      // docs/design/Chautauqua Settings.dc.html:938 --
      // `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span>`
      verbatimLine(938, '              <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span>');
      const cancelBtn = within(section).getByRole('button', { name: 'Cancel' });
      const saveBtn = within(section).getByRole('button', { name: 'Save changes' });
      expect(cancelBtn.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :950 "Settings · editing people and roles"
  // ---------------------------------------------------------------------
  describe('frame :950 "Settings · editing people and roles"', () => {
    it('re-verdicted (was previously filed DIVERGES): the tree NOW builds the frame\'s left-flush "Change your own password" footer link -- the prior finding is stale', async () => {
      verbatimLine(
        950,
        '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Settings · editing people and roles</span>',
      );
      mockAllSections();
      renderAt('/settings?section=people&edit=1');
      const section = await screen.findByRole('region', { name: 'People and roles' });
      await within(section).findByText('self@example.com');
      // docs/design/Chautauqua Settings.dc.html:1007 --
      // `<a href="#" style="font-size:13px; font-weight:700; color:#565A4B">Change your own password</a>`
      verbatimLine(1007, '            <a href="#" style="font-size:13px; font-weight:700; color:#565A4B">Change your own password</a>');
      const passwordLink = within(section).getByRole('link', { name: 'Change your own password' });
      expect(passwordLink).toHaveAttribute('href', '/account/password');
    });

    it('DIVERGES: the frame draws a Cancel/Save-changes pair in the edit footer; the tree ships a single Close primary (no form to submit -- role/removal writes apply directly)', async () => {
      mockAllSections();
      renderAt('/settings?section=people&edit=1');
      const section = await screen.findByRole('region', { name: 'People and roles' });
      await within(section).findByText('self@example.com');
      // docs/design/Chautauqua Settings.dc.html:1009 --
      // `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span>`
      verbatimLine(1009, '              <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span>');
      expect(within(section).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(within(section).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('MATCHES: a non-self row carries a Reset-password action and Remove, and Invite someone heads the section', async () => {
      mockAllSections();
      renderAt('/settings?section=people&edit=1');
      const section = await screen.findByRole('region', { name: 'People and roles' });
      const otherRow = (await within(section).findByText('other@example.com')).closest('li');
      expect(otherRow).not.toBeNull();
      // docs/design/Chautauqua Settings.dc.html:998 --
      // `<a href="#" style="color:#565A4B">Reset password</a>`
      // each row's Reset-password action, alongside Remove.
      verbatimLine(998, '                  <a href="#" style="color:#565A4B">Reset password</a>');
      expect(within(otherRow as HTMLElement).getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
      expect(within(otherRow as HTMLElement).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
      const inviteLink = section.querySelector('.chq-settings-people-invite-action');
      expect(inviteLink).not.toBeNull();
      expect(inviteLink).toHaveTextContent('Invite someone');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1021 "Settings · editing one saved embed"
  // ---------------------------------------------------------------------
  describe('frame :1021 "Settings · editing one saved embed"', () => {
    async function driveIntoEmbedEdit() {
      mockAllSections();
      renderAt('/settings?section=public-pages&view=embeds');
      // DEC-651 wave-24: a nested edit view is reached by firing the real
      // opening control on the route that owns it -- SavedEmbedsPanel's
      // own "Edit" link -- never by mounting EmbedsPanel with hand-built
      // props.
      const editLink = await screen.findByRole('link', { name: 'Edit' });
      fireEvent.click(editLink);
      await screen.findByRole('heading', { name: 'AI track sessions', level: 1 });
    }

    // w7-b/DEC-728 (wave-7 amendment): the H1 is now the embed's own name,
    // matching the frame -- no more "Editing · <name>" h2.
    it('MATCHES: the frame\'s H1 is the embed\'s own name ("AI track sessions"), with the back link and On status above/beside it', async () => {
      verbatimLine(
        1021,
        '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Settings · editing one saved embed</span>',
      );
      await driveIntoEmbedEdit();
      // docs/design/Chautauqua Settings.dc.html:1047 --
      // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">AI track sessions</h1>`
      verbatimLine(1047, '              <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">AI track sessions</h1>');
      const heading = screen.getByRole('heading', { name: 'AI track sessions', level: 1 });
      expect(heading).toBeInTheDocument();
      const panel = heading.closest('.chq-embeds-panel') as HTMLElement;
      expect(within(panel).getByRole('link', { name: '‹ Public pages' })).toBeInTheDocument();
      expect(within(panel).getByText('On')).toBeInTheDocument();
    });

    // w7-b/DEC-728 (wave-7 amendment): the footer now carries all three
    // frame-drawn controls.
    it('MATCHES: the frame\'s footer is "Turn this embed off" + Cancel + Save changes', async () => {
      await driveIntoEmbedEdit();
      // docs/design/Chautauqua Settings.dc.html:1097 --
      // `<a href="#" style="font-size:13px; font-weight:700; color:#565A4B">Turn this embed off</a>`
      verbatimLine(1097, '            <a href="#" style="font-size:13px; font-weight:700; color:#565A4B">Turn this embed off</a>');
      expect(screen.getByRole('button', { name: 'Turn this embed off' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });

    it('MATCHES: the Snippet readout carries a Copy snippet action and a Preview link', async () => {
      await driveIntoEmbedEdit();
      // docs/design/Chautauqua Settings.dc.html:1086 --
      // `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Snippet</span>`
      verbatimLine(1086, '              <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Snippet</span>');
      expect(screen.getByRole('button', { name: 'Copy snippet' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Preview' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :1215 "Settings · save rejected by the server" -- a STATE frame,
  // reached only by driving a real save rejection (DEC-651 wave-24), never
  // by rendering the refusal band directly. HARD CITATION CONSTRAINT
  // (DEC-032 wave-24): every citation below is >=1215 and <=1270 -- no
  // line inside the :1111-1214 "editing your data" deferred extent.
  // ---------------------------------------------------------------------
  describe('frame :1215 "Settings · save rejected by the server"', () => {
    async function driveIntoSaveRejection() {
      mockAllSections({
        [`PATCH /api/v1/events/${EVENT_ID}`]: {
          status: 409,
          body: errorEnvelope('conflict', 'slug already in use'),
        },
      });
      renderAt('/settings?section=event&edit=1');
      const section = await screen.findByRole('region', { name: 'Event' });
      const slugInput = await within(section).findByLabelText('Slug');
      fireEvent.change(slugInput, { target: { value: 'devcon-2027' } });
      fireEvent.click(within(section).getByRole('button', { name: 'Save changes' }));
      await screen.findByText('Nothing was saved');
      return section;
    }

    it('MATCHES verbatim: the refusal band title and body render exactly as the frame draws them', async () => {
      verbatimLine(
        1215,
        '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Settings · save rejected by the server</span>',
      );
      const section = await driveIntoSaveRejection();
      const title = within(section).getByText('Nothing was saved');
      // Both citations sit inside the frame's :1215-1270 extent (never the
      // :1111-1214 deferred "editing your data" range).
      // docs/design/Chautauqua Settings.dc.html:1243 --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:16px; font-weight:700">Nothing was saved</span>`
      verbatimLine(1243, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:700">Nothing was saved</span>');
      expect(title.closest('.chq-settings-refusal-panel')).not.toBeNull();
      // docs/design/Chautauqua Settings.dc.html:1244 --
      // `<span style="font-size:14px; line-height:1.55; color:#3F4237; max-width:64ch">The public URL you chose is already taken by another event in this org. Everything else on this page is fine and is still here.</span>`
      verbatimLine(1244, '          <span style="font-size:14px; line-height:1.55; color:#3F4237; max-width:64ch">The public URL you chose is already taken by another event in this org. Everything else on this page is fine and is still here.</span>');
      expect(
        within(section).getByText(
          'The public URL you chose is already taken by another event in this org. Everything else on this page is fine and is still here.',
        ),
      ).toBeInTheDocument();
    });

    it('DIVERGES-by-wording (structural contract MATCHING): the frame draws ONE refusal band; the tree renders that band AND a second ErrorSummary block with a different heading and "Nothing was lost" wording the frame never draws', async () => {
      const section = await driveIntoSaveRejection();
      // The refusal-panel above is the frame's own band, matched verbatim.
      // Structurally the tree's contract still matches the frame's intent
      // (a page-level "nothing was saved" notice plus a field-level
      // marker) -- but the tree additionally renders a second block, the
      // shared ErrorSummary, whose heading and kept-copy are NOT drawn by
      // the frame at all (a count-driven heading, and "Nothing was lost.
      // Your edits are still below." rather than the frame's own
      // sentence).
      // docs/design/Chautauqua Settings.dc.html:1244 --
      // `<span style="font-size:14px; line-height:1.55; color:#3F4237; max-width:64ch">The public URL you chose is already taken by another event in this org. Everything else on this page is fine and is still here.</span>`
      verbatimLine(1244, '          <span style="font-size:14px; line-height:1.55; color:#3F4237; max-width:64ch">The public URL you chose is already taken by another event in this org. Everything else on this page is fine and is still here.</span>');
      const errorSummary = section.querySelector('.chq-error-summary');
      expect(errorSummary).not.toBeNull();
      expect(within(errorSummary as HTMLElement).getByText('Nothing was lost. Your edits are still below.')).toBeInTheDocument();
      // The refusal-panel and the ErrorSummary are two DISTINCT elements,
      // not one block rendered twice.
      const refusalPanel = section.querySelector('.chq-settings-refusal-panel');
      expect(refusalPanel).not.toBeNull();
      expect(refusalPanel).not.toBe(errorSummary);
    });

    it('MATCHES: unsaved edits survive the refusal -- no refetch, no reset', async () => {
      const section = await driveIntoSaveRejection();
      const slugInput = within(section).getByLabelText('Slug');
      expect(slugInput).toHaveValue('devcon-2027');
    });
  });
});
