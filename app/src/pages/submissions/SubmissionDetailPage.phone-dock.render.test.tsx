// DEC-610 (v12 mobile campaign w2 ruling, task w2-a). Closes audit finding 1
// (docs/design/audit/submissions-v12.md): at 390 the decision rail leaves
// .chq-detail-aside's scroll flow and renders inside the shared
// .chq-phone-dock scaffold instead. Mirrors the FakeMediaQueryList pattern
// PhoneAgenda's own render suite (app/src/pages/agenda/Agenda.render.test.tsx)
// already uses to force useIsPhone's split in jsdom, which implements no
// matchMedia at all (so every OTHER render test in this directory keeps
// exercising the desktop tree by default).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { mockApi } from '../../test-utils/mockApi';

const SUB_ID = 'sub-phone-dock-1';

function baseDetail() {
  return {
    id: SUB_ID,
    eventId: 'evt-1',
    ref: 'S-001',
    title: 'A Phone Dock Submission',
    description: 'Description text',
    status: 'pending' as const,
    contentStatus: 'pending' as const,
    trackId: null,
    trackIds: [] as string[],
    formId: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    participants: [],
    answers: {},
    slot: null,
  };
}

function mockEndpoints() {
  mockApi({
    [`GET /api/v1/submissions/${SUB_ID}`]: () => baseDetail(),
    [`GET /api/v1/events/evt-1`]: { id: 'evt-1', timezone: 'UTC' },
    [`GET /api/v1/events/evt-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
    [`GET /api/v1/events/evt-1/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
  });
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/submissions/${SUB_ID}`]}>
      <Routes>
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SubmissionDetailPage decision rail placement (DEC-610)', () => {
  it('desktop (jsdom default, no matchMedia): the rail renders inside .chq-detail-aside, no .chq-phone-dock exists', async () => {
    mockEndpoints();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('A Phone Dock Submission')).toBeInTheDocument();
    });

    const aside = document.querySelector('.chq-detail-aside');
    expect(aside?.querySelector('.chq-detail-decision-rail')).not.toBeNull();
    expect(document.querySelector('.chq-phone-dock')).toBeNull();
    // Exactly one Accept control on the page -- never both a desktop and a
    // phone copy at once.
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1);
  });

  it('phone (matchMedia stubbed true): the rail renders inside .chq-phone-dock, not inside .chq-detail-aside', async () => {
    stubPhoneMatchMedia();
    mockEndpoints();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('A Phone Dock Submission')).toBeInTheDocument();
    });

    const dock = document.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    expect(dock?.querySelector('.chq-detail-decision-rail')).not.toBeNull();

    const aside = document.querySelector('.chq-detail-aside');
    expect(aside?.querySelector('.chq-detail-decision-rail')).toBeNull();

    // Exactly one Accept control, one Decline, one Waitlist (never "Wait" --
    // DEC-610: the frame's 'Wait' binds as geometry only, never as copy).
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Decline' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Waitlist' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Wait' })).toBeNull();

    // The dock is the last child of .chq-page, so its sticky containing
    // block spans the whole scrollable page, not just the (much shorter)
    // aside box it used to be nested in.
    const page = document.querySelector('.chq-page')!;
    expect(page.lastElementChild).toBe(dock);
  });
});
