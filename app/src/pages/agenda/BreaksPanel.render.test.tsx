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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BreaksPanel } from './BreaksPanel';
import { ApiError } from '../../lib/api';

const EVENT_ID = 'evt-breaks-render';
const DAY = '2026-03-02';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGetMock(...args),
    apiPost: (...args: unknown[]) => apiPostMock(...args),
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

  it('Add a break POSTs numeric startMin/durationMin parsed from the inputs and the selected day, then calls onChanged', async () => {
    apiPostMock.mockResolvedValueOnce(breakRow());
    const onChanged = vi.fn();
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[]} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByLabelText('Location (optional)'), { target: { value: 'Lobby' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:15' } });
    fireEvent.change(screen.getByLabelText('Duration (min)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a break' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Add a break' }));

    const message = await screen.findByText('must be an integer between 0 and 1439');
    expect(message).toBeInTheDocument();
    // Beside the start-time input's field group, not a page-level banner.
    const startField = screen.getByLabelText('Start time').closest('.chq-breaks-field');
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
      expect(screen.queryByRole('button', { name: 'Add a break' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Label')).not.toBeInTheDocument();
    });
  });
});
