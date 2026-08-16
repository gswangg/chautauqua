// w59-f (DEC-158 wave-59 amendment): the History rail's Restore control must
// hang off entry.revisionId, not entry.kind, and the entry that IS the
// current content (the newest revision-carrying entry, newest-first list)
// must never offer a Restore that could only ever be a no-op. Also covers
// the second-carrying timestamp so two edits inside one minute render as
// distinguishable rows, and that a 400 from the restore endpoint surfaces
// its stated message verbatim. Kept in its own file (not appended to
// SubmissionDetailPage.render.test.tsx) to keep the merge surface small.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';

const SUB_ID = 'sub-restore-1';

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
    acceptedAt: null,
    icsSequence: 0,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    participants: [],
    answers: {},
    slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
    ...overrides,
  };
}

function baseRoutes(detail: unknown, history: unknown) {
  return {
    [`GET /api/v1/submissions/${SUB_ID}`]: detail,
    [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
    [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
    [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
    [`GET /api/v1/submissions/${SUB_ID}/history`]: history,
  };
}

function renderPage(initialPath = `/submissions/${SUB_ID}?history=1`) {
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

describe('SubmissionDetailPage history: revisionId-driven Restore (DEC-158)', () => {
  it('offers Restore on an entry with a revisionId that is not the newest', async () => {
    const history = [
      { id: 'h-2', at: 1700000200000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-2' },
      { id: 'h-1', at: 1700000100000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-1' },
      { id: 'h-0', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null, revisionId: 'rev-0' },
    ];
    mockApi(baseRoutes(baseDetail(), { items: history, total: history.length, page: 1, perPage: history.length }));

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Edited').length).toBe(2);
    });

    // rev-1 is not the newest revision-carrying entry (rev-2 is), so it
    // renders a Restore control.
    expect(screen.getAllByRole('button', { name: 'Restore' }).length).toBe(2);
  });

  it('renders the newest revision-carrying entry as Current version with no button', async () => {
    const history = [
      { id: 'h-2', at: 1700000200000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-2' },
      { id: 'h-1', at: 1700000100000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-1' },
      { id: 'h-0', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null, revisionId: 'rev-0' },
    ];
    mockApi(baseRoutes(baseDetail(), { items: history, total: history.length, page: 1, perPage: history.length }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Current version')).toBeInTheDocument();
    });
    // Only 2 of the 3 revision-carrying entries offer Restore -- the newest
    // (rev-2) is the current content and offers the caption instead.
    expect(screen.getAllByRole('button', { name: 'Restore' }).length).toBe(2);

    const entries = document.querySelectorAll('.chq-submission-history-entry');
    expect(entries.length).toBe(3);
    // The first (newest) entry in the newest-first list carries the
    // 'Current version' caption, not a button.
    expect(entries[0]!.textContent).toContain('Current version');
    expect(entries[0]!.querySelector('button')).toBeNull();
  });

  it('offers Restore on the submitted entry when it carries a baseline revisionId', async () => {
    const history = [
      { id: 'h-1', at: 1700000100000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-1' },
      { id: 'h-0', at: 1700000000000, kind: 'submitted', label: 'Submitted', detail: null, revisionId: 'rev-0' },
    ];
    mockApi(baseRoutes(baseDetail(), { items: history, total: history.length, page: 1, perPage: history.length }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    const submittedEntry = Array.from(document.querySelectorAll('.chq-submission-history-entry')).find((el) =>
      el.textContent?.includes('Submitted'),
    );
    expect(submittedEntry).toBeTruthy();
    expect(submittedEntry!.querySelector('button')).not.toBeNull();
    expect(submittedEntry!.querySelector('button')!.textContent).toBe('Restore');
  });

  it('surfaces a 400 restore error message verbatim', async () => {
    // rev-2 is the newest revision-carrying entry (renders 'Current version',
    // no button) -- rev-1 is the one that offers Restore, matching the
    // mocked restore endpoint below.
    const history = [
      { id: 'h-2', at: 1700000200000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-2' },
      { id: 'h-1', at: 1700000100000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-1' },
    ];
    mockApi({
      ...baseRoutes(baseDetail(), { items: history, total: history.length, page: 1, perPage: history.length }),
      [`POST /api/v1/submissions/${SUB_ID}/revisions/rev-1/restore`]: {
        status: 400,
        body: errorEnvelope('IDENTICAL_REVISION', 'This version is identical to what is there now.'),
      },
    });

    renderPage();

    // Only one Restore button exists (rev-1 -- rev-2 is current and inert).
    const restoreButtons = await screen.findAllByRole('button', { name: 'Restore' });
    expect(restoreButtons.length).toBe(1);
    fireEvent.click(restoreButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/This version is identical to what is there now\./)).toBeInTheDocument();
    });
  });

  it('renders two entries a second apart as distinguishable rows', async () => {
    const history = [
      { id: 'h-2', at: 1700000201000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-2' },
      { id: 'h-1', at: 1700000200000, kind: 'edited', label: 'Edited', detail: 'Original Title', revisionId: 'rev-1' },
    ];
    mockApi(baseRoutes(baseDetail(), { items: history, total: history.length, page: 1, perPage: history.length }));

    renderPage();

    await waitFor(() => {
      expect(document.querySelectorAll('.chq-submission-history-when').length).toBe(2);
    });
    const whens = Array.from(document.querySelectorAll('.chq-submission-history-when')).map((el) => el.textContent);
    expect(whens.length).toBe(2);
    expect(whens[0]).not.toEqual(whens[1]);
    // Minute-precision would render both as the same string -- second
    // precision is what makes them distinguishable.
    expect(whens[0]).toMatch(/:\d{2}:\d{2}$/);
  });
});
