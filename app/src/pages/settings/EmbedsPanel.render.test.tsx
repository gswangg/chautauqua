// EMB-15 / DEC-289 render smoke test: mounts EmbedsPanel against a mocked
// event fetch and asserts the live snippet reacts to format + knob changes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EmbedsPanel } from './EmbedsPanel';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-embeds-render';

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

function mockEvent() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
    },
  });
}

describe('EmbedsPanel', () => {
  it('renders the default iframe snippet for the sessions surface', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    expect(screen.getByRole('heading', { name: 'Embeds' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/^<iframe/)).toBeInTheDocument();

    // Re-skin (w2-f, DEC-368): one shared .chq-btn-primary per section, and
    // form controls use the shared .chq-select/.chq-input classes.
    expect(screen.getByRole('button', { name: 'Copy snippet' })).toHaveClass('chq-btn-primary');
    expect(screen.getByLabelText('Surface')).toHaveClass('chq-select');
    expect(screen.getByLabelText('Track ID')).toHaveClass('chq-input');
  });

  it('announces a successful copy via the live status region (DEC-607)', async () => {
    mockEvent();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('');

    fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));

    await waitFor(() => {
      expect(status).toHaveTextContent('Copied');
    });
  });

  it('announces a failed copy and exposes the text in a focusable manual-copy field', async () => {
    mockEvent();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));

    const status = screen.getByRole('status');
    await waitFor(() => {
      expect(status).toHaveTextContent('Copy failed — select the text and copy it manually');
    });

    const manualField = screen.getByLabelText('Snippet to copy manually') as HTMLInputElement;
    expect(manualField).toHaveFocus();
  });

  it('updates the snippet when the format changes to link', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/^<iframe/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'link' } });

    await waitFor(() => {
      expect(screen.getByText(/^<a href=/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^<iframe/)).not.toBeInTheDocument();
  });

  it('reflects a trackId knob in the live URL, and drops it back out when cleared', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Track ID'), { target: { value: 'trk-42' } });
    await waitFor(() => {
      expect(screen.getAllByText(/trackId=trk-42/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Track ID'), { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryAllByText(/trackId=/).length).toBe(0);
    });
  });

  it('drops the fields param when a field checkbox is unchecked then re-checked back to the full default set', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'speaker' }));
    await waitFor(() => {
      expect(screen.getAllByText(/fields=track%2Ctime%2Croom%2Cdescription/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'speaker' }));
    await waitFor(() => {
      expect(screen.queryAllByText(/fields=/).length).toBe(0);
    });
  });

  it('offers ics only for agenda/schedule surfaces', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement;
    expect(Array.from(formatSelect.options).map((o) => o.value)).not.toContain('ics');

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'agenda' } });
    await waitFor(() => {
      expect(Array.from(formatSelect.options).map((o) => o.value)).toContain('ics');
    });
  });

  // DEC-490: the builder only renders controls for knobs the selected
  // surface actually honors, per DEC-489's surface->knob table.
  it('hides the Day control for the sessions and speakers surfaces', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Day')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'speakers' } });
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/speakers/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Day')).not.toBeInTheDocument();
  });

  it('hides the Track ID control for the agenda surface', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText('Track ID')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'agenda' } });
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/agenda/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Track ID')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
  });

  it('never leaks a stale trackId into the URL after switching to a surface that ignores it', async () => {
    mockEvent();
    render(<EmbedsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/sessions/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Track ID'), { target: { value: 'trk-42' } });
    await waitFor(() => {
      expect(screen.getAllByText(/trackId=trk-42/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'agenda' } });
    await waitFor(() => {
      expect(screen.getAllByText(/embed\/devcon-2026\/agenda/).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/trackId=/).length).toBe(0);
  });
});
