// w3-d (DEC-378/379): render coverage for the restyled EventSwitcher — the
// .chq-scrim/.chq-modal dialog contract, .chq-field-error on a local
// validation failure, and Escape dismissal via useEscapeKey.
// w1-h (DEC-576): the header control changed from a raw <select> to plain
// text (the current event name) beside a menu button; switching and
// create-event behaviour is unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EventSwitcher } from './EventSwitcher';
import { resetEventsCacheForTests } from '../lib/useCurrentEvent';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVENT_SWITCHER_CSS = readFileSync(join(HERE, 'event-switcher.css'), 'utf-8');
const MODAL_FRAME_CSS = readFileSync(join(HERE, 'modal-frame.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  // DEC-024 amendment (wave 51): loadEventsOnce()'s cache is scoped to one
  // real page load (a full navigation) -- a render test suite doesn't get
  // that between `it()` blocks in this file.
  resetEventsCacheForTests();
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

  // DEC-370 amendment (wave 5): modal chrome -- near-black head rule, 23px
  // title, distinct Starts/Ends placeholders, and Venue drops its
  // "· optional" suffix + "Optional" placeholder.
  it('renders the amended modal chrome and field placeholders', async () => {
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

    expect(screen.getByLabelText(/^Starts/)).toHaveAttribute('placeholder', '11 May 2028');
    expect(screen.getByLabelText(/^Ends/)).toHaveAttribute('placeholder', '13 May 2028');

    const venueLabel = screen.getByText('Venue');
    expect(venueLabel.textContent).toBe('Venue');
    const venueInput = screen.getByLabelText('Venue');
    expect(venueInput).not.toHaveAttribute('placeholder', 'Optional');

    expect(screen.getByRole('button', { name: 'Create the event' })).toHaveClass('chq-eventswitcher-create-btn');

    // Pin the modal-frame.css head-rule/title rules and the create button's
    // width rule directly against the stylesheets (jsdom doesn't apply
    // external CSS layout).
    expect(topLevelRuleBody(MODAL_FRAME_CSS, '.chq-modal .chq-modal-head')).toMatch(/border-bottom-color:\s*var\(--chq-ink\)/);
    expect(topLevelRuleBody(MODAL_FRAME_CSS, '.chq-modal .chq-modal-title')).toMatch(/font-size:\s*23px/);
    expect(topLevelRuleBody(EVENT_SWITCHER_CSS, '.chq-eventswitcher-create-btn')).toMatch(/width:\s*144px/);
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

  // DEC-978: GET /api/v1/events is requireOrganizer server-side -- a
  // reviewer session must never issue that request (it would 403 on first
  // paint of every admin route), and since the switcher's only actions
  // (switching/creating events) are impossible for a reviewer, the control
  // itself renders nothing (the same conditional-and-quiet rule already
  // applied to 'New event…').
  it('DEC-978: issues no /events request and renders nothing for a reviewer', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    const { container } = render(<EventSwitcher />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/me'),
        expect.anything(),
      );
    });

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/events'),
      expect.anything(),
    );
  });

  // DEC-978: a gate must not act while identity is still loading.
  it('DEC-978: issues no /events request while identity is loading', () => {
    const fetchMock = vi.fn(() => new Promise(() => {})); // never resolves -- `me` stays loading
    vi.stubGlobal('fetch', fetchMock);

    render(<EventSwitcher />);

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/events'),
      expect.anything(),
    );
  });

  it('DEC-978: fetches /events once identity resolves to organizer', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/events'),
      expect.anything(),
    );
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

  // w6-h (DEC-369 amendment): the 24x23 caret-only button used to hold the
  // focus ring around bare ink; the focusable control is now the name+
  // caret GROUP, so the ring frames the whole visible control.
  // G13: the >=44px tap floor stays, but on PHONE only (DEC-367 wave-57,
  // docs/design/README.md:92) -- at desktop it made this button the tallest
  // thing in .chq-header and drove the admin header to 75px against the
  // 59.5px every admin frame draws. Both halves are asserted: absent from
  // the base rule, present in the phone block.
  it('the focusable "Switch event" control wraps both the event name and the caret, with the >=44px tap floor scoped to phone', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    render(<EventSwitcher />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    const trigger = screen.getByRole('button', { name: 'Switch event' });
    expect(within(trigger).getByText('Alpha Conf')).toHaveClass('chq-eventswitcher-name');
    expect(trigger.querySelector('.chq-eventswitcher-caret')).toBeInTheDocument();

    expect(topLevelRuleBody(EVENT_SWITCHER_CSS, '.chq-eventswitcher-menu-btn')).not.toMatch(/min-height/);
    const phoneBlock = EVENT_SWITCHER_CSS.slice(EVENT_SWITCHER_CSS.indexOf('@media (max-width: 700px)'));
    expect(phoneBlock).toMatch(/\.chq-eventswitcher-menu-btn\s*\{[^}]*min-height:\s*44px/);
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
