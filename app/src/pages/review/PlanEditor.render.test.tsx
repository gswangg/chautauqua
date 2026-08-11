// DEC-239 regression + DEC-018 P3 coverage (docs/eval-findings.md Section B
// "Reviewer assignment always fails 'User not found'", Section D "Add-
// criterion clicks made before changing Rounds are discarded"):
//  1. reviewerOptions built from {id,email,role} rows (GET /api/v1/users
//     wire shape) must render <option value> equal to the row's `id` --
//     not `undefined` from a stale `userId` field read.
//  2. adding a criterion, typing its label, then changing Rounds must not
//     discard the typed label.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-plan-editor';
const PLAN_ID = 'plan-1';

function plan() {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: 'Track Review',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('PlanEditor render smoke', () => {
  it('renders reviewer options keyed on `id` (not `userId`) from the GET /api/v1/users wire shape', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 }]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    const option = screen.getByRole('option', { name: 'reviewer@example.test' }) as HTMLOptionElement;
    expect(option.value).toBe('user-42');
  });

  it('keeps a just-typed criterion label after the Rounds count changes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Track Review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add rating criterion' }));
    const labelInput = screen.getByPlaceholderText('Label');
    fireEvent.change(labelInput, { target: { value: 'Innovation' } });
    expect((labelInput as HTMLInputElement).value).toBe('Innovation');

    const roundsInput = screen.getByLabelText('Rounds');
    fireEvent.change(roundsInput, { target: { value: '2' } });

    expect((screen.getByPlaceholderText('Label') as HTMLInputElement).value).toBe('Innovation');
  });
});
