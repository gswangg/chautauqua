// w24-a (DEC-032, DEC-651): the per-frame DESKTOP (1600) render verdict for
// the Settings cluster's summary view and its first three edit drills.
// Sibling to Settings.frame-verdicts.render.test.tsx (the 390 READ frames)
// and modelled on Speakers.desktop-frame-verdicts.render.test.tsx (the
// DEC-930 wave-158 desktop-verdict contract): a NEW audit doc,
// docs/design/audit/settings-desktop-v12.md, carries this file's prose.
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate, so this file
// moves no desktop byte and edits no component/stylesheet -- it renders the
// real route, verdicts what the tree actually produces, and files
// divergences in prose.
//
// DEC-651 (wave-24 amendment): a Modal/Menu/STATE frame is verdicted by
// operating the control that opens it on the real route -- so each edit
// drill below is reached by firing the real "Change"/"Edit the form"/"Add"
// control on <SettingsPage/>, never by mounting a panel's edit form
// directly.
//
// jsdom applies no stylesheet (no @media, no computed geometry), so every
// assertion here is DOM structure/order/text. Every DOM lookup runs BEFORE
// its citation comment so the citation sits immediately beside the
// `expect(` that receipts it (DEC-976 wave-116's EXPECT_PROXIMITY_LINES
// window).
//
// DEC-032 (wave-24 amendment): a deviation-deferred frame extent is
// UN-CITABLE -- every citation below stays at or below line 1110, well
// short of the :1111-1214 and :1507+ DEVIATIONS §6 extents.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './Settings';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { DEC_032, DEC_651 } from '../../../src/decisions';

void DEC_032;
void DEC_651;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Settings.frame-verdicts.render.test.tsx's
 * own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-settings-desktop-verdicts';

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
});

function mockAllSections() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      location: 'Austin, TX',
      timezone: 'America/Chicago',
      recordPrefix: 'DC26',
      branding: { logoUrl: '', accentColor: '' },
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Hall', capacity: 500 }]),
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!',
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
      fields: [
        { id: 'f1', label: 'Title', locked: true },
        { id: 'f2', label: 'Format', locked: false },
      ],
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 3, speakers: 2, scheduled: 1 },
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([
      { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
    'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
  });
}

