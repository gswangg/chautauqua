// w3-c/DEC-747 render smoke test: TracksRoomsPanel's read view is two
// columns (tracks with a real submission count per track, rooms with their
// capacity) with one 'Add' action that drills (URL state, DEC-728) into
// the existing add/rename/delete form.
//
// Custodian decomposition (contention hotspot): the original single 819-line
// file split into this "read view + drill-open + vocabulary" file plus
// siblings -TracksRoomsPanel-edit-save/-remove/-errors/-css- covering the
// rest of the same suite. No behavior changed; every `it` below is verbatim
// from the pre-split file. Shared fixtures live in
// TracksRoomsPanel.render-helpers.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TracksRoomsPanel, TRACK_SWATCHES } from './TracksRoomsPanel';
import { SETTINGS_CSS, topLevelRuleBody, mockTracksRooms, openEdit } from './TracksRoomsPanel.render-helpers';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', 'evt-tracks-rooms');
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('TracksRoomsPanel', () => {
  it('renders a read-only two-column summary with real per-track submission counts and room capacities', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
    expect(within(section).getByRole('heading', { name: 'Tracks and rooms' })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(section).getAllByText('18 submissions')).toHaveLength(2);
    });
    expect(within(section).getByText('900 seats')).toBeInTheDocument();
    expect(within(section).getByText('No capacity set')).toBeInTheDocument();

    // Read view: no editable inputs yet.
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
  });

  // DEC-747 amendment (wave 53): the caption-less row hosting the two-column
  // grid must carry the full-bleed row modifier -- otherwise the grid's
  // width:100% resolves against the 170px/1fr/auto row's narrower value
  // cell (settings.css:892), not the 820px settings column.
  it('hosts the tracks-and-rooms grid in a single-column full-bleed row', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
    const grid = section.querySelector('.chq-settings-tracks-rooms-grid')!;
    const hostingRow = grid.closest('.chq-settings-row')!;
    expect(hostingRow).toHaveClass('chq-settings-row-full');

    const body = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row-full');
    expect(body).toMatch(/grid-template-columns:\s*1fr\s*;/);
  });

  it('drills into the existing add/rename/delete form via the Add action, with the add rows revealed from each section head', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    expect(within(section).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();

    // w4-e/DEC-815: the add form isn't open by default -- it's revealed by
    // a tertiary action on each section's own head.
    expect(within(section).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
    expect(within(section).queryByPlaceholderText('New room name')).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Add a track' }));
    expect(within(section).getByPlaceholderText('New track name')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Add a room' }));
    expect(within(section).getByPlaceholderText('New room name')).toBeInTheDocument();
  });

  it('gives each section a head with its live count and exactly one filled primary in the whole edit view (DEC-815 amendment)', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();
    expect(within(section).getByText('Tracks · 2')).toBeInTheDocument();
    expect(within(section).getByText('Rooms · 2')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add a track' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add a room' })).toBeInTheDocument();

    expect(section.querySelectorAll('.chq-btn-primary')).toHaveLength(1);
    expect(within(section).getByRole('button', { name: 'Done' })).toHaveClass('chq-btn-primary');
  });

  it('renders the edit view with the settings vocabulary: no browser bullets, actions never inside a value cell, and a swatch-picker default matching TRACK_SWATCHES[0]', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();

    // Track/room lists carry the list-style:none class rather than bare <ul>.
    const lists = section.querySelectorAll('ul.chq-settings-edit-list');
    expect(lists.length).toBe(2);

    // A row's action (Delete) is a SIBLING of the value cell, never nested
    // inside it -- so it can never collide with the value text.
    const trackNameInput = within(section).getByLabelText('Track name for AI Engineering');
    const trackRow = trackNameInput.closest('.chq-settings-edit-row')!;
    expect(trackRow).not.toBeNull();
    const valueCell = trackRow.querySelector('.chq-settings-edit-row-value')!;
    const actionsCell = trackRow.querySelector('.chq-settings-edit-row-actions')!;
    expect(valueCell.contains(actionsCell)).toBe(false);
    expect(actionsCell.parentElement).toBe(trackRow);
    expect(within(actionsCell as HTMLElement).getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    // A room's capacity renders as its own input in the meta column, not a
    // parenthetical in the name.
    const roomNameInput = within(section).getByLabelText('Room name for Main Stage');
    const mainStageRow = roomNameInput.closest('.chq-settings-edit-row')!;
    expect(
      within(mainStageRow.querySelector('.chq-settings-edit-row-value') as HTMLElement).getByDisplayValue(
        'Main Stage',
      ),
    ).toBeInTheDocument();
    expect(
      within(mainStageRow.querySelector('.chq-settings-edit-row-seats') as HTMLElement).getByDisplayValue('900'),
    ).toBeInTheDocument();

    // DEC-888 amended (user-filed + frame 09--12): the swatch itself is the
    // one control -- a cycle button left of the name, no radiogroup, no
    // separate picker row. The Platform row (null color) defaults to
    // TRACK_SWATCHES[0]; clicking advances to the next palette entry; no
    // bare <input type="color"> remains anywhere.
    const platformInput = within(section).getByLabelText('Track name for Platform');
    const platformRow = platformInput.closest('.chq-settings-edit-row')! as HTMLElement;
    const cycle = within(platformRow).getByRole('button', { name: /Track colour for Platform: Olive/ });
    expect(cycle).toHaveStyle({ background: TRACK_SWATCHES[0].value });
    fireEvent.click(cycle);
    expect(
      within(platformRow).getByRole('button', { name: /Track colour for Platform: Ink/ }),
    ).toHaveStyle({ background: TRACK_SWATCHES[1].value });
    expect(within(platformRow).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(section.querySelector('input[type="color"]')).not.toBeInTheDocument();
  });
});
