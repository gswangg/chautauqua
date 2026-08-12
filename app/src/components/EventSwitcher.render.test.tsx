// w3-d (DEC-378/379): render coverage for the restyled EventSwitcher — the
// .chq-scrim/.chq-modal dialog contract, .chq-field-error on a local
// validation failure, and Escape dismissal via useEscapeKey.
// w1-h (DEC-576): the header control changed from a raw <select> to plain
// text (the current event name) beside a menu button; switching and
// create-event behaviour is unchanged.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EventSwitcher } from './EventSwitcher';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('EventSwitcher', () => {
  it('renders the current event as plain text beside a menu button', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitcher />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Conf')).toBeInTheDocument();
    });
    expect(screen.getByText('Alpha Conf')).toHaveClass('chq-eventswitcher-name');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch event' })).toBeInTheDocument();
  });

  it('the menu button opens a menu listing every event plus "New event…"', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));

    const menu = await screen.findByRole('menu', { name: 'Events' });
    expect(within(menu).getByRole('menuitem', { name: 'Alpha Conf' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Beta Summit' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'New event…' })).toBeInTheDocument();
  });

  it('opening "New event…" from the menu shows the dialog inside a .chq-scrim', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));
    const menu = await screen.findByRole('menu', { name: 'Events' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'New event…' }));

    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    expect(dialog).toHaveClass('chq-scrim');
    expect(dialog.querySelector('.chq-modal')).toBeInTheDocument();
    expect(screen.getByText('New event')).toHaveClass('chq-modal-title');
  });

  it('a local validation failure renders .chq-field-error', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));
    const menu = await screen.findByRole('menu', { name: 'Events' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'New event…' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Create the event' }));

    await waitFor(() => {
      const errors = dialog.querySelectorAll('.chq-field-error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('Escape closes the dialog', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));
    const menu = await screen.findByRole('menu', { name: 'Events' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'New event…' }));

    await screen.findByRole('dialog', { name: 'New event' });
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New event' })).not.toBeInTheDocument();
    });
  });

  // DEC-608: 'New event…' posts to an organizer-only endpoint; a reviewer
  // must never see a control whose only possible outcome is a 403.
  it('hides "New event…" for a reviewer', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));

    const menu = await screen.findByRole('menu', { name: 'Events' });
    expect(within(menu).getByRole('menuitem', { name: 'Alpha Conf' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'New event…' })).not.toBeInTheDocument();
  });

  it('shows "New event…" for an organizer', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));

    const menu = await screen.findByRole('menu', { name: 'Events' });
    expect(within(menu).getByRole('menuitem', { name: 'New event…' })).toBeInTheDocument();
  });
});
