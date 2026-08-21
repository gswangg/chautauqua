// w15-tf (DEC-781 wave-159): the Settings · Speaker portal 390 drill's
// Welcome note row renders the stored `welcomeMessage` verbatim inside the
// frame's boxed readout (docs/design/Chautauqua Settings.dc.html:510,
// Welcome note block at :516-518), not a paragraph-count summary of it. That
// build already landed in wave 157 (DEC-919 clause (a),
// PortalSettingsPanel.tsx / settings-drill-rows.css) and is receipted by
// Settings.frame-verdicts.render.test.tsx's `:510` case; this file is a
// second, focused receipt scoped to the files this task owns, entered
// through SettingsPage's real panel routing the same way, never by
// mounting PortalSettingsPanel directly. jsdom applies no stylesheet (no
// @media), so assertions here are about DOM STRUCTURE, never computed
// geometry -- consistent with the sibling frame-verdicts file this copies
// its `verbatimLine` helper from.
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

const EVENT_ID = 'evt-w15-tf-portal-welcome';

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

function mockPortalSection(welcomeMessage: string | null) {
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
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage,
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
    'GET /api/v1/tokens': listEnvelope([{ id: 'tok1', name: 'CI pipeline', tokenPrefix: 'chq_abcd', lastUsedAt: null }]),
  });
}

function renderPortalDrill(welcomeMessage: string | null) {
  mockPortalSection(welcomeMessage);
  return render(
    <MemoryRouter initialEntries={['/settings?section=portal']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('Settings · Speaker portal 390 drill: Welcome note row (w15-tf, DEC-781 wave-159)', () => {
  it('frame :510 Welcome note block -- renders the stored note verbatim in the boxed readout, not a paragraph count', async () => {
    // :516-518, the Welcome note label + boxed readout this row draws.
    verbatimLine(507, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Speaker portal</span>");
    const note = 'Glad you could make it.\n\nSee you at the podium.';
    renderPortalDrill(note);
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    // getByText normalizes whitespace by default, so match by class and
    // assert the RAW textContent (including the blank line) verbatim --
    // the readout box does not collapse the note's paragraph breaks.
    await waitFor(() =>
      expect(section.querySelector('.chq-settings-portal-welcome-readout')).toBeInTheDocument(),
    );
    const readout = section.querySelector('.chq-settings-portal-welcome-readout');
    expect(readout).not.toBeNull();
    expect(readout!.textContent).toBe(note);
  });

  it('keeps the paragraph-count summary mounted unchanged for desktop/index (CSS decides visibility, DEC-919 wave-99)', async () => {
    renderPortalDrill('One paragraph.\n\nTwo paragraph.');
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    await waitFor(() =>
      expect(within(section).getByText(/Shown above the task list · 2 paragraphs/)).toBeInTheDocument(),
    );
  });

  it('empty welcome note keeps the panel\'s existing empty treatment in the readout, not a fabricated summary', async () => {
    renderPortalDrill(null);
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    await waitFor(() => expect(within(section).getByText('No welcome note set.')).toBeInTheDocument());
    const readout = within(section).getByText('No welcome note set.');
    expect(readout).toHaveClass('chq-settings-portal-welcome-readout');
    expect(within(section).getByText(/Shown above the task list · 0 paragraphs/)).toBeInTheDocument();
  });
});
