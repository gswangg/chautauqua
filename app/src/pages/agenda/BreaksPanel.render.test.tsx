// DEC-021 amendment (wave 65, updated w67-b): render smoke for BreaksPanel —
// the organiser way in to the schedule_break table (list/add/remove for the
// selected day) that the server-side stack landed in wave 63 with no UI.
// Since w67-b the panel is props-driven (`breaks`/`onChanged`) — the parent
// Agenda page owns the single fetch shared with DayGrid's bands — so this
// suite passes `breaks` directly and asserts `onChanged` fires after a
// write instead of mocking a self-fetch. Mocks the api module directly
// (RosterPanel/TracksRoomsPanel convention) so we can assert on exact call
// args rather than stubbing fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BreaksPanel } from './BreaksPanel';
import { ApiError } from '../../lib/api';

const EVENT_ID = 'evt-breaks-render';
const DAY = '2026-03-02';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGetMock(...args),
    apiPost: (...args: unknown[]) => apiPostMock(...args),
    apiPatch: (...args: unknown[]) => apiPatchMock(...args),
    apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  };
});

function breakRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'brk-1',
    eventId: EVENT_ID,
    day: DAY,
    label: 'Lunch',
    location: 'Foyer',
    startMin: 720,
    durationMin: 60,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiPatchMock.mockReset();
  apiDeleteMock.mockReset();
});

afterEach(() => cleanup());

