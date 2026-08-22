// w30-f (DEC-976, DEC-385): SETTINGS · CALL FOR PAPERS · 390 frame verdict.
// Mounts the REAL CallForPapersPanel through SettingsPage's actual
// `?section=cfp` route (mirror of
// PortalSettingsPanel.welcome-390.render.test.tsx's harness shape), and
// grades the phone drill anatomy docs/design/Chautauqua Settings.dc.html
// draws at :444-477 ('Settings · Call for papers'): the `‹ Settings` back
// control + `Call for papers` drill title, the Public link readout + Copy
// link pill, the Closes readout + relative countdown chip beside it (not
// a new row), the Questions · N cap + one row per custom question, and
// the 44px floor on every interactive element the frame draws in this
// drill. jsdom applies no stylesheet (no @media), so assertions here are
// about DOM STRUCTURE/inline min-height, never computed geometry --
// consistent with the sibling frame verdict files this copies its
// `verbatimLine` helper from.
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

/** Copied verbatim from Settings.frame-verdicts.render.test.tsx's own
 * `verbatimLine` (DEC-967 shape: a citation that can never silently rot to
 * a wrong line the way a bare `:line` reference can). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-w30-f-cfp-390';

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

function mockCfpDrill() {
  const now = Date.now();
  const closeMs = now + 6 * 24 * 60 * 60 * 1000; // ~6 days out, matches frame's 'In 6 days'
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devflow-conf-2027',
      name: 'DevFlow Conf 2027',
      startDate: '2027-09-01',
      endDate: '2027-09-03',
      location: 'Austin, TX',
      timezone: 'UTC',
      recordPrefix: 'DF27',
      branding: { logoUrl: '', accentColor: '' },
    },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form-w30-f',
      eventId: EVENT_ID,
      title: 'Speak at DevFlow',
      intro: 'Tell us about your talk.',
      openDate: now - 30 * 24 * 60 * 60 * 1000,
      closeDate: closeMs,
      tracks: ['trk1'],
      fields: [
        { id: 'f0', label: 'Title', locked: true, kind: 'text', required: true },
        { id: 'f1', label: 'Talk abstract', locked: false, kind: 'longtext', required: true },
        { id: 'f2', label: 'Format', locked: false, kind: 'dropdown', required: false },
      ],
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes' }]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 4 }),
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
  });
}

function renderCfpDrill() {
  mockCfpDrill();
  return render(
    <MemoryRouter initialEntries={['/settings?section=cfp']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('Settings · Call for papers 390 drill', () => {
  it('frame :441 anchor -- renders the ‹ Settings back control and the Call for papers drill title', async () => {
    // docs/design/Chautauqua Settings.dc.html:441
    verbatimLine(
      441,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Settings · Call for papers</span>',
    );
    renderCfpDrill();
    // docs/design/Chautauqua Settings.dc.html:444-477 `<div style="width:390px;` --
    // the drill's own frame extent this describe block grades.
    await waitFor(() =>
      expect(document.querySelector('.chq-settings-drill-title')).toHaveTextContent('Call for papers'),
    );
    const back = screen.getByRole('button', { name: '‹ Settings' });
    expect(back).toBeInTheDocument();
  });

  it('frame :453 -- renders the Public link readout and the full-width 44px Copy link pill', async () => {
    // docs/design/Chautauqua Settings.dc.html:453
    verbatimLine(
      453,
      '          <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; margin-top:4px">Copy link</span>',
    );
    renderCfpDrill();
    const section = await screen.findByRole('region', { name: 'Call for papers' });
    // data readout -- graded by shape (submit URL), never a hardcoded literal.
    await waitFor(() =>
      expect(within(section).getByText(/^https?:\/\/.+\/submit\/devflow-conf-2027$/)).toBeInTheDocument(),
    );
    const copyBtn = within(section).getByRole('button', { name: 'Copy link' });
    expect(copyBtn).toHaveClass('chq-settings-cfp-copy-btn');
  });

  it('frame :457-458 -- Closes readout (date, `, ` separator, time) with the relative chip beside the row, not a new row', async () => {
    // docs/design/Chautauqua Settings.dc.html:457
    verbatimLine(
      457,
      '          <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 13px; font-size:14px">16 Aug 2026, 23:59</div>',
    );
    // docs/design/Chautauqua Settings.dc.html:458
    verbatimLine(
      458,
      '          <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase">In 6 days</span>',
    );
    renderCfpDrill();
    const section = await screen.findByRole('region', { name: 'Call for papers' });
    const closesLabel = await within(section).findByText('Closes');
    // Same row: label, absolute readout, and relative chip all live under
    // one row container (`chq-settings-drill-field-row`), not a sibling
    // row of their own -- the frame draws the chip beside Closes, not
    // below it as its own labelled row.
    const closesRow = closesLabel.closest('.chq-settings-drill-field-row');
    expect(closesRow).not.toBeNull();
    // Absolute datetime -- graded by shape: a date, a literal `, ` and a
    // time, never the frame's sample date/time (data).
    await waitFor(() =>
      expect(within(closesRow as HTMLElement).getByText(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/)).toBeInTheDocument(),
    );
    // Relative countdown chip, uppercased "IN N DAYS" shape per
    // CallForPapersPanel.tsx's `countOf` + `.toUpperCase()` build, present
    // inside the SAME row as the Closes readout.
    expect(within(closesRow as HTMLElement).getByText(/^IN \d+ DAYS?$/)).toBeInTheDocument();
  });

  it('frame :461/:462-477 -- Questions · N cap and one row per custom question with its {{ type }} · {{ req }} meta and Edit control', async () => {
    // docs/design/Chautauqua Settings.dc.html:463
    verbatimLine(463, '        <sc-for list="{{ formQuestions }}" as="q" hint-placeholder-count="8">');
    renderCfpDrill();
    const section = await screen.findByRole('region', { name: 'Call for papers' });
    // Two non-locked custom questions in the mock -> "Questions · 2".
    await waitFor(() => expect(within(section).getByText('Questions · 2')).toBeInTheDocument());
    const rows = within(section).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // {{ q.type }} · {{ q.req }} meta shape -- graded by shape, never a
      // seeded label.
      expect(within(row).getByText(/^.+ · (Required|Optional)$/)).toBeInTheDocument();
      const editControl = within(row).getByRole('link', { name: 'Edit' });
      expect(editControl).toBeInTheDocument();
    }
  });

  it('44px floor: every interactive element the frame draws in this drill has min-height:44px, centred flex, and horizontal padding', async () => {
    renderCfpDrill();
    const section = await screen.findByRole('region', { name: 'Call for papers' });
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Copy link' })).toBeInTheDocument());
    const copyBtn = within(section).getByRole('button', { name: 'Copy link' });
    const editControls = within(section).getAllByRole('link', { name: 'Edit' });
    // jsdom applies no stylesheet, so this asserts the CLASS HOOKS the
    // phone @media rules key their min-height:44px+flex-center+padding
    // floor on (settings.css, run-only per this lane's hard file ban),
    // never computed geometry.
    expect(copyBtn.className).toMatch(/chq-settings-cfp-copy-btn|chq-link-button/);
    for (const control of editControls) {
      expect(control.className).toMatch(/chq-settings-inline-action/);
    }
  });
});