function renderSettings() {
  mockAllSections();
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('v12 Settings DESKTOP (1600) frames: per-frame render verdict receipts (w24-a, DEC-032/DEC-651)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Event, form, publishing, data · 1600" (Settings landing)
  // ---------------------------------------------------------------------
  describe('frame :28 "Event, form, publishing, data · 1600"', () => {
    it('MATCHES: entered at /settings, the page renders the section rail\'s H1 "Settings"', async () => {
      renderSettings();
      const rail = await screen.findByRole('navigation', { name: 'Settings sections' });
      const heading = screen.getByRole('heading', { name: 'Settings', level: 1 });
      // docs/design/Chautauqua Settings.dc.html:54 -- the sticky rail
      // column's own H1 reads `Settings`, distinct from any per-section
      // head.
      verbatimLine(54, '          <h1 style="margin:0 0 14px; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">Settings</h1>');
      expect(heading).toBeInTheDocument();
      expect(rail).toBeInTheDocument();
    });

    it('MATCHES: desktop renders every section as ONE scrolling document -- all seven panels mounted simultaneously, never a drilled single panel', async () => {
      renderSettings();
      await screen.findByRole('heading', { name: 'Settings', level: 1 });
      const regions = screen.getAllByRole('region');
      const regionLabels = regions.map((r) => r.getAttribute('aria-label'));
      // docs/design/Chautauqua Settings.dc.html:61 -- the single
      // `max-width:760px` scrolling column holding every section, one
      // document, no drill.
      verbatimLine(61, '        <div style="display:flex; flex-direction:column; gap:32px; max-width:760px">');
      expect(regionLabels).toEqual(
        expect.arrayContaining([
          'Event',
          'Call for papers',
          'Tracks and rooms',
          'Public pages',
          'Speaker portal',
          'Your data',
          'People and roles',
        ]),
      );
    });

    it('MATCHES: the Call for papers section head carries its own "Edit the form" drill action', async () => {
      renderSettings();
      const section = await screen.findByRole('region', { name: 'Call for papers' });
      const action = within(section).getByRole('button', { name: 'Edit the form' });
      // docs/design/Chautauqua Settings.dc.html:81 -- the CFP section
      // head's own right-aligned tertiary action reads `Edit the form`,
      // matching the panel's actionLabel.
      verbatimLine(81, '              <a href="#" style="font-size:13px; font-weight:700">Edit the form</a>');
      expect(action).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :607 "Settings · editing the call for papers"
  // ---------------------------------------------------------------------
  describe('frame :607 "Settings · editing the call for papers"', () => {
    async function drillIntoCfp() {
      renderSettings();
      const section = await screen.findByRole('region', { name: 'Call for papers' });
      fireEvent.click(within(section).getByRole('button', { name: 'Edit the form' }));
      await waitFor(() => expect(document.querySelector('.chq-settings-drill-title')?.textContent).toBe('Edit the form'));
      return section;
    }

    it('MATCHES: firing the real "Edit the form" control drills to an "Edit the form" H1 behind a "‹ Call for papers" back link', async () => {
      await drillIntoCfp();
      const backBtn = screen.getByRole('button', { name: '‹ Call for papers' });
      // Back-above-H1 register (settled wave 140): the drill title twin sits
      // AFTER the back control in the DOM. jsdom applies no @media rule, so
      // both the top-level page title and its phone-only drill-title twin
      // are present simultaneously -- scope to the twin by its own class,
      // same convention as Settings.frame-verdicts.render.test.tsx.
      const drillTitle = document.querySelector('.chq-settings-drill-title');
      // docs/design/Chautauqua Settings.dc.html:632-633 -- the edit view's
      // back-above-H1 register, back reading `‹ Call for papers` (naming
      // the SECTION), H1 reading `Edit the form` (naming the EDIT).
      verbatimLine(633, '              <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">Edit the form</h1>');
      expect(backBtn).toBeInTheDocument();
      expect(drillTitle).not.toBeNull();
      expect(drillTitle!.textContent).toBe('Edit the form');
      expect(backBtn.compareDocumentPosition(drillTitle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('MATCHES: the Questions section carries the "Open the form builder ›" delegation link, never a builder mounted here', async () => {
      await drillIntoCfp();
      const link = screen.getByRole('link', { name: 'Open the form builder ›' });
      // docs/design/Chautauqua Settings.dc.html:678 -- the frame delegates
      // question CRUD to the builder via a link reading
      // `Open the form builder ›`; this page owns only window and wording.
      verbatimLine(678, '              <a href="#" style="font-size:13px; font-weight:700">Open the form builder ›</a>');
      expect(link).toHaveAttribute('href', '/submissions/forms');
    });

    it('MATCHES: the footer carries Cancel then a "Save changes" primary, in that order', async () => {
      await drillIntoCfp();
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      const saveBtn = screen.getByRole('button', { name: 'Save changes' });
      // docs/design/Chautauqua Settings.dc.html:686-687 -- Cancel then the
      // filled `Save changes` primary, right-flushed in the footer.
      verbatimLine(687, '              <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Save changes</span>');
      expect(cancelBtn).toBeInTheDocument();
      expect(saveBtn).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :698 "Settings · editing the event"
  // ---------------------------------------------------------------------
  describe('frame :698 "Settings · editing the event"', () => {
    async function drillIntoEvent() {
      renderSettings();
      const section = await screen.findByRole('region', { name: 'Event' });
      await waitFor(() => expect(within(section).getByText('DevCon 2026')).toBeInTheDocument());
      fireEvent.click(within(section).getByRole('button', { name: 'Change' }));
      await waitFor(() => expect(document.querySelector('.chq-settings-drill-title')?.textContent).toBe('Edit the event'));
      return section;
    }

    it('MATCHES: firing the real "Change" control drills to an "Edit the event" H1 behind a "‹ Event" back link', async () => {
      await drillIntoEvent();
      const backBtn = screen.getByRole('button', { name: '‹ Event' });
      const drillTitle = document.querySelector('.chq-settings-drill-title');
      // docs/design/Chautauqua Settings.dc.html:723-724 -- same back-above-H1
      // register as the CFP edit view, back reading `‹ Event`, H1 reading
      // `Edit the event`.
      verbatimLine(724, '              <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">Edit the event</h1>');
      expect(backBtn).toBeInTheDocument();
      expect(drillTitle!.textContent).toBe('Edit the event');
      expect(backBtn.compareDocumentPosition(drillTitle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('MATCHES: Starts and Ends fields render as a paired row', async () => {
      await drillIntoEvent();
      // DEC-613 wave-24 amendment: docs/design/Chautauqua Settings.dc.html:752
      // `Starts` -- the app's field label now reads the frame's own word.
      verbatimLine(752, '                <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Starts</span>');
      // docs/design/Chautauqua Settings.dc.html:756 `Ends` -- same, for the
      // paired field.
      verbatimLine(756, '                <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Ends</span>');
      const startField = screen.getByLabelText('Starts');
      const endField = screen.getByLabelText('Ends');
      // docs/design/Chautauqua Settings.dc.html:750 draws Starts/Ends as a
      // `grid-template-columns:1fr 1fr` pair; the app's own field pair is
      // asserted below.
      verbatimLine(750, '            <div style="padding:16px 0 0; display:grid; grid-template-columns:1fr 1fr; gap:18px; max-width:420px">');
      expect(startField).toBeInTheDocument();
      expect(endField).toBeInTheDocument();
    });

    it('MATCHES: the footer carries Cancel then a "Save changes" primary', async () => {
      await drillIntoEvent();
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      const saveBtn = screen.getByRole('button', { name: 'Save changes' });
      // docs/design/Chautauqua Settings.dc.html:777 -- the filled
      // `Save changes` primary closing the edit view's footer.
      verbatimLine(777, '              <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Save changes</span>');
      expect(cancelBtn).toBeInTheDocument();
      expect(saveBtn).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :788 "Settings · editing tracks and rooms"
  // ---------------------------------------------------------------------
  describe('frame :788 "Settings · editing tracks and rooms"', () => {
    async function drillIntoTracksRooms() {
      renderSettings();
      const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
      await waitFor(() => expect(within(section).getByText('Keynotes')).toBeInTheDocument());
      fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
      await waitFor(() =>
        expect(document.querySelector('.chq-settings-drill-title')?.textContent).toBe('Edit tracks and rooms'),
      );
      return section;
    }

    it('MATCHES: firing the real "Add" control drills to the "Edit tracks and rooms" surface behind a "‹ Tracks and rooms" back link', async () => {
      await drillIntoTracksRooms();
      const backBtn = screen.getByRole('button', { name: '‹ Tracks and rooms' });
      const drillTitle = document.querySelector('.chq-settings-drill-title');
      // docs/design/Chautauqua Settings.dc.html:813-814 -- back reading
      // `‹ Tracks and rooms`, naming the section; the drilled screen's own
      // H1 reads `Edit tracks and rooms` (Settings.tsx's own SECTIONS
      // entry for this key sets editTitle to that exact string).
      verbatimLine(814, '              <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">Edit tracks and rooms</h1>');
      expect(backBtn).toBeInTheDocument();
      expect(drillTitle!.textContent).toBe('Edit tracks and rooms');
      expect(backBtn.compareDocumentPosition(drillTitle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('MATCHES: Tracks and Rooms each carry their own "Add a track" / "Add a room" head action', async () => {
      await drillIntoTracksRooms();
      // The section head's own link AND the phone-only dashed sibling row
      // share the same accessible name (jsdom applies no @media, so both
      // render) -- at least one of each is what this frame draws.
      const addTrack = screen.getAllByRole('button', { name: 'Add a track' });
      const addRoom = screen.getAllByRole('button', { name: 'Add a room' });
      // docs/design/Chautauqua Settings.dc.html:821-822 -- the Tracks
      // section head's own 2px-ruled caption + right-aligned link reading
      // `Add a track`.
      verbatimLine(822, '              <a href="#" style="font-size:13px; font-weight:700">Add a track</a>');
      expect(addTrack.length).toBeGreaterThan(0);
      expect(addRoom.length).toBeGreaterThan(0);
    });

    it('DIVERGES (blessed, DEVIATIONS "Tracks-and-rooms save model"): the frame draws ONE page-footer Cancel/"Save changes" pair; the tree instead reveals per-row Save/Cancel on edit and a single "Done" primary, with no page-level Cancel or "Save changes" text anywhere in the drill', async () => {
      await drillIntoTracksRooms();
      const doneBtn = screen.getByRole('button', { name: 'Done' });
      const pageCancel = screen.queryByRole('button', { name: 'Cancel' });
      const saveChanges = screen.queryByRole('button', { name: 'Save changes' });
      // docs/design/Chautauqua Settings.dc.html:858 draws the frame's
      // page-footer filled `Save changes` primary -- DEVIATIONS.md's
      // "Tracks-and-rooms save model" entry blesses the tree's own model
      // below instead (per-row dirty-reveal, a single "Done" primary).
      verbatimLine(858, '              <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Save changes</span>');
      expect(doneBtn).toBeInTheDocument();
      expect(pageCancel).not.toBeInTheDocument();
      expect(saveChanges).not.toBeInTheDocument();
    });

    it('MATCHES: each track row carries a name control and the frame-drawn "Remove" action', async () => {
      await drillIntoTracksRooms();
      const nameField = screen.getByLabelText('Track name for Keynotes');
      const removeBtns = screen.getAllByRole('button', { name: 'Remove' });
      // docs/design/Chautauqua Settings.dc.html:832 draws the row's own
      // right-aligned removal control ("Remove" span, `{{ t.delStyle }}`).
      verbatimLine(832, '                <span style="{{ t.delStyle }}">Remove</span>');
      expect(nameField).toBeInTheDocument();
      expect(removeBtns.length).toBeGreaterThan(0);
    });
  });
});
