// DEC-505 (wave-55 task-w55-b ledger): proves RosterPanel's add-speaker
// form renders the server's own refusal wording for POST /contacts
// (src/routes/api/contacts/crud.ts) rather than any client-invented
// sentence, using the sanctioned mockApi/errorEnvelope harness (the
// existing RosterPanel.render.test.tsx mocks the api module directly --
// this file proves the same doors end-to-end through the real fetch
// stub, matching TracksRoomsPanel-refusal-shapes.render.test.tsx's shape).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { RosterPanel } from './RosterPanel';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-roster-refusals';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function mockBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/contacts/duplicates/check': listEnvelope([]),
    'GET /api/v1/contacts': listEnvelope([]),
    ...overrides,
  });
}

function fillAddForm() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText(/Session title/), { target: { value: 'Analytical Engines at Scale' } });
}

describe('RosterPanel add-speaker refusal shapes (DEC-505)', () => {
  // DEC-909 wave-128 clause (a): sessionTitle is optional on a roster add,
  // so crud.ts no longer emits a 'required' refusal for it -- the field's
  // only remaining server-side refusal is the shared over-cap message
  // (crud.ts's MAX_NAME_LENGTH check, same grammar overCapFieldMessage
  // gives every other capped field).
  it("crud.ts's over-cap sessionTitle 400 names the sessionTitle control, not a generic sentence", async () => {
    mockBase({
      'POST /api/v1/contacts': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          sessionTitle: '201 characters — 1 over the 200 limit',
        }),
      },
    });
    render(
      <MemoryRouter>
        <RosterPanel mode="add" onClose={vi.fn()} onChanged={vi.fn()} />
      </MemoryRouter>,
    );
    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    expect(await screen.findByText('201 characters — 1 over the 200 limit')).toBeInTheDocument();
  });

  it("crud.ts:176's duplicate-email 409 names the existing contact, not a generic sentence", async () => {
    mockBase({
      'POST /api/v1/contacts': {
        status: 409,
        body: errorEnvelope('conflict', 'Priya Raman already uses this email', {
          email: 'Already on an existing contact',
        }),
      },
      'GET /api/v1/contacts': listEnvelope([]),
    });
    render(
      <MemoryRouter>
        <RosterPanel mode="add" onClose={vi.fn()} onChanged={vi.fn()} />
      </MemoryRouter>,
    );
    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    expect(await screen.findByText('Priya Raman already uses this email')).toBeInTheDocument();
  });

  // DEC-909 wave-18 clause (c): src/server/repo/participants.ts's
  // participant-cap refusal throws ApiError('invalid', ..., { submissionId })
  // -- a wire key no FormRow on this form renders. The top-of-form error
  // line is the only anchor for it; nothing may be swallowed.
  it("a submissionId-keyed refusal (no FormRow renders that key) surfaces on the top-of-form line", async () => {
    mockBase({
      'POST /api/v1/contacts': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          submissionId: 'This session already has 8 participants, its limit.',
        }),
      },
    });
    render(
      <MemoryRouter>
        <RosterPanel mode="add" onClose={vi.fn()} onChanged={vi.fn()} />
      </MemoryRouter>,
    );
    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    expect(
      await screen.findByText('This session already has 8 participants, its limit.'),
    ).toBeInTheDocument();
    // No anchor list renders with nothing renderable in it.
    expect(screen.queryByRole('link', { name: /First name/ })).not.toBeInTheDocument();
  });

  it('a mixed refusal (a renderable field key plus an unrenderable one) shows both the field error and the top-of-form line', async () => {
    mockBase({
      'POST /api/v1/contacts': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          email: 'Not a valid email address',
          submissionId: 'This session already has 8 participants, its limit.',
        }),
      },
    });
    render(
      <MemoryRouter>
        <RosterPanel mode="add" onClose={vi.fn()} onChanged={vi.fn()} />
      </MemoryRouter>,
    );
    fillAddForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));

    expect(await screen.findByText('Not a valid email address')).toBeInTheDocument();
    expect(
      await screen.findByText('This session already has 8 participants, its limit.'),
    ).toBeInTheDocument();
  });
});
