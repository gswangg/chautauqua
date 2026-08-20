// DEC-941 wave-114 amendment: pins the ruling the mandate asked for --
// Done-with-discard drops an unsaved add draft AND the refusal it was
// about, on top of the dirty-row discard it already had. Nothing under
// app/src/pages/settings/** named discardDirtyAndClose or retireAddForms
// before this file, so the confirm's own promise ("...leaving now discards
// these edits...") was one refactor from becoming a caption the code no
// longer honoured.
//
// Custodian decomposition: sole owner of this file, sibling to
// TracksRoomsPanel-errors.render.test.tsx -- reuses its mount/seed helpers
// from TracksRoomsPanel.render-helpers.ts rather than building a second
// harness (DEC-613).
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

describe('TracksRoomsPanel Done-with-discard retires an unsaved add draft and its refusal (DEC-941)', () => {
  it('discarding an unsaved add-a-track draft drops the draft AND its field refusal, named in the confirm body', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();

    // Open the add-a-track form and submit it empty so a real refusal
    // renders.
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    fireEvent.click(within(section).getByRole('button', { name: 'Add track' }));
    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });

    // Type a name so the row is a genuine unsaved draft.
    fireEvent.change(within(section).getByPlaceholderText('New track name'), {
      target: { value: 'Bioethics' },
    });

    // Done opens the confirm and its body names the draft.
    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialogTitle = await screen.findByText('Discard unsaved edits?');
    const dialog = dialogTitle.closest('.chq-modal') as HTMLElement;
    expect(within(dialog).getByText(/Bioethics/)).toBeInTheDocument();

    // Confirm the discard.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard the edits' }));
    await waitFor(() => {
      expect(screen.queryByText('Discard unsaved edits?')).not.toBeInTheDocument();
    });

    // Re-open the drill-in: the add form is closed, its field is empty,
    // and no refusal renders.
    const reopened = await openEdit();
    expect(within(reopened).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
    expect(within(reopened).queryByText('Required')).not.toBeInTheDocument();
    expect(within(reopened).queryByText(/Bioethics/)).not.toBeInTheDocument();
  });

  it('discarding an unsaved add-a-room draft drops the draft AND its field refusal, independently of the track form', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();

    // Open the add-a-room form and submit it empty so a real refusal
    // renders.
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a room' })[0]!);
    fireEvent.click(within(section).getByRole('button', { name: 'Add room' }));
    await waitFor(() => {
      expect(within(section).getAllByText('Required').length).toBeGreaterThan(0);
    });

    // Type a name so the row is a genuine unsaved draft.
    fireEvent.change(within(section).getByPlaceholderText('New room name'), {
      target: { value: 'Annex B' },
    });

    // The track form was never touched -- confirm the isolation rule
    // (toggleAddTrack/toggleAddRoom) also holds for the discard path: the
    // track add form stays closed and clean throughout.
    expect(within(section).queryByPlaceholderText('New track name')).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialogTitle = await screen.findByText('Discard unsaved edits?');
    const dialog = dialogTitle.closest('.chq-modal') as HTMLElement;
    expect(within(dialog).getByText(/Annex B/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard the edits' }));
    await waitFor(() => {
      expect(screen.queryByText('Discard unsaved edits?')).not.toBeInTheDocument();
    });

    const reopened = await openEdit();
    expect(within(reopened).queryByPlaceholderText('New room name')).not.toBeInTheDocument();
    expect(within(reopened).queryByText('Required')).not.toBeInTheDocument();
    expect(within(reopened).queryByText(/Annex B/)).not.toBeInTheDocument();
    // And the track form, never opened, stays closed too -- one form's
    // discard is not driven from the other.
    expect(within(reopened).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
  });

  it('a dirty row with a clean add form still confirms on Done, and the discard resets the row to its saved values', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();

    // Edit the Platform row down to an empty name (a real row-level
    // refusal on Save) without touching either add form.
    const platformInput = within(section).getByLabelText('Track name for Platform');
    fireEvent.change(platformInput, { target: { value: '' } });
    const platformRow = platformInput.closest('.chq-settings-edit-row')! as HTMLElement;
    fireEvent.click(within(platformRow).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(within(platformRow).getAllByText('Required').length).toBeGreaterThan(0);
    });

    // Row dirt alone triggers the confirm -- no add draft is involved.
    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));
    const dialogTitle = await screen.findByText('Discard unsaved edits?');
    const dialog = dialogTitle.closest('.chq-modal') as HTMLElement;
    expect(within(dialog).getByText(/Platform/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard the edits' }));
    await waitFor(() => {
      expect(screen.queryByText('Discard unsaved edits?')).not.toBeInTheDocument();
    });

    const reopened = await openEdit();
    const restoredInput = within(reopened).getByLabelText('Track name for Platform');
    expect(restoredInput).toHaveValue('Platform');
    const restoredRow = restoredInput.closest('.chq-settings-edit-row')! as HTMLElement;
    expect(within(restoredRow).queryByText('Required')).not.toBeInTheDocument();
  });

  it('Done with nothing dirty and no add draft closes with no confirm at all, and still retires the add forms', async () => {
    mockTracksRooms();
    render(
      <MemoryRouter>
        <TracksRoomsPanel />
      </MemoryRouter>,
    );

    const section = await openEdit();

    // Open the add-a-track form but leave it untouched -- an opened, empty
    // add form is not itself a draft (unsavedAddDraftNames stays empty).
    fireEvent.click(within(section).getAllByRole('button', { name: 'Add a track' })[0]!);
    expect(within(section).getByPlaceholderText('New track name')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Done' }));

    // No confirm dialog at all.
    expect(screen.queryByText('Discard unsaved edits?')).not.toBeInTheDocument();
    // The drill-in itself closed straight back to the summary (the
    // section's action reads 'Add' again, not 'Back').
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    // The closeEdit()->retireAddForms() path that Done-with-nothing-dirty
    // takes gets the add-form retirement for free -- the form that was
    // left open above is closed on the way out, not just left as-is.
    const reopened = await openEdit();
    expect(within(reopened).queryByPlaceholderText('New track name')).not.toBeInTheDocument();
  });
});
