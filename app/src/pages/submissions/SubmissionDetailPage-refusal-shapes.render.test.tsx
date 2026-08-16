// DEC-505 (wave-55 ledger, wave-13 amendment task-w13-c): SubmissionDetailPage
// is the SPA's largest write surface and already reads err.fields at six
// distinct write paths (status/edit/tracks/format/audienceLevel/participants/
// add-co-presenter). This proves -- rather than rewrites -- that
// src/routes/api/submissions.ts's own wordings actually reach this page's
// DOM: status update (status:'Invalid status'), participant remove with lead
// protection (role:'Cannot remove the lead'), make-co-presenter hitting the
// same lead guard (role:'Cannot change the lead's role'), visibility toggle
// (visible:'Required'), add-co-presenter duplicate-contact
// (contactId:'Already invited'), and version restore (the bare-message
// 'This version is identical...' 400 -- SubmissionDetailPage.history-restore
// .render.test.tsx already proves this one end to end; repeated here in
// miniature so this ledger row's ONE test file proves the full named set).
//
// The lead-protection cases model a stale-client race: the CLIENT'S own
// `speaker` resolution (role==='speaker', else participants[0]) disagrees
// with the SERVER'S getSubmissionLeadParticipantId, so a row the client
// renders with live Remove/Make co-presenter controls still gets refused by
// the server's own lead guard -- exactly the scenario that guard exists for.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';

const SUB_ID = 'sub-refusal-1';

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SUB_ID,
    eventId: 'evt-1',
    ref: 'S-001',
    title: 'Original Title',
    description: 'Original description',
    status: 'pending',
    contentStatus: 'pending',
    trackId: null,
    trackIds: [] as string[],
    formId: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    participants: [],
    answers: {},
    slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
    ...overrides,
  };
}

