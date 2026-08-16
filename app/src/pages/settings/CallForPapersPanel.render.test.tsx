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
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 4 }),
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
    expect(within(section).getByDisplayValue('1 Jan 2026')).toBeInTheDocument();
    expect(within(section).getByDisplayValue('1 Feb 2026')).toBeInTheDocument();
    expect(within(section).getByText('Closed')).toBeInTheDocument();
    const keynotes = within(section).getByRole('button', { name: 'Keynotes' });
    expect(keynotes).toHaveAttribute('aria-pressed', 'true');
    expect(within(section).getByRole('button', { name: 'Workshops' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(section).queryByRole('button', { name: 'Edit the form' })).not.toBeInTheDocument();

    // DEC-888: no native <fieldset>/<legend> remains in the tracks block --
    // the settings row grammar (label ‖ value) replaces it.
    expect(section.querySelector('fieldset')).toBeNull();
    expect(section.querySelector('legend')).toBeNull();
    expect(within(section).getByText('Tracks offered')).toBeInTheDocument();

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

    fireEvent.click(within(section).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Edit the form' })).toBeInTheDocument();
    });
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders the no-tracks hint beneath the chipstrip, inside the value column, when the event has no tracks', async () => {
    mockCfp({ [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]) });
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
      expect(within(section).getByText('No tracks configured for this event yet.')).toBeInTheDocument();
    });
    const hint = within(section).getByText('No tracks configured for this event yet.');
    expect(hint).toHaveClass('chq-settings-row-hint');
    const valueColumn = hint.closest('.chq-settings-row-value');
    expect(valueColumn).not.toBeNull();
    expect(valueColumn!.querySelector('.chq-chipstrip')).not.toBeNull();
    expect(section.querySelector('fieldset')).toBeNull();
  });

  // DEC-731 amendment: exactly one window action renders, chosen by the
  // call's current live state -- never both side by side.
  it('renders only "Open the call now" when the call is closed', async () => {
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
      expect(within(section).getByRole('button', { name: 'Open the call now' })).toBeInTheDocument();
    });
    expect(within(section).queryByRole('button', { name: 'Close the call now' })).not.toBeInTheDocument();
  });

  it('renders only "Open the call now" when the call is not yet open', async () => {
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365 * 50;
    mockCfp({
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form1',
        eventId: EVENT_ID,
        intro: 'Tell us about your talk.',
        openDate: farFuture,
        closeDate: farFuture + 1000 * 60 * 60 * 24 * 7,
        tracks: ['trk1'],
        fields: [{ id: 'f1', label: 'Title', locked: true }],
      },
    });
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
      expect(within(section).getByRole('button', { name: 'Open the call now' })).toBeInTheDocument();
    });
    expect(within(section).queryByRole('button', { name: 'Close the call now' })).not.toBeInTheDocument();
  });

  it('renders only "Close the call now" when the call is open', async () => {
    const now = Date.now();
    mockCfp({
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form1',
        eventId: EVENT_ID,
        intro: 'Tell us about your talk.',
        openDate: now - 1000 * 60 * 60 * 24,
        closeDate: now + 1000 * 60 * 60 * 24 * 30,
        tracks: ['trk1'],
        fields: [{ id: 'f1', label: 'Title', locked: true }],
      },
    });
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
      expect(within(section).getByRole('button', { name: 'Close the call now' })).toBeInTheDocument();
    });
    expect(within(section).queryByRole('button', { name: 'Open the call now' })).not.toBeInTheDocument();
  });

  // DEC-896 amendment (wave 26): the shared settings edit shell.
  describe('edit view shell (DEC-896)', () => {
    it('renders the footer as destructive-then-secondary-then-primary in DOM order, no full-width buttons, and the consequence line', async () => {
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
        expect(within(section).getByText(/submissions received/)).toBeInTheDocument();
      });
      expect(within(section).getByText('4 submissions received · changes do not affect them')).toBeInTheDocument();

      const footer = section.querySelector('.chq-settings-edit-footer') as HTMLElement;
      expect(footer).not.toBeNull();
      // No destructive control on this panel -- only secondary then primary.
      expect(footer.querySelector('.chq-settings-edit-footer-destructive')).toBeNull();
      const secondaryButton = within(footer).getByRole('button', { name: 'Cancel' });
      const primaryButton = within(footer).getByRole('button', { name: 'Save changes' });
      const order = Array.from(footer.querySelectorAll('button'));
      expect(order.indexOf(secondaryButton as HTMLButtonElement)).toBeLessThan(
        order.indexOf(primaryButton as HTMLButtonElement),
      );

      const footerButtons = Array.from(footer.querySelectorAll('button'));
      expect(footerButtons.length).toBeGreaterThan(0);
      for (const button of footerButtons) {
        expect(button.className).not.toMatch(/full-width|btn-full/);
      }
    });

    it('shows a "Close the call" fast path on the read view while the call is open, and closes it behind a confirm without entering edit', async () => {
      const now = Date.now();
      mockCfp({
        [`GET /api/v1/events/${EVENT_ID}/forms`]: {
          id: 'form1',
          eventId: EVENT_ID,
          intro: 'Tell us about your talk.',
          openDate: now - 1000 * 60 * 60 * 24,
          closeDate: now + 1000 * 60 * 60 * 24 * 30,
          tracks: ['trk1'],
          fields: [{ id: 'f1', label: 'Title', locked: true }],
        },
      });
      render(
        <MemoryRouter>
          <CallForPapersPanel />
        </MemoryRouter>,
      );
      const section = await screen.findByRole('region', { name: 'Call for papers' });
      const fastPath = await within(section).findByRole('button', { name: 'Close the call' });

      fireEvent.click(fastPath);
      const confirmButton = await screen.findByRole('button', { name: 'Close the call now' });

      mockCfp({
        [`GET /api/v1/events/${EVENT_ID}/forms`]: {
          id: 'form1',
          eventId: EVENT_ID,
          intro: 'Tell us about your talk.',
          openDate: now - 1000 * 60 * 60 * 24,
          closeDate: now,
          tracks: ['trk1'],
          fields: [{ id: 'f1', label: 'Title', locked: true }],
        },
        [`PATCH /api/v1/forms/form1`]: {
          id: 'form1',
          eventId: EVENT_ID,
          intro: 'Tell us about your talk.',
          openDate: now - 1000 * 60 * 60 * 24,
          closeDate: now,
          tracks: ['trk1'],
          fields: [{ id: 'f1', label: 'Title', locked: true }],
        },
      });
      fireEvent.click(confirmButton);

      // Never entered the edit drill -- the confirm dialog closes and the
      // panel stays on its read-only summary throughout.
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Close the call now' })).not.toBeInTheDocument();
      });
      expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(section).getByRole('button', { name: 'Edit the form' })).toBeInTheDocument();
    });
  });
});
