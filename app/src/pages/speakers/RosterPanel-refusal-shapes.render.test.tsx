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
  it("crud.ts:154's session-title-required 400 names the sessionTitle control, not a generic sentence", async () => {
    mockBase({
      'POST /api/v1/contacts': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          sessionTitle: 'required to name the session this contact is added to the event with',
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
      await screen.findByText('required to name the session this contact is added to the event with'),
    ).toBeInTheDocument();
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
});
