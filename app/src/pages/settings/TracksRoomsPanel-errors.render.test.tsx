// DEC-856: a track/room refusal's fields map is read by shape -- name/color/
// capacity route to their OWN control, keyed by the row being edited, so a
// refusal on one row never marks a sibling, and a fields-map refusal never
// collapses into the page-level banner. DEC-888/DEC-896/B10 caption and
// consequence-line vocabulary.
//
// Custodian decomposition (contention hotspot): split out of
// TracksRoomsPanel.render.test.tsx -- the caption/consequence-line/refusal
// half of that suite. No behavior changed; every `it` below is verbatim
// from the pre-split file. Shared fixtures live in
// TracksRoomsPanel.render-helpers.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel } from './TracksRoomsPanel';
import { EVENT_ID, mockTracksRooms, openEdit } from './TracksRoomsPanel.render-helpers';

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

describe('TracksRoomsPanel captions, consequence line, and field-level refusals', () => {
  // DEC-888 (wave 64 amendment): one caption for the tracks edit section
  // naming what the colour is for, not one per row.
  it('renders one caption naming what the track colour is for', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const captions = within(section).getAllByText(/how a track reads on the agenda and the public pages/);
    expect(captions).toHaveLength(1);
  });

  it('renders the consequence line naming what Remove and Seats mean (DEC-896/B10)', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    await openEdit();
    expect(
      screen.getByText(
        'A track in use cannot be removed — retire it. Seats are advisory: the agenda flags over-capacity but never blocks.',
      ),
    ).toBeInTheDocument();
  });

  // DEC-856 (wave 65 amendment): a track/room refusal's fields map is read
  // by shape -- name/color/capacity route to their OWN control, keyed by
  // the row being edited, so a refusal on one row never marks a sibling
  // row.
  it('a track save refusal marks only the row being edited, not a sibling row', async () => {
    mockTracksRooms({
      'PATCH /api/v1/tracks/trk1': {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message: 'Invalid track',
            fields: { color: 'Must be a hex color like #336699' },
          },
        },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    fireEvent.change(trackNameInput, { target: { value: 'AI Engineering Pro' } });
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')! as HTMLElement;
    fireEvent.click(within(trackRow).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(trackRow).getAllByText('Must be a hex color like #336699').length).toBeGreaterThan(0);
    });
    // The color control on the failing row is the cycle swatch...
    const colorCycle = within(trackRow).getByRole('button', { name: /^Track colour for AI Engineering/ });
    expect(colorCycle).toHaveAttribute('id', 'chq-track-color-trk1');

    // ...and the sibling row (Platform) carries no error at all.
    const platformInput = within(section).getByLabelText('Track name for Platform');
    const platformRow = platformInput.closest('.chq-settings-edit-row')! as HTMLElement;
    expect(within(platformRow).queryByText('Must be a hex color like #336699')).not.toBeInTheDocument();
  });

  it('a "Required" refusal on the add-room form marks the name input and anchors from the ErrorSummary', async () => {
    mockTracksRooms({
      'POST /api/v1/events/evt-tracks-rooms/rooms': {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid room', fields: { name: 'Required' } } },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a room' })[0]!);
    fireEvent.click(within(section).getByRole('button', { name: 'Add room' }));

    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });
    const nameInput = within(section).getByPlaceholderText('New room name');
    expect(nameInput).toHaveAttribute('id', 'chq-new-room-name');
    expect(nameInput).toHaveClass('chq-field-invalid');

    const summaryLink = within(section).getByRole('link', { name: 'Required' });
    expect(summaryLink).toHaveAttribute('href', '#chq-new-room-name');
  });

  // DEC-856 amendment (wave 69): the page-level banner is a REFUSAL, not a
  // sticky log -- a write handler clears it as its first statement, so a
  // successful Add that follows a failed one never renders beside a stale
  // error.
  it('clears the page-level error banner on a write that succeeds after one that failed', async () => {
    let calls = 0;
    const fetchMock = mockTracksRooms({
      [`POST /api/v1/events/${EVENT_ID}/tracks`]: () => {
        calls += 1;
        if (calls === 1) {
          return { status: 500, body: { error: { code: 'internal', message: 'Server exploded' } } };
        }
        return { status: 200, body: { id: 'trk-new', name: 'New Track', color: '#4338ca', submissionCount: 0 } };
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    fireEvent.change(within(section).getByPlaceholderText('New track name'), {
      target: { value: 'New Track' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server exploded');
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST'))
        .toHaveLength(2);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // DEC-856 (wave 65): a fields-map refusal never collapses into the
  // page-level banner -- it routes to the per-field control (and the
  // ErrorSummary anchor) instead, so the two error surfaces never fire for
  // the same refusal.
  it('a fields-map refusal routes to the per-field control, never the page-level banner', async () => {
    mockTracksRooms({
      [`POST /api/v1/events/${EVENT_ID}/rooms`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid room', fields: { name: 'Required' } } },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a room' })[0]!);
    fireEvent.click(within(section).getByRole('button', { name: 'Add room' }));

    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });
    const nameInput = within(section).getByPlaceholderText('New room name');
    expect(nameInput).toHaveClass('chq-field-invalid');
    // The page-level banner (a bare <p role="alert">, distinct from the
    // per-field <span role="alert">s) never fires for a fields-map refusal.
    expect(section.querySelector('p[role="alert"]')).not.toBeInTheDocument();
  });

  // Eval (unfiled, from D6's investigation). Both "Add a track" toggle call
  // sites did a bare `setShowAddTrack((v) => !v)`, which reset neither
  // trackFieldErrors nor the draft -- so hiding the form and re-showing it
  // re-rendered the previous attempt's refusal over an empty field, a
  // "Required" about nothing the organiser had done. Closing the form now
  // retires that form's whole attempt, DEC-856 wave-72's "per error STATE"
  // read the way PeopleRolesPanel.closeInviteDialog reads it.
  it('closing the add-track form clears its own refusal and draft, so re-opening starts clean', async () => {
    mockTracksRooms({
      [`POST /api/v1/events/${EVENT_ID}/tracks`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid track', fields: { name: 'Required' } } },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    fireEvent.change(within(section).getByPlaceholderText('New track name'), {
      target: { value: 'Half-typed track' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));

    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });

    // Hide, then re-show.
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    expect(within(section).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);

    const reopened = within(section).getByPlaceholderText('New track name');
    expect(reopened).toHaveValue('');
    expect(reopened).not.toHaveClass('chq-field-invalid');
    expect(within(section).queryByText('Required')).not.toBeInTheDocument();
  });

  // Eval (unfiled, from D6's investigation), decided AGAINST the shape it was
  // filed as. DEC-856 wave 72 rules "per error STATE, not per panel: a
  // component holding two error states owes each one its own clear" -- so a
  // successful ROOM add must NOT clear the TRACK refusal. Clearing it would
  // be a room write erasing the only record of why a track add failed, while
  // that track form is still open beside it with the refusal's own control.
  // Pinned so the isolation reads as deliberate rather than as an omission
  // someone later "fixes".
  it('a successful room add leaves the track form\'s refusal standing (per error STATE)', async () => {
    mockTracksRooms({
      [`POST /api/v1/events/${EVENT_ID}/tracks`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid track', fields: { name: 'Required' } } },
      },
      [`POST /api/v1/events/${EVENT_ID}/rooms`]: {
        status: 200,
        body: { id: 'rm-new', name: 'Annex', capacity: null, sessionCount: 0 },
      },
    });
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));
    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });

    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a room' })[0]!);
    fireEvent.change(within(section).getByPlaceholderText('New room name'), { target: { value: 'Annex' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Add room' }));

    // The room add succeeded and cleared its OWN form...
    await waitFor(() => {
      expect(within(section).getByPlaceholderText('New room name')).toHaveValue('');
    });
    // ...and the track refusal, about a control the room write does not own,
    // is still there beside its own invalid input.
    expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    expect(within(section).getByPlaceholderText('New track name')).toHaveClass('chq-field-invalid');
  });
});
