// w3-d (DEC-378/379): render coverage for the restyled EventSwitcher — the
// .chq-scrim/.chq-modal dialog contract, .chq-field-error on a local
// validation failure, and Escape dismissal via useEscapeKey.
// w1-h (DEC-576): the header control changed from a raw <select> to plain
// text (the current event name) beside a menu button; switching and
// create-event behaviour is unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EventSwitcher } from './EventSwitcher';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVENT_SWITCHER_CSS = readFileSync(join(HERE, 'event-switcher.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

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

  it('a local validation failure renders a FormRow error', async () => {
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
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'DevCon' } });
    fireEvent.change(screen.getByLabelText(/^Slug/), { target: { value: 'Not A Slug' } });
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: '2026-06-03' } });
    fireEvent.change(screen.getByLabelText(/^Time zone/), { target: { value: 'Not/A/Zone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the event' }));

    await waitFor(() => {
      const errors = dialog.querySelectorAll('.chq-form-row-error');
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

  // w5-a (DEC-806/807): the name + caret read as ONE quiet control — no
  // resting border on the menu button (it must not out-frame the plain-text
  // name beside it), border + surface-sunk appearing only on :hover and
  // while the menu is open (aria-expanded).
  it('event-switcher.css: the menu button carries no resting border, only on hover/aria-expanded', () => {
    const restBody = topLevelRuleBody(EVENT_SWITCHER_CSS, '.chq-eventswitcher-menu-btn');
    expect(restBody).not.toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(restBody).toMatch(/border:\s*1px solid transparent/);

    const activeRuleMatch = EVENT_SWITCHER_CSS.match(
      /\.chq-eventswitcher-menu-btn:hover,\s*\n\.chq-eventswitcher-menu-btn\[aria-expanded='true'\]\s*\{([^}]*)\}/
    );
    const activeBody = activeRuleMatch?.[1];
    expect(activeBody).toBeDefined();
    expect(activeBody).toMatch(/border-color:\s*var\(--chq-border\)/);
    expect(activeBody).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
  });

  it('the menu button carries aria-expanded, flipping true when the menu opens', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    const menuBtn = screen.getByRole('button', { name: 'Switch event' });
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
  });

  // DEC-969: EventSwitcher's menu adopts the shared useMenu primitive --
  // an outside pointerdown dismisses it, ArrowDown moves focus to the next
  // item, and Escape returns focus to the trigger.
  it('DEC-969: a pointerdown on the document body closes the open menu', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));
    await screen.findByRole('menu', { name: 'Events' });

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: 'Events' })).not.toBeInTheDocument();
    });
  });

  it('DEC-969: ArrowDown moves focus to the next item', async () => {
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
    const first = within(menu).getByRole('menuitem', { name: 'Alpha Conf' });
    const second = within(menu).getByRole('menuitem', { name: 'Beta Summit' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    expect(second).toHaveFocus();
  });

  it('DEC-969: Escape returns focus to the trigger', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    const trigger = screen.getByRole('button', { name: 'Switch event' });
    fireEvent.click(trigger);
    await screen.findByRole('menu', { name: 'Events' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: 'Events' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
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
