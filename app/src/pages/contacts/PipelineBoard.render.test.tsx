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
});
