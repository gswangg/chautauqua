// w28-b/DEC-745/DEC-124: the V9 error standard applied to the plan
// editor's save rejection -- ErrorSummary at the top of the form, one
// anchor per problem pointing at a real field id, both new error kinds
// (cross-field close-before-open, empty-criteria collection), and silence
// before the first submit attempt (rule 9: a draft never validates).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-plan-editor-errors';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
});

function renderNewPlan() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    'GET /api/v1/users': listEnvelope([]),
  });

  return render(
    <MemoryRouter initialEntries={['/review/plans/new']}>
      <Routes>
        <Route path="/review/plans/new" element={<PlanEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

// role="alert" carries no accessible name from its own content (per the
// alert role's authoring name-computation), so the summary block -- one of
// several role="alert" elements once field-level errors also render -- is
// found by its distinctive heading text, not screen.getByRole's name match.
function findSummaryAlert(): HTMLElement {
  const alerts = screen.getAllByRole('alert');
  const summary = alerts.find((el) => /before this plan can open/.test(el.textContent ?? ''));
  if (!summary) throw new Error('ErrorSummary alert not found');
  return summary;
}

describe('PlanEditor save-rejection error standard (DEC-745/DEC-124)', () => {
  it('renders nothing before the first submit attempt, even with an invalid draft already on screen', async () => {
    const { container } = renderNewPlan();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());

    // A brand-new plan starts with a blank (invalid) name, but rule 9 says
    // a draft never validates -- no summary, no per-field message, no
    // invalid-control marker anywhere yet.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.querySelector('.chq-field-invalid')).toBeNull();
  });

  it('on a failed Save/Create, renders the ErrorSummary with the countHeading text, the kept line, and one real anchor per problem', async () => {
    renderNewPlan();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());

    // Force a second, unrelated failure alongside the always-blank name:
    // scale.max === scale.min.
    fireEvent.change(screen.getByLabelText('Scale max'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create the plan' }));

    const summary = findSummaryAlert();
    expect(summary).toHaveTextContent('Two things need fixing before this plan can open');
    // G13 lane-D fix (03-review--11): the criteria/window kept sentence is
    // drawn only when BOTH those errors fired — these two problems are name
    // and scale, so asserting it here would be a false claim.
    expect(summary).not.toHaveTextContent(
      'A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.',
    );

    const links = within(summary).getAllByRole('link');
    expect(links.length).toBe(2);
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href).toMatch(/^#/);
      const targetId = href!.slice(1);
      // eslint-disable-next-line testing-library/no-node-access -- verifying the anchor resolves to a real element.
      expect(document.getElementById(targetId)).not.toBeNull();
    }
  });

  it('every offending field repeats its own message in a .chq-field-error[role=alert] span and marks its control invalid, only after submit', async () => {
    renderNewPlan();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Create the plan' }));

    const nameInput = screen.getByLabelText('Plan name');
    expect(nameInput).toHaveClass('chq-field-invalid');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');

    const nameError = document.getElementById('plan-name')!.parentElement!.querySelector('.chq-field-error');
    expect(nameError).not.toBeNull();
    expect(nameError).toHaveAttribute('role', 'alert');
    expect(nameError).toHaveTextContent('Name is required.');
  });

  it('produces a cross-field error on the close date when it is before the open date, worded as a consequence', async () => {
    renderNewPlan();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: 'Wave 1' } });
    const opens = document.getElementById('plan-open-at') as HTMLInputElement;
    const closes = document.getElementById('plan-close-at') as HTMLInputElement;
    fireEvent.change(opens, { target: { value: '20 Aug 2027' } });
    fireEvent.blur(opens);
    fireEvent.change(closes, { target: { value: '2 Sep 2026' } });
    fireEvent.blur(closes);

    fireEvent.click(screen.getByRole('button', { name: 'Create the plan' }));

    const closeError = closes.parentElement!.querySelector('.chq-field-error');
    expect(closeError).not.toBeNull();
    expect(closeError).toHaveAttribute('role', 'alert');
    expect(closeError).toHaveTextContent(/before the plan opens/i);
    expect(closes.className).toContain('chq-field-invalid');

    const summary = findSummaryAlert();
    expect(within(summary).getByRole('link', { name: 'Closes' })).toHaveAttribute('href', '#plan-close-at');
  });

  it('produces the empty-criteria error with the exact required wording when the criteria list is emptied out', async () => {
    renderNewPlan();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: 'Wave 1' } });
    // The new-plan route prefills three default criteria -- remove all of
    // them so the list is genuinely empty.
    for (const removeButton of screen.getAllByRole('button', { name: 'Remove' })) {
      fireEvent.click(removeButton);
    }
    expect(screen.queryAllByRole('button', { name: 'Remove' })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Create the plan' }));

    // DEC-124 (wave-30 amendment): the empty list is an empty-COLLECTION
    // state -- the framed card that offers the way out, never a bare
    // field-error string.
    expect(screen.getByText('No criteria yet')).toBeInTheDocument();
    expect(
      screen.getByText('Reviewers need at least one thing to score. Add your own, or start from the three defaults.'),
    ).toBeInTheDocument();

    const summary = findSummaryAlert();
    expect(within(summary).getByRole('link', { name: 'Scoring criteria' })).toHaveAttribute(
      'href',
      '#plan-criteria',
    );
  });
});