describe('BreaksPanel', () => {
  it('renders nothing when there is no selected day and no outside-window breaks', () => {
    const { container } = render(
      <BreaksPanel eventId={EVENT_ID} day={null} breaks={[]} outsideWindow={[]} onChanged={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("renders the breaks passed in via props without fetching its own copy", () => {
    render(
      <BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />,
    );

    expect(apiGetMock).not.toHaveBeenCalled();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText(/Lunch/)).toBeInTheDocument();
    expect(screen.getByText(/Foyer/)).toBeInTheDocument();
    expect(screen.getByText(/60 min/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  // frame 06--02: the section head names the selected day's weekday in
  // full, with the mandated caption directly beneath it.
  it("heads the section 'Breaks on <weekday>' with the 'They block every room at once' caption", () => {
    // DAY = '2026-03-02', a Monday.
    render(
      <BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />,
    );

    expect(screen.getByRole('heading', { name: 'Breaks on Monday' })).toBeInTheDocument();
    expect(screen.getByText('They block every room at once')).toBeInTheDocument();
  });

  // frame 06--02: the day's break rows read label(+location) / start /
  // "<N> min" / actions, not one concatenated meta string.
  it('renders each break row as label(+location), start time, "<N> min", then Edit/Remove', () => {
    render(
      <BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />,
    );

    const row = screen.getByText('12:00').closest('.chq-breaks-row') as HTMLElement;
    expect(within(row).getByText('Lunch · Foyer')).toBeInTheDocument();
    expect(within(row).getByText('12:00')).toBeInTheDocument();
    expect(within(row).getByText('60 min')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  // frame 06--02: the add row's second mandated copy line, verbatim.
  it("shows the outside-the-window hint verbatim above the add row's primary", () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[]} onChanged={() => {}} />);

    expect(
      screen.getByText(
        "A break outside the day's window is kept but flagged — the grid shows it greyed rather than dropping it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the break' })).toBeInTheDocument();
  });

  // frame 06--02: Label/Starts/Minutes are the three drawn tracks; Location
  // is app-only and sits on its own line beneath them.
  it('renders the add row with Label/Starts/Minutes as the drawn grid and Location on its own line', () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[]} onChanged={() => {}} />);

    const grid = document.querySelector('.chq-breaks-add-grid') as HTMLElement;
    expect(within(grid).getByLabelText('Label')).toBeInTheDocument();
    expect(within(grid).getByLabelText('Starts')).toBeInTheDocument();
    expect(within(grid).getByLabelText('Minutes')).toBeInTheDocument();
    expect(within(grid).queryByLabelText('Location · optional')).not.toBeInTheDocument();

    const locationField = screen.getByLabelText('Location · optional').closest('.chq-breaks-field-location');
    expect(locationField).not.toBeNull();
    expect(grid.contains(locationField)).toBe(false);
  });

  it('Add a break POSTs numeric startMin/durationMin parsed from the inputs and the selected day, then calls onChanged', async () => {
    apiPostMock.mockResolvedValueOnce(breakRow());
    const onChanged = vi.fn();
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[]} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Coffee' } });
    // w48-b: the label suffix is now the shared OPTIONAL_SUFFIX (' · optional')
    // rather than the hand-typed '(optional)' literal (DEC-917 amendment).
    fireEvent.change(screen.getByLabelText('Location · optional'), { target: { value: 'Lobby' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '10:15' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add the break' }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(apiPostMock).toHaveBeenCalledWith(`/events/${EVENT_ID}/breaks`, {
      day: DAY,
      label: 'Coffee',
      location: 'Lobby',
      startMin: 615,
      durationMin: 15,
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  // DEC-022 amendment (wave 71): inline edit affordance driving PATCH
  // /api/v1/breaks/:id.
  it('Edit opens an inline form pre-filled from the row, and Save PATCHes then calls onChanged', async () => {
    apiPatchMock.mockResolvedValueOnce(breakRow({ label: 'Lunch (extended)', durationMin: 90 }));
    const onChanged = vi.fn();

    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const editForm = within(document.querySelector('.chq-breaks-row-editing') as HTMLElement);
    const labelInput = editForm.getByLabelText('Label') as HTMLInputElement;
    expect(labelInput.value).toBe('Lunch');
    expect((editForm.getByLabelText('Start time') as HTMLInputElement).value).toBe('12:00');

    fireEvent.change(labelInput, { target: { value: 'Lunch (extended)' } });
    fireEvent.change(editForm.getByLabelText('Duration (min)'), { target: { value: '90' } });
    fireEvent.click(editForm.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledTimes(1));
    expect(apiPatchMock).toHaveBeenCalledWith('/breaks/brk-1', {
      label: 'Lunch (extended)',
      location: 'Foyer',
      startMin: 720,
      durationMin: 90,
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    // The inline form closes back to the read-only row.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('Cancel on the inline edit form fires no PATCH and restores the read-only row', () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(apiPatchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('a 400 with fields.durationMin from the PATCH renders beside the duration input', async () => {
    apiPatchMock.mockRejectedValueOnce(
      new ApiError(400, 'invalid', 'Invalid break input', {
        durationMin: 'startMin + durationMin must not exceed 1440 (a break cannot run past midnight)',
      }),
    );
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editForm = within(document.querySelector('.chq-breaks-row-editing') as HTMLElement);
    fireEvent.click(editForm.getByRole('button', { name: 'Save' }));

    const message = await screen.findByText(/cannot run past midnight/);
    expect(message).toBeInTheDocument();
    const durationField = editForm.getByLabelText('Duration (min)').closest('.chq-breaks-field');
    expect(durationField).toContainElement(message);
  });

  // DEC-941: removing a break is irreversible, so Remove opens the shared
  // ConfirmDialog first — the DELETE only fires from the dialog's own
  // destructive control, never straight off the row button.
  it('Remove asks for confirmation first, then DELETEs and calls onChanged', async () => {
    apiDeleteMock.mockResolvedValueOnce({ deleted: true });
    const onChanged = vi.fn();

    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={onChanged} />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(apiDeleteMock).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove break' }));

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith('/breaks/brk-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('cancelling the remove confirmation fires no DELETE and keeps the row', async () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(apiDeleteMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it("a 400 with fields.startMin renders that message beside the start-time input, not a bare banner", async () => {
    apiPostMock.mockRejectedValueOnce(
      new ApiError(400, 'invalid', 'Invalid break input', { startMin: 'must be an integer between 0 and 1439' }),
    );
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[]} onChanged={() => {}} />);

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Coffee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add the break' }));

    const message = await screen.findByText('must be an integer between 0 and 1439');
    expect(message).toBeInTheDocument();
    // Beside the start-time input's field group, not a page-level banner.
    const startField = screen.getByLabelText('Starts').closest('.chq-breaks-field');
    expect(startField).toContainElement(message);
    expect(screen.queryByRole('alert', { name: /Invalid break input/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid break input')).not.toBeInTheDocument();
  });

  // DEC-021 amendment (w69-c, closes DEC-844's loop): breaks stranded
  // outside the event's current window need a way in — the affordance
  // grammar says the group is absent when there's nothing to show.
  describe('outside-window group', () => {
    it('is absent when outsideWindow is empty', () => {
      render(
        <BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} outsideWindow={[]} onChanged={() => {}} />,
      );
      expect(screen.queryByText('Outside the event dates')).not.toBeInTheDocument();
    });

    it('renders with a day label, time, label and location when present', () => {
      const stranded = breakRow({ id: 'brk-2', day: '2026-04-15', label: 'Tea break', location: 'Terrace' });
      render(
        <BreaksPanel
          eventId={EVENT_ID}
          day={DAY}
          breaks={[breakRow()]}
          outsideWindow={[stranded]}
          onChanged={() => {}}
        />,
      );

      expect(screen.getByText('Outside the event dates')).toBeInTheDocument();
      // formatDayLabel('2026-04-15') -> 'Wed 15 Apr'
      expect(screen.getByText('Wed 15 Apr')).toBeInTheDocument();
      expect(screen.getByText(/Tea break/)).toBeInTheDocument();
      expect(screen.getByText(/Terrace/)).toBeInTheDocument();
      expect(screen.getByText(/no longer appear on the public agenda/)).toBeInTheDocument();
    });

    it('the outside-window Remove flow confirms then DELETEs and calls onChanged', async () => {
      apiDeleteMock.mockResolvedValueOnce({ deleted: true });
      const onChanged = vi.fn();
      const stranded = breakRow({ id: 'brk-2', day: '2026-04-15' });
      render(
        <BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[stranded]} onChanged={onChanged} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(apiDeleteMock).not.toHaveBeenCalled();

      fireEvent.click(await screen.findByRole('button', { name: 'Remove break' }));

      await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith('/breaks/brk-2'));
      await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    });

    it('with day=null and outside-window rows present, the section renders without the add-row', () => {
      const stranded = breakRow({ id: 'brk-2', day: '2026-04-15' });
      render(<BreaksPanel eventId={EVENT_ID} day={null} breaks={[]} outsideWindow={[stranded]} onChanged={() => {}} />);

      expect(screen.getByText('Outside the event dates')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add the break' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Label')).not.toBeInTheDocument();
    });
  });
});
