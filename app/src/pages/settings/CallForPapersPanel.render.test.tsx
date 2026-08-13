// DEC-781 render smoke test: CallForPapersPanel is a read-only summary
// (public link, Closes with its relative note, custom questions) with the
// existing intro/open/close/tracks form living behind the 'Edit the form'
// drill (?section=cfp&edit=1, DEC-728/DEC-710).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
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

function mockCfp(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: 1767225600000, // 2026-01-01T00:00:00Z
      closeDate: 1769904000000, // 2026-02-01T00:00:00Z
      tracks: ['trk1'],
      fields: [
        { id: 'f1', label: 'Title', locked: true },
        { id: 'f2', label: 'Format', locked: false },
        { id: 'f3', label: 'Audience level', locked: false },
      ],
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
      { id: 'trk1', name: 'Keynotes' },
      { id: 'trk2', name: 'Workshops' },
    ]),
    ...overrides,
  });
}

describe('CallForPapersPanel', () => {
  it('renders a read-only summary with the public link, the closes date + CLOSED note, and the custom question count', async () => {
    mockCfp();
    render(
      <MemoryRouter>
        <CallForPapersPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Call for papers' });
    expect(within(section).getByRole('heading', { name: 'Call for papers' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Edit the form' })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(section).getByText(`${window.location.origin}/submit/devcon-2026`)).toBeInTheDocument();
    });
    expect(within(section).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      `${window.location.origin}/submit/devcon-2026`,
    );

    // Closes row: past window (Jan-Feb 2026) relative to the test clock, so
    // the derived relative note reads CLOSED -- driven by the same
    // formWindowState the live gate uses.
    expect(within(section).getByText('CLOSED')).toBeInTheDocument();

    // Custom questions: only the two non-locked fields count, the locked
    // built-in 'Title' field is excluded.
    expect(within(section).getByText('2 — Format, Audience level')).toBeInTheDocument();

    // Summary view: no editable form fields yet.
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('drills into the existing intro/open/close/tracks form via the Edit the form action, and Save returns to the summary', async () => {
    mockCfp();
    render(
      <MemoryRouter>
        <CallForPapersPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Call for papers' });
    await waitFor(() => {
      expect(within(section).getByText(`${window.location.origin}/submit/devcon-2026`)).toBeInTheDocument();
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Edit the form' }));

    await waitFor(() => {
      expect(within(section).getByDisplayValue('Tell us about your talk.')).toBeInTheDocument();
    });
    expect(within(section).getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(within(section).getByDisplayValue('2026-02-01')).toBeInTheDocument();
    expect(within(section).getByText('Closed')).toBeInTheDocument();
    const keynotes = within(section).getByRole('button', { name: 'Keynotes' });
    expect(keynotes).toHaveAttribute('aria-pressed', 'true');
    expect(within(section).getByRole('button', { name: 'Workshops' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(section).queryByRole('button', { name: 'Edit the form' })).not.toBeInTheDocument();

    mockCfp({
      [`PATCH /api/v1/forms/form1`]: {
        id: 'form1',
        eventId: EVENT_ID,
        intro: 'Updated intro.',
        openDate: 1767225600000,
        closeDate: 1769904000000,
        tracks: ['trk1'],
        fields: [
          { id: 'f1', label: 'Title', locked: true },
          { id: 'f2', label: 'Format', locked: false },
          { id: 'f3', label: 'Audience level', locked: false },
        ],
      },
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Edit the form' })).toBeInTheDocument();
    });
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
  });
});
