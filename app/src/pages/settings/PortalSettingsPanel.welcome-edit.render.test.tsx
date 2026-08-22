// w9-ri (DEC-919 wave-9 amendment): the Settings · Speaker portal EDIT form
// (docs/design/Chautauqua Settings.dc.html:905-906, 1600 desktop frame)
// gains the frame's boxed static readout of the STORED welcome text above
// the editable `#chq-portal-welcome` textarea, with the frame's persistent
// caption (:906) re-lined once, directly below the readout, no longer
// doubled as the textarea's own field hint. This is a focused receipt
// scoped to the files this task owns (PortalSettingsPanel.tsx,
// settings-drill-rows.css), entered through SettingsPage's real panel
// routing, never by mounting PortalSettingsPanel directly -- same harness
// shape as the sibling PortalSettingsPanel.welcome-390.render.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
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

/** DEC-967 shape, copied from the sibling 390 verdict files' own
 * `verbatimLine`: read the ACTUAL design-file line and assert it
 * byte-for-byte matches the literal this file claims. Pays for this file's
 * own header-block scope declaration above (DEC-998) -- a fully-receipted
 * in-body citation into the SAME desktop frame extent (the 1600px section
 * opened at :873, no width:390px/height:844 line between there and :905),
 * not just a naming reference. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-w9-ri-portal-welcome-edit';

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

function renderPortalEdit(welcomeMessage: string | null) {
  mockPortalSection(welcomeMessage);
  return render(
    <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('Settings · Speaker portal EDIT form: welcome-note readout (w9-ri, DEC-919 wave-9 amendment)', () => {
  it('frame :905 -- renders the boxed readout of the STORED welcome text above the editable textarea', async () => {
    // docs/design/Chautauqua Settings.dc.html:905
    verbatimLine(
      905,
      '              <div style="border:1px solid #BAB6A6; border-radius:4px; background:#FAF8F2; padding:13px; min-height:96px; font-size:15px; line-height:1.65; color:#3F4237">Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.</div>',
    );
    const stored = 'Glad you could make it.\n\nSee you at the podium.';
    renderPortalEdit(stored);
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    await waitFor(() =>
      expect(section.querySelector('.chq-settings-portal-welcome-readout-edit')).toBeInTheDocument(),
    );
    const readout = section.querySelector('.chq-settings-portal-welcome-readout-edit');
    expect(readout).toHaveClass('chq-settings-portal-welcome-readout');
    expect(readout!.textContent).toBe(stored);

    const textarea = within(section).getByLabelText('Welcome note') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe(stored);

    // The readout sits ABOVE the field it mirrors.
    expect(readout!.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('empty stored note renders the readout\'s existing empty treatment, never a blank box', async () => {
    renderPortalEdit(null);
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    await waitFor(() => expect(within(section).getByText('No welcome note set.')).toBeInTheDocument());
    const readout = within(section).getByText('No welcome note set.');
    expect(readout).toHaveClass('chq-settings-portal-welcome-readout');
    expect(readout).toHaveClass('chq-settings-portal-welcome-readout-edit');
  });

  it("the frame's :906 caption renders exactly once, below the readout, no longer doubled as the textarea's hint", async () => {
    renderPortalEdit('Thanks for speaking.');
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    await waitFor(() =>
      expect(section.querySelector('.chq-settings-portal-welcome-readout-edit')).toBeInTheDocument(),
    );
    const captions = within(section).getAllByText('Takes the full measure · appears above the task list');
    expect(captions).toHaveLength(1);
    const readout = section.querySelector('.chq-settings-portal-welcome-readout-edit') as HTMLElement;
    expect(readout.compareDocumentPosition(captions[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('typing in the textarea updates the in-progress value while the readout keeps showing the STORED value', async () => {
    const stored = 'Original stored note.';
    renderPortalEdit(stored);
    const section = screen.getByRole('region', { name: 'Speaker portal' });
    const textarea = await within(section).findByLabelText('Welcome note');
    await waitFor(() =>
      expect(section.querySelector('.chq-settings-portal-welcome-readout-edit')).toHaveTextContent(stored),
    );
    fireEvent.change(textarea, { target: { value: `${stored}!` } });
    expect((textarea as HTMLTextAreaElement).value).toBe(`${stored}!`);
    // The readout mirrors the STORED value, never the in-progress edit.
    expect(section.querySelector('.chq-settings-portal-welcome-readout-edit')).toHaveTextContent(stored);
  });
});
