// DEC-144/DEC-161 layer-2 harness: component-render smoke test for the
// CRM-07/08 sourcing pipeline board. Mounts the real board against a mocked
// fetch: initial load renders cards in their stage columns, Move-to select
// optimistically reconciles against a PATCH response, and opening a card
// shows the detail panel's notes + activity feed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
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
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(screen.getByText('Ada Lovelace'));
    expect(contactedColumn).toContainElement(screen.getByText('Grace Hopper'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('moves a card via the Move-to select, reconciling against the PATCH response', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'PATCH /api/v1/pipeline/entry-1': { ...ENTRY_IDENTIFIED, stage: 'contacted', updatedAt: 3000 },
    });

    render(<PipelineBoard />);
    await waitFor(() => screen.getByText('Ada Lovelace'));

    const select = screen.getByLabelText('Move to') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      const contactedColumn = document.querySelector('[data-stage="contacted"]') as HTMLElement;
      expect(contactedColumn).toContainElement(screen.getByText('Ada Lovelace'));
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('rolls back loudly (with a visible error) when the move PATCH fails', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'PATCH /api/v1/pipeline/entry-1': { status: 409, body: errorEnvelope('conflict', 'Move failed') },
    });

    render(<PipelineBoard />);
    await waitFor(() => screen.getByText('Ada Lovelace'));

    const select = screen.getByLabelText('Move to') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    await waitFor(() => {
      expect(screen.getByText('Move failed')).toBeInTheDocument();
    });

    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(screen.getByText('Ada Lovelace'));

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
    await waitFor(() => screen.getByText('Ada Lovelace'));

    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }));

    await waitFor(() => {
      expect(screen.getByText(/Moved Enrolled/)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Add a note') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Left voicemail.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(screen.getByText('Note: Left voicemail.')).toBeInTheDocument();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
