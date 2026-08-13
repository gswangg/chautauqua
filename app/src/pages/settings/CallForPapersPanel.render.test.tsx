// DEC-588 render smoke test: CallForPapersPanel loads the event's default
// CFP form and its offered tracks, and shows a copyable public submit URL.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CallForPapersPanel } from './CallForPapersPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-cfp-render';

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

function mockCfp() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: 1767225600000, // 2026-01-01T00:00:00Z
      closeDate: 1769904000000, // 2026-02-01T00:00:00Z
      tracks: ['trk1'],
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
      { id: 'trk1', name: 'Keynotes' },
      { id: 'trk2', name: 'Workshops' },
    ]),
  });
}

describe('CallForPapersPanel', () => {
  it('renders the rail heading, the loaded intro, and the copyable public submit URL', async () => {
    mockCfp();
    render(<CallForPapersPanel />);

    expect(screen.getByRole('heading', { name: 'Call for papers' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tell us about your talk.')).toBeInTheDocument();
    });

    expect(screen.getByText(`${window.location.origin}/submit/devcon-2026`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      `${window.location.origin}/submit/devcon-2026`,
    );
    expect(screen.getByRole('link', { name: 'Edit the form' })).toHaveAttribute(
      'href',
      '/admin/submissions/forms',
    );

    // Date-only fields render via the app's day-label helpers, never
    // toISOString directly.
    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-02-01')).toBeInTheDocument();

    // DEC-731: the call's live state, derived from open/close dates -- this
    // fixture's window (Jan-Feb 2026) is in the past relative to the test
    // clock, so the derived state is "Closed".
    expect(screen.getByText('Closed')).toBeInTheDocument();

    // Offered tracks: the one already on the form is selected.
    const keynotes = screen.getByRole('button', { name: 'Keynotes' });
    expect(keynotes).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Workshops' })).toHaveAttribute('aria-pressed', 'false');
  });
});
