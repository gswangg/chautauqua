// DEC-919 wave-45 amendment (this file's pin, clause (d)): the Event 390
// READ drill's footer band draws exactly ONE control ("Save", re-lined onto
// `?section=event&edit=1`) and the screen carries exactly ONE back-
// affordance to the section index ("‹ Settings") -- "Cancel" is ruled
// permanently unbuilt, not "still unbuilt": it has neither state to
// discard (a read view holds no form) nor a destination of its own, and
// its only possible destination -- the section index -- is already
// reached by this same back link. This is a RULING pin, not a DEVIATIONS
// entry: no override of the pack is being sought, the drawn control is
// satisfied at the composition level by the back link the same frame
// draws. Mounted through Settings.tsx's real routing (never the panel
// directly) so the back link -- which SettingsPage owns, not
// EventSettingsPanel -- is on screen to count.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../Settings';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');

// DEC-967 shape, copied from Settings.frame-verdicts.render.test.tsx's own
// helper: read the ACTUAL line, assert it byte-for-byte matches the
// literal this file claims.
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-settings-event-readdrill';

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

// SettingsPage's read mode (no `edit=1`) mounts all seven section panels at
// once (Settings.tsx`const sectionsToRender = editingSection ? [editingSection] : SECTIONS;`)
// -- desktop keeps all seven visible, phone CSS narrows to one, and jsdom
// applies no @media rule, so every panel's own data dependency must be
// mocked even though this test only asserts on the Event region.
function mockAllSections() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'readdrill-2026',
      name: 'ReadDrill Con',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      location: 'Austin, TX',
      timezone: 'America/Chicago',
      recordPrefix: 'RD26',
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
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [],
    },
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 0, speakers: 0, scheduled: 0 },
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
    'GET /api/v1/tokens': listEnvelope([]),
    'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
  });
}

function renderEventReadDrill() {
  mockAllSections();
  return render(
    <MemoryRouter initialEntries={['/settings?section=event']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('Settings · Event 390 read drill (DEC-919 wave-45)', () => {
  it('draws exactly one footer control ("Save") -- "Cancel" stays permanently unbuilt', async () => {
    verbatimLine(
      335,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save</span>',
    );
    verbatimLine(
      336,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Cancel</span>',
    );

    renderEventReadDrill();
    const section = await screen.findByRole('region', { name: 'Event' });
    await waitFor(() => expect(within(section).getByText('ReadDrill Con')).toBeInTheDocument());

    // The frame's footer band (:334-337) draws a filled "Save" beside a
    // bordered "Cancel". The read drill renders only the half with a
    // destination -- exactly one node carries the footer-primary class,
    // and no "Cancel" text exists anywhere in the section.
    const footerPrimaries = within(section).getAllByRole('button', { name: 'Save' });
    expect(footerPrimaries).toHaveLength(1);
    expect(footerPrimaries[0]).toHaveClass('chq-settings-drillrow-footer-primary');
    expect(within(section).queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('carries exactly one back-affordance to the section index -- Cancel\'s only possible destination is already reached by it', async () => {
    verbatimLine(
      318,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>',
    );

    renderEventReadDrill();
    await screen.findByRole('region', { name: 'Event' });

    // Settings.tsx renders one global back control, not one per section --
    // the same "‹ Settings" node the frame draws above the H1 (:318) is
    // the section index's only entry point on this screen, and it is the
    // destination Cancel would have opened had it been built.
    const backAffordances = screen.getAllByRole('button', { name: '‹ Settings' });
    expect(backAffordances).toHaveLength(1);
  });
});
