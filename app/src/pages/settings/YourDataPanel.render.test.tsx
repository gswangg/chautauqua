// w3-d/DEC-747 read view; SummarySection adoption w6-e/DEC-815:
// YourDataPanel is a read-only summary (SummarySection) -- Exports, API
// tokens, API docs (link stays visible) and Import from Sessionboard --
// until the 'Change' action drills into (?section=your-data&edit=1) the
// live exports/tokens/import surfaces.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { YourDataPanel } from './YourDataPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-your-data';

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

function mockYourData(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026' },
    'GET /api/v1/tokens': listEnvelope([]),
    ...overrides,
  });
}

describe('YourDataPanel', () => {
  // DEC-815 amendment (wave 4): the read view LISTS its sets at rest
  // (exports as real links, tokens as real rows) rather than describing
  // them in a sentence; only creation/import controls stay behind Change.
  it('renders a read-only summary that lists the real exports and tokens, with no creation/import control before edit', async () => {
    mockYourData({
      'GET /api/v1/tokens': listEnvelope([
        { id: 'tok-1', name: 'CI pipeline', tokenPrefix: 'chq_abc', lastUsedAt: null },
      ]),
    });
    render(
      <MemoryRouter>
        <YourDataPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Your data' });
    expect(within(section).getByRole('heading', { name: 'Your data' })).toBeInTheDocument();
    expect(within(section).getByText('Exports')).toBeInTheDocument();
    expect(within(section).getByText('API tokens')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'chautauqua.cc/docs/api' })).toHaveAttribute(
      'href',
      '/docs/api',
    );
    expect(within(section).getByText('Import from Sessionboard')).toBeInTheDocument();

    expect(within(section).getByRole('link', { name: 'Submissions CSV' })).toHaveAttribute(
      'href',
      `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
    );
    expect(within(section).getByRole('link', { name: 'Contacts CSV' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Everything JSON' })).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'More export formats' })).not.toBeInTheDocument();

    expect(await within(section).findByText('CI pipeline')).toBeInTheDocument();
    expect(within(section).getByText('Last used: Never')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'New token' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();

    expect(
      within(section).queryByRole('button', { name: 'Import from Sessionboard' }),
    ).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('drills into the live exports/tokens/import surfaces via Change', async () => {
    mockYourData();
    render(
      <MemoryRouter>
        <YourDataPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Your data' });
    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(within(section).getByRole('link', { name: 'Submissions CSV' })).toHaveAttribute(
        'href',
        `/api/v1/events/${EVENT_ID}/export/submissions?format=csv`,
      );
    });
    expect(within(section).getByRole('link', { name: 'Contacts CSV' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Everything JSON' })).toBeInTheDocument();
    // The section's OWN drill action is gone; ApiTokensPanel now mounts
    // with its own local read/edit split (w1-f, DEC-785), whose rest-state
    // 'Change' is a different, further drill.
    expect(section.querySelector('.chq-settings-section-action')).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Import from Sessionboard' }));
    expect(within(section).getByRole('heading', { name: 'Import from Sessionboard' })).toBeInTheDocument();
  });
});
