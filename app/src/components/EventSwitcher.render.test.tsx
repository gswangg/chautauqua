// w3-d (DEC-378/379): render coverage for the restyled EventSwitcher — the
// .chq-scrim/.chq-modal dialog contract, .chq-field-error on a local
// validation failure, and Escape dismissal via useEscapeKey.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EventSwitcher } from './EventSwitcher';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('EventSwitcher', () => {
  it('renders the current-event select with two events', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitcher />);

    const select = await screen.findByRole('combobox', { name: 'Current event' });
    expect(select).toHaveClass('chq-select');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Alpha Conf', 'Beta Summit', 'New event…']);
  });

  it('opening "New event…" shows the dialog inside a .chq-scrim', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    const select = await screen.findByRole('combobox', { name: 'Current event' });
    fireEvent.change(select, { target: { value: '__new__' } });

    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    expect(dialog).toHaveClass('chq-modal');
    expect(dialog.parentElement).toHaveClass('chq-scrim');
    expect(screen.getByText('New event')).toHaveClass('chq-modal-title');
  });

  it('a local validation failure renders .chq-field-error', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    const select = await screen.findByRole('combobox', { name: 'Current event' });
    fireEvent.change(select, { target: { value: '__new__' } });

    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    // Every field carries `required`, so jsdom's native HTML5 validation
    // blocks the submit event unless all required fields are non-empty.
    // Fill them with values that satisfy `required` but fail the custom
    // slug/timezone checks in validateNewEventForm, to exercise the local
    // (client-side) validation path rather than the native one.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'DevCon' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'Not A Slug' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-06-03' } });
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'Not/A/Zone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      const errors = dialog.querySelectorAll('.chq-field-error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('Escape closes the dialog', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    const select = await screen.findByRole('combobox', { name: 'Current event' });
    fireEvent.change(select, { target: { value: '__new__' } });

    await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New event' })).not.toBeInTheDocument();
    });
  });
});
