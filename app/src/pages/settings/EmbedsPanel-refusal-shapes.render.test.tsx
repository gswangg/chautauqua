// DEC-856 (wave 67 amendment): POST/PATCH /events/:eventId/embeds |
// /embeds/:id throws a fields map keyed by name/surface/format/trackId/
// sessionFormat/roomId/day/q/limit/fields/accent/options. EmbedsPanel must
// route each named key to its own control, render an unmatched key
// labelled (never dropped, never collapsed into err.message), and fall
// back to the sentence only when the fields map is absent or empty.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmbedsPanel } from './EmbedsPanel';
import { mockApi, listEnvelope, errorEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-embeds-refusals';

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <EmbedsPanel />
    </MemoryRouter>,
  );
}

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

function mockEvent() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', name: 'DevCon 2026' },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-42', name: 'Keynotes', color: null }]),
    [`POST /api/v1/events/${EVENT_ID}/embeds`]: {
      status: 400,
      body: errorEnvelope('invalid', 'Invalid embed', {
        trackId: 'Unknown trackId',
        accent: 'accent must be a hex color',
      }),
    },
  });
}

async function fillAndSave() {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
  });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Homepage widget' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save embed' }));
}

describe('EmbedsPanel refusal shapes (DEC-856)', () => {
  it('a fields map keyed on controls this form owns (trackId, accent) marks each control, not the sentence', async () => {
    mockEvent();
    await fillAndSave();

    expect(await screen.findByText('Unknown trackId')).toBeInTheDocument();
    expect(screen.getByText('accent must be a hex color')).toBeInTheDocument();
    expect(screen.queryByText('Invalid embed')).not.toBeInTheDocument();
  });

  it('an unmatched key renders labelled, not dropped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', name: 'DevCon 2026' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/embeds`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid embed', { options: 'options must be an object' }),
      },
    });
    await fillAndSave();

    expect(await screen.findByText('options: options must be an object')).toBeInTheDocument();
    expect(screen.queryByText('Invalid embed')).not.toBeInTheDocument();
  });

  it('a field-less ApiError still renders the sentence', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', name: 'DevCon 2026' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/embeds`]: {
        status: 500,
        body: errorEnvelope('internal', 'Failed to save embed'),
      },
    });
    await fillAndSave();

    expect(await screen.findByText('Failed to save embed')).toBeInTheDocument();
  });
});
