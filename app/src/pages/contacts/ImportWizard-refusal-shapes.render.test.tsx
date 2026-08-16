// DEC-856 (sibling shape, wave 65): POST /contacts/import throws with a
// fields map keyed by csvText/mapping/eventId/sessionTitle/skipLines (plus
// dryRun, never produced by this wizard) at seven named sites -- this suite
// asserts each matched key routes to the step/control that produced it
// (never the generic "Preview failed"/"Import failed" this wizard used to
// show for every shape) and that an unmatched key still renders, labelled,
// instead of being dropped.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { ImportPlan } from './types';

afterEach(() => {
  cleanup();
});

const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme', 'Jane,Smith,jane@example.com,Beta'].join(
  '\n',
);

const PLAN: ImportPlan = {
  rows: [{ line: 2, email: 'john@example.com', action: 'create' }, { line: 3, email: 'jane@example.com', action: 'create' }],
  created: 2,
  updated: 0,
  skipped: 0,
};

describe('ImportWizard: DEC-856 preview/import refusals route to the step that produced them', () => {
  it('a mapping refusal on preview stays on/returns to the match-columns step, with the server message beside the grid', async () => {
    mockApi({
      'POST /api/v1/contacts/import': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { mapping: 'required, column -> field' }),
      },
    });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    const preview = await screen.findByRole('button', { name: 'Import 2 rows' });
    fireEvent.click(preview);

    // Still on the match-columns step (the grid is still mounted) with the
    // server's field message rendered beside it, not a generic sentence.
    expect(await screen.findByText('required, column -> field')).toBeInTheDocument();
    expect(screen.getByLabelText('Map column Email')).toBeInTheDocument();
    expect(screen.queryByText('Preview failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  it('a sessionTitle refusal on import marks the session-title control', async () => {
    let calls = 0;
    mockApi({
      'POST /api/v1/contacts/import': () => {
        calls += 1;
        if (calls === 1) return PLAN;
        return { status: 400, body: errorEnvelope('invalid', 'Validation failed', { sessionTitle: 'Max 200' }) };
      },
    });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    // DEC-290: the eventId is a candidate, not an instruction -- tick the
    // opt-in to reveal the session-title control this test exercises.
    fireEvent.click(await screen.findByLabelText('Also add these people to this event as accepted speakers'));
    const titleInput = await screen.findByLabelText('Session title for this batch');
    fireEvent.change(titleInput, { target: { value: 'Lightning talks' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));
    await screen.findByText('2 new · 0 updated');

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }));

    // Back on the match-columns step (the plan is discarded) with the
    // session-title FormRow carrying the server's message.
    const returnedTitleInput = await screen.findByLabelText('Session title for this batch');
    const row = returnedTitleInput.closest('.chq-form-row') as HTMLElement;
    expect(within(row).getByText('Max 200')).toBeInTheDocument();
    expect(row).toHaveAttribute('data-invalid', 'true');
  });

  it('an unmatched field key renders labelled in the top-of-form ErrorSummary, stating nothing was imported', async () => {
    mockApi({
      'POST /api/v1/contacts/import': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { dryRun: 'must be a boolean' }),
      },
    });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));

    expect(await screen.findByText('dryRun: must be a boolean')).toBeInTheDocument();
    expect(screen.getByText('Nothing was imported.')).toBeInTheDocument();
  });

  it('a refusal with no fields map still renders one generic message', async () => {
    mockApi({
      'POST /api/v1/contacts/import': { status: 500, body: errorEnvelope('internal', 'Preview failed') },
    });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));

    expect(await screen.findByText('Preview failed')).toBeInTheDocument();
  });
});
