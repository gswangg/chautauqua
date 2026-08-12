// DEC-144/DEC-161 layer-2 harness: component-render smoke test for the
// CRM-07/08 sourcing pipeline board. Mounts the real board against a mocked
// fetch: initial load renders cards in their stage columns, Move-to select
// optimistically reconciles against a PATCH response, and opening a card
// shows the detail panel's notes + activity feed.
//
// w2-e redesign note: the board now also renders a phone-width duplicate of
// each card (CSS-only media-query swap, DEC-375 "client-state swap"), so
// jsdom (which ignores media queries) sees each entry's name/Move-to select
// TWICE. Queries below are scoped with `within()` to the desktop
// `.chq-contacts-pipeline-columns` grid to keep single-match assertions
// meaningful.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PipelineBoard } from './PipelineBoard';
import { mockApi, listEnvelope, errorEnvelope } from '../../test-utils/mockApi';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

function desktopBoard() {
  return document.querySelector('.chq-contacts-pipeline-columns') as HTMLElement;
}

const ENTRY_IDENTIFIED = {
  id: 'entry-1',
  contactId: 'ct1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: 'Acme',
  email: 'ada@example.com',
  stage: 'identified',
  updatedAt: 1000,
};

const ENTRY_CONTACTED = {
  id: 'entry-2',
  contactId: 'ct2',
  firstName: 'Grace',
  lastName: 'Hopper',
  company: 'Beta Inc',
  email: 'grace@example.com',
  stage: 'contacted',
  updatedAt: 2000,
};

describe('PipelineBoard render smoke (CRM-07/08)', () => {
  it('renders cards in their stage columns from GET /pipeline', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    render(<PipelineBoard />);

    await waitFor(() => {
      expect(within(desktopBoard()).getByText('Ada Lovelace')).toBeInTheDocument();
    });
    expect(within(desktopBoard()).getByText('Grace Hopper')).toBeInTheDocument();

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));
    expect(contactedColumn).toContainElement(within(desktopBoard()).getByText('Grace Hopper'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('moves a card via the Move-to select, reconciling against the PATCH response', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'PATCH /api/v1/pipeline/entry-1': { ...ENTRY_IDENTIFIED, stage: 'contacted', updatedAt: 3000 },
    });

    render(<PipelineBoard />);
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const select = within(desktopBoard()).getAllByLabelText('Move to')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
      expect(contactedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('rolls back loudly (with a visible error) when the move PATCH fails', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'PATCH /api/v1/pipeline/entry-1': { status: 409, body: errorEnvelope('conflict', 'Move failed') },
    });

    render(<PipelineBoard />);
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    const select = within(desktopBoard()).getAllByLabelText('Move to')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      expect(screen.getByText('Move failed')).toBeInTheDocument();
    });

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('opens a card detail with notes composer and activity log', async () => {
    const moveActivity = {
      kind: 'move',
      body: null,
      fromStage: null,
      toStage: 'identified',
      authorName: 'Jordan Alvarez',
      createdAt: 1000,
    };
    let noteSaved = false;

    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': () => ({
        entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
        contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
        activity: noteSaved
          ? [
              {
                kind: 'note',
                body: 'Left voicemail.',
                fromStage: null,
                toStage: null,
                authorName: 'Jordan Alvarez',
                createdAt: 4000,
              },
              moveActivity,
            ]
          : [moveActivity],
      }),
      'POST /api/v1/pipeline/entry-1/notes': () => {
        noteSaved = true;
        return {
          kind: 'note',
          body: 'Left voicemail.',
          fromStage: null,
          toStage: null,
          authorName: 'Jordan Alvarez',
          createdAt: 4000,
        };
      },
    });

    render(<PipelineBoard />);
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: 'Ada Lovelace' })[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Moved Enrolled/)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Add a note') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Left voicemail.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(screen.getByText('Note: Left voicemail.')).toBeInTheDocument();
    });

    // DEC-378: Escape closes the pipeline card detail dialog.
    expect(screen.getByRole('dialog', { name: 'Pipeline card detail' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Pipeline card detail' })).not.toBeInTheDocument();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // DEC-468: with a 200-row server page cap, entries.length can be less
  // than the envelope's true total -- the caption must read the total, and
  // a "Load more" control must fetch and append the next page.
  it('captions the true total and appends a second page from Load more', async () => {
    const page1 = [ENTRY_IDENTIFIED, ENTRY_CONTACTED];
    const page2 = [
      { ...ENTRY_IDENTIFIED, id: 'entry-3', firstName: 'Alan', lastName: 'Turing' },
      { ...ENTRY_CONTACTED, id: 'entry-4', firstName: 'Katherine', lastName: 'Johnson' },
    ];
    let call = 0;
    const fetchMock = mockApi({
      'GET /api/v1/pipeline': () => {
        call += 1;
        return call === 1 ? listEnvelope(page1, { total: 7 }) : listEnvelope(page2, { total: 7, page: 2 });
      },
    });

    render(<PipelineBoard />);

    await waitFor(() => {
      expect(screen.getByText('7 people')).toBeInTheDocument();
    });

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    expect(loadMore).toBeInTheDocument();

    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(within(desktopBoard()).getByText('Alan Turing')).toBeInTheDocument();
    });

    const calls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calls.some((u) => /[?&]page=2\b/.test(u))).toBe(true);

    // Four items rendered after appending (2 + 2), still short of total 7,
    // so the caption still reads the true total and Load more stays.
    expect(within(desktopBoard()).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(desktopBoard()).getByText('Grace Hopper')).toBeInTheDocument();
    expect(within(desktopBoard()).getByText('Alan Turing')).toBeInTheDocument();
    expect(within(desktopBoard()).getByText('Katherine Johnson')).toBeInTheDocument();
    expect(screen.getByText('7 people')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders no Load more control when the first page already covers the total', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    render(<PipelineBoard />);

    await waitFor(() => {
      expect(screen.getByText('2 people')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// w11-e (DEC-665): the caption and per-stage counts are measurements, not
// starting values -- before the first GET /pipeline resolves, the board
// must show exactly one loading state and never a "0 people" / "0" count
// beside it.
describe('PipelineBoard: withholds unmeasured counts during the first load', () => {
  it('shows only the loading caption, never a zero-count claim, before the first load resolves', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED, ENTRY_CONTACTED]),
    });

    render(<PipelineBoard />);

    // Synchronously after mount, before the mocked fetch promise resolves:
    // exactly one loading state, no "people" caption and no stage columns
    // (which would otherwise render "0" counts against not-yet-loaded data).
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(/people$/)).not.toBeInTheDocument();
    expect(document.querySelector('.chq-contacts-pipeline-columns')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-contacts-pipeline-column-count')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2 people')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
