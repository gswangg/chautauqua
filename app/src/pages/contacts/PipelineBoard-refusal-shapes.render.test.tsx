// DEC-856 (task-w65-d): the pipeline board's four writers -- move (PATCH
// /pipeline/:id with `stage`), enroll (POST /pipeline), save fit (PATCH
// /pipeline/:id with fitScore/rationale) and save note (POST
// /pipeline/:id/notes) -- must each route a named `err.fields` map to its
// OWN control, never collapse to a bare "Validation failed" string, and
// never fold an unmatched key. Field-error state is per writer: a rejected
// note must never mark the fit form, and a rejected card move marks the
// card it came from, not the column.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PipelineBoard } from './PipelineBoard';
import { mockApi, listEnvelope, errorEnvelope } from '../../test-utils/mockApi';

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
      <PipelineBoard />
    </MemoryRouter>,
  );
}

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
  stageSince: 1000,
  declineReason: null,
  fitScore: null,
  rationale: null,
};

function detailStub() {
  return {
    entry: { id: 'entry-1', contactId: 'ct1', stage: 'identified', createdAt: 1000, updatedAt: 1000 },
    contact: { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', company: 'Acme', email: 'ada@example.com' },
    activity: { items: [], total: 0, page: 1, perPage: 200 },
  };
}

describe('PipelineBoard refusal shapes (DEC-856)', () => {
  it('a fit 400 with {fitScore, rationale} marks both controls and lists two anchors', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': detailStub(),
      'PATCH /api/v1/pipeline/entry-1': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          fitScore: 'must be an integer 1-5, or null',
          rationale: 'must be 2000 characters or fewer',
        }),
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));

    // Item 7 (frame 08-contacts--04): the card face carries no per-card
    // Rate/Edit control anymore -- open the detail panel via the card's own
    // name button, then trigger the fit dialog from there.
    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    fireEvent.click(within(identifiedColumn).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);
    const detailDialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: 'Rate' }));

    const dialog = await screen.findByRole('dialog', { name: 'Rate fit' });
    fireEvent.click(within(dialog).getByRole('button', { name: '3' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(dialog).getByText('must be an integer 1-5, or null')).toBeInTheDocument();
    });
    expect(within(dialog).getByText('must be 2000 characters or fewer')).toBeInTheDocument();

    // ErrorSummary: one anchor per problem, two controls.
    const summary = dialog.querySelector('.chq-error-summary') as HTMLElement;
    expect(summary).not.toBeNull();
    expect(summary.querySelector('h2')?.textContent).toMatch(/need fixing before this fit can be saved/);
    const links = within(summary).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '#pipeline-fit-edit-fit-group',
      '#pipeline-fit-edit-rationale',
    ]);

    // Never collapsed to the bare server message.
    expect(within(dialog).queryByText('Validation failed')).not.toBeInTheDocument();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('a note 400 with {body: "Max 20000"} marks the note textarea, never the fit form', async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': detailStub(),
      'POST /api/v1/pipeline/entry-1/notes': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { body: 'Max 20000' }),
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const textarea = within(dialog).getByLabelText('Add a note') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'a very long note' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save note' }));

    const noteError = await within(dialog).findByText('Note: Max 20000');
    expect(noteError).toHaveClass('chq-field-error');
    expect(noteError).toHaveAttribute('role', 'alert');

    // Single-control form -- no ErrorSummary block for the note writer
    // (ModalFrame's own <h2> title is exempt; only the summary block itself
    // is asserted absent here).
    expect(dialog.querySelector('.chq-error-summary')).toBeNull();
    // The typed value survives the refusal.
    expect(textarea.value).toBe('a very long note');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("a move 400 with {stage: 'must be one of …'} attaches to the card that moved and rolls back with a stated reason", async () => {
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_IDENTIFIED]),
      'GET /api/v1/pipeline/entry-1': detailStub(),
      'PATCH /api/v1/pipeline/entry-1': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          stage: 'must be one of identified, contacted, interested, confirmed, declined',
        }),
      },
    });

    renderBoard();
    await waitFor(() => within(desktopBoard()).getByText('Ada Lovelace'));
    fireEvent.click(within(desktopBoard()).getAllByRole('button', { name: /Ada Lovelace/ })[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Pipeline card detail' });
    const select = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contacted' } });

    // The board never silently keeps the optimistic position -- it rolls
    // back AND says why.
    await waitFor(() => {
      expect(screen.getByText('Could not move Ada Lovelace.')).toBeInTheDocument();
    });
    const identifiedColumn = document.querySelector('[data-stage="identified"]') as HTMLElement;
    expect(identifiedColumn).toContainElement(within(desktopBoard()).getByText('Ada Lovelace'));

    // The refusal is named beside the card that moved.
    const card = within(identifiedColumn).getByText('Ada Lovelace').closest('li') as HTMLElement;
    const cardError = within(card).getByText(/Stage: must be one of/);
    expect(cardError).toHaveClass('chq-field-error');
    expect(cardError).toHaveAttribute('role', 'alert');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('an unmatched key on the enroll writer renders labelled, not dropped, in the ErrorSummary', async () => {
    const CONTACT = { id: 'ct9', firstName: 'Rosa', lastName: 'Park', email: 'rosa@example.com', company: null };
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([CONTACT]),
      'POST /api/v1/pipeline': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { reason: 'required when declining' }),
      },
    });

    renderBoard();
    await waitFor(() => expect(screen.getByText('0 people · drag between columns')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to the pipeline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to the pipeline' });

    fireEvent.change(within(dialog).getByLabelText('Search contacts'), { target: { value: 'Rosa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
    await waitFor(() => within(dialog).getByText('Rosa Park — rosa@example.com'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rosa Park — rosa@example.com' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to the pipeline' }));

    // `reason` has no dedicated control on this dialog -- it must still
    // render, labelled "<key>: <message>", never silently dropped: once as
    // the standalone `.chq-field-error` span, and once as the
    // ErrorSummary's own anchor -- never zero times.
    const matches = await within(dialog).findAllByText('reason: required when declining');
    expect(matches.length).toBe(2);
    const standalone = matches.find((el) => el.tagName === 'SPAN')!;
    expect(standalone).toHaveClass('chq-field-error');
    expect(standalone).toHaveAttribute('role', 'alert');
    expect(standalone).toHaveAttribute('id', 'pipeline-enroll-field-reason');

    // ...and it must be reachable via the ErrorSummary's own anchor list.
    const summaryLink = within(dialog).getByRole('link', { name: 'reason: required when declining' });
    expect(summaryLink).toHaveAttribute('href', '#pipeline-enroll-field-reason');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
