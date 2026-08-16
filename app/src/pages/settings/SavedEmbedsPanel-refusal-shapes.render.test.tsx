// DEC-856 (wave 67 amendment): SavedEmbedsPanel's PATCH /embeds/:id (Turn
// on/off) reads its fields map by shape -- `enabled` is the only key this
// row's own control owns, and any other key still renders labelled, never
// dropped and never collapsed into the generic panel-level sentence.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SavedEmbedsPanel } from './SavedEmbedsPanel';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-saved-embeds-refusals';

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SavedEmbedsPanel editing />
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

function mockRow() {
  return listEnvelope([
    { id: 'emb1', name: 'Homepage widget', surface: 'sessions', format: 'iframe', options: {}, enabled: true },
  ]);
}

describe('SavedEmbedsPanel refusal shapes (DEC-856)', () => {
  it('a fields map keyed on `enabled` marks the row (a control this panel owns), not the generic sentence', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: mockRow,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`PATCH /api/v1/embeds/emb1`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid saved embed', { enabled: 'Must be true or false' }),
      },
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    const dialog1 = await screen.findByRole('dialog');
    fireEvent.click(within(dialog1).getByRole('button', { name: 'Turn it off' }));

    const message = await screen.findByText('Must be true or false');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveClass('chq-field-error');
    expect(screen.queryByText('Invalid saved embed')).not.toBeInTheDocument();
  });

  it('an unmatched key on the toggle writer renders labelled, not dropped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: mockRow,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`PATCH /api/v1/embeds/emb1`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid saved embed', { surface: 'must be a known public surface' }),
      },
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    const dialog2 = await screen.findByRole('dialog');
    fireEvent.click(within(dialog2).getByRole('button', { name: 'Turn it off' }));

    const message = await screen.findByText('surface: must be a known public surface');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveClass('chq-field-error');
    expect(screen.queryByText('Invalid saved embed')).not.toBeInTheDocument();
  });

  it('a field-less ApiError still renders the sentence', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/embeds`]: mockRow,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`PATCH /api/v1/embeds/emb1`]: {
        status: 500,
        body: errorEnvelope('internal', 'Failed to update saved embed'),
      },
    });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Homepage widget')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    const dialog3 = await screen.findByRole('dialog');
    fireEvent.click(within(dialog3).getByRole('button', { name: 'Turn it off' }));

    expect(await screen.findByText('Failed to update saved embed')).toBeInTheDocument();
  });
});
