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
  it('renders nothing when there is no selected day', () => {
    const { container } = render(
      <BreaksPanel eventId={EVENT_ID} day={null} breaks={[]} onChanged={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("renders the breaks passed in via props without fetching its own copy", () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} onChanged={() => {}} />);

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
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} onChanged={onChanged} />);

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

    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} onChanged={onChanged} />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(apiDeleteMock).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove break' }));

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith('/breaks/brk-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('cancelling the remove confirmation fires no DELETE and keeps the row', async () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[breakRow()]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(apiDeleteMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it("a 400 with fields.startMin renders that message beside the start-time input, not a bare banner", async () => {
    apiPostMock.mockRejectedValueOnce(
      new ApiError(400, 'invalid', 'Invalid break input', { startMin: 'must be an integer between 0 and 1439' }),
    );
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} onChanged={() => {}} />);

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
});
