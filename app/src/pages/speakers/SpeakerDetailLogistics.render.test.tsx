// DEC-738 amendment (wave 71): the speaker record's Logistics section
// renders the person's org-wide dietary/travel/accessibility facts and
// saves edits through PATCH /api/v1/contacts/:id with a MERGED customFields
// object -- an unowned custom key present on load must survive the round
// trip untouched (toRows/fromRows, imported not re-implemented).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpeakerDetailPage } from './SpeakerDetailPage';
import { mockApi } from '../../test-utils/mockApi';
import type { SpeakerDetailResponse } from './speakerDetail';

const EVENT_ID = 'evt-speaker-logistics';
const CONTACT_ID = 'ct-logistics-1';

function baseDetail(overrides: Partial<SpeakerDetailResponse> = {}): SpeakerDetailResponse {
  return {
    contact: {
      id: CONTACT_ID,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      company: 'Acme',
      title: 'Engineer',
      hasAccount: true,
      phone: '+1 415 555 0134',
      notes: null,
      customFields: {
        dietary: 'Vegetarian',
        travel_logistics: 'Arrives night before.',
        accessibility: 'Needs a ramp.',
        // An unreserved custom key -- must survive a Logistics save
        // untouched (fromRows only drops rows it is given; toRows carries
        // every non-reserved key forward unchanged).
        role: 'keynote',
      },
      headshotFileId: null,
      bio: null,
      socialLinks: [],
    },
    participation: {
      participantId: 'p-1',
      submissionId: 'sub-1',
      inviteStatus: 'accepted',
    },
    participationRollup: {
      status: 'accepted',
      bySubmission: [{ participantId: 'p-1', submissionId: 'sub-1', ref: 'S-001', inviteStatus: 'accepted' }],
    },
    sessions: [],
    tasks: [],
    counts: { outstandingRequired: 0, overdue: 0 },
    otherEvents: [],
    otherEventsCount: 0,
    ...overrides,
  };
}

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

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/speakers/${CONTACT_ID}`]}>
      <Routes>
        <Route path="/speakers/:contactId" element={<SpeakerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SpeakerDetailPage logistics section', () => {
  it('renders the three labelled fields and scopes the section as org-wide, not event-scoped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Logistics/)).toBeInTheDocument();
    expect(screen.getByText('Dietary')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.getByText('Arrives night before.')).toBeInTheDocument();
    expect(screen.getByText('Needs a ramp.')).toBeInTheDocument();
  });

  it('saves an edit through PATCH /api/v1/contacts/:id preserving an unowned custom key', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/speakers/${CONTACT_ID}`]: baseDetail(),
      [`PATCH /api/v1/contacts/${CONTACT_ID}`]: { ok: true },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const dietaryField = screen.getByRole('textbox', { name: 'Dietary' });
    fireEvent.change(dietaryField, { target: { value: 'Vegan' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (call) => call[1]?.method === 'PATCH' && String(call[0]).includes(`/contacts/${CONTACT_ID}`),
      );
      expect(patchCall).toBeDefined();
    });

    const patchCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === 'PATCH' && String(call[0]).includes(`/contacts/${CONTACT_ID}`),
    )!;
    const body = JSON.parse(String(patchCall[1]?.body)) as { customFields: Record<string, string> };
    expect(body.customFields.dietary).toBe('Vegan');
    expect(body.customFields.travel_logistics).toBe('Arrives night before.');
    expect(body.customFields.accessibility).toBe('Needs a ramp.');
    // The unowned key must survive the round trip untouched.
    expect(body.customFields.role).toBe('keynote');

    await waitFor(() => {
      expect(screen.getByText('Vegan')).toBeInTheDocument();
    });
  });
});