function baseRoutes(detail: unknown, overrides: Record<string, unknown> = {}) {
  return {
    [`GET /api/v1/submissions/${SUB_ID}`]: detail,
    [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
    [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
    [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
    ...overrides,
  };
}

function renderPage(initialPath = `/submissions/${SUB_ID}`) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SubmissionDetailPage refusal shapes (DEC-505/DEC-958)', () => {
  it("status update 409 ('Invalid status') marks the decision rail, not a bare page-level sentence", async () => {
    const detail = baseDetail({ status: 'pending' });
    mockApi({
      ...baseRoutes(detail),
      [`POST /api/v1/events/evt-1/submissions/status`]: {
        status: 409,
        body: errorEnvelope('conflict', 'status must be one of the DEC-003 submission statuses', {
          status: 'Invalid status',
        }),
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Original description')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    const rail = document.getElementById('submission-status-controls')!;
    expect(await within(rail).findByText('Invalid status')).toBeInTheDocument();
    expect(within(rail).queryByText('status must be one of the DEC-003 submission statuses')).not.toBeInTheDocument();
  });

  it("removing a stale-client-visible participant that the server still knows is the lead ('Cannot remove the lead') marks that row", async () => {
    // Client's `speaker` resolves to p1 (first participant, role 'moderator'
    // -- no role==='speaker' row exists), so p2 renders with a live Remove
    // control. The server disagrees and refuses.
    const detail = baseDetail({
      participants: [
        { id: 'p1', contactId: 'c1', name: 'Ada Lovelace', email: 'ada@example.com', company: null, title: null, role: 'moderator', visible: true, inviteStatus: 'none' },
        { id: 'p2', contactId: 'c2', name: 'Grace Hopper', email: 'grace@example.com', company: null, title: null, role: 'panelist', visible: true, inviteStatus: 'none' },
      ],
    });
    mockApi({
      ...baseRoutes(detail),
      [`DELETE /api/v1/submissions/${SUB_ID}/participants/p2`]: {
        status: 409,
        body: errorEnvelope('conflict', 'The lead participant cannot be removed', {
          role: 'Cannot remove the lead',
        }),
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument());

    const row = screen.getByText('Grace Hopper').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this participant?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove participant' }));

    const errorRow = await screen.findByText(/Role: Cannot remove the lead/);
    expect(errorRow).toBeInTheDocument();
    expect(screen.queryByText('The lead participant cannot be removed')).not.toBeInTheDocument();
    // The row itself is un-removed (rollback), not a page-level banner.
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it("make-co-presenter hitting the server's lead guard ('Cannot change the lead's role') marks that row", async () => {
    const detail = baseDetail({
      participants: [
        { id: 'p1', contactId: 'c1', name: 'Ada Lovelace', email: 'ada@example.com', company: null, title: null, role: 'moderator', visible: true, inviteStatus: 'none' },
        { id: 'p2', contactId: 'c2', name: 'Grace Hopper', email: 'grace@example.com', company: null, title: null, role: 'panelist', visible: true, inviteStatus: 'none' },
      ],
    });
    mockApi({
      ...baseRoutes(detail),
      [`PATCH /api/v1/submissions/${SUB_ID}/participants/p2`]: {
        status: 409,
        body: errorEnvelope('conflict', "The lead participant's role cannot be changed from this route", {
          role: "Cannot change the lead's role",
        }),
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument());

    const row = screen.getByText('Grace Hopper').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Make co-presenter' }));

    const errorRow = await screen.findByText(/Role: Cannot change the lead's role/);
    expect(errorRow).toBeInTheDocument();
    expect(screen.queryByText("The lead participant's role cannot be changed from this route")).not.toBeInTheDocument();
  });

  it("visibility toggle 400 ('Required') marks the participant's own row", async () => {
    const detail = baseDetail({
      participants: [
        { id: 'p1', contactId: 'c1', name: 'Ada Lovelace', email: 'ada@example.com', company: null, title: null, role: 'speaker', visible: true, inviteStatus: 'none' },
        { id: 'p2', contactId: 'c2', name: 'Grace Hopper', email: 'grace@example.com', company: null, title: null, role: 'panelist', visible: true, inviteStatus: 'none' },
      ],
    });
    mockApi({
      ...baseRoutes(detail),
      [`PATCH /api/v1/submissions/${SUB_ID}/participants/p2`]: {
        status: 400,
        body: errorEnvelope('invalid', 'visible must be a boolean', { visible: 'Required' }),
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument());

    const row = screen.getByText('Grace Hopper').closest('tr')!;
    fireEvent.click(within(row).getByLabelText('Visible: Grace Hopper'));

    const errorRow = await screen.findByText(/Visible: Required/);
    expect(errorRow).toBeInTheDocument();
    expect(screen.queryByText('visible must be a boolean')).not.toBeInTheDocument();
  });

  it("add-co-presenter duplicate-contact 400 ('Already invited') marks the Contact field", async () => {
    const detail = baseDetail();
    mockApi({
      ...baseRoutes(detail),
      [`GET /api/v1/contacts`]: {
        items: [{ id: 'c-2', firstName: 'Riley', lastName: 'Contact', email: 'riley@example.com' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`POST /api/v1/submissions/${SUB_ID}/participants`]: {
        status: 400,
        body: errorEnvelope('invalid', 'This contact is already a participant on this submission', {
          contactId: 'Already invited',
        }),
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Original description')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Search contacts'), { target: { value: 'Riley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText('Riley Contact (riley@example.com)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Already invited')).toBeInTheDocument();
    expect(screen.queryByText('This contact is already a participant on this submission')).not.toBeInTheDocument();
  });

  it("version restore 400 ('This version is identical...') surfaces the server's own sentence", async () => {
    const history = [
      { id: 'h-1', at: 1700000100000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-1' },
      { id: 'h-0', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null, revisionId: 'rev-0' },
    ];
    mockApi({
      ...baseRoutes(baseDetail()),
      [`GET /api/v1/submissions/${SUB_ID}/history`]: { items: history, total: history.length, page: 1, perPage: history.length },
      [`POST /api/v1/submissions/${SUB_ID}/revisions/rev-0/restore`]: {
        status: 400,
        body: errorEnvelope('invalid', 'This version is identical to what is there now — nothing to restore.'),
      },
    });

    renderPage(`/submissions/${SUB_ID}?history=1`);

    const restoreButtons = await screen.findAllByRole('button', { name: 'Restore' });
    fireEvent.click(restoreButtons[0]!);

    expect(
      await screen.findByText(/This version is identical to what is there now — nothing to restore\./),
    ).toBeInTheDocument();
  });
});
