// DEC-700: a nav badge fetched once per (eventId, role) survives the
// action that resolved it. This hook must also refetch when a mutation
// elsewhere succeeds (via mutationSignal) or when the user navigates —
// and must NOT refetch on a mere GET (that would loop: fetch -> bump ->
// refetch -> bump -> ...).
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useNavExceptions } from './useNavExceptions';
import { apiGet, apiPost } from './api';
import { mockApi } from '../test-utils/mockApi';

let navigate: ((path: string) => void) | null = null;

function NavigateCapture() {
  navigate = useNavigate();
  return null;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/events/ev-1/overview']}>
      <NavigateCapture />
      {children}
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  navigate = null;
});

function overviewCallCount(fetchMock: ReturnType<typeof mockApi>): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes('/overview')).length;
}

describe('useNavExceptions (DEC-395, DEC-700)', () => {
  it('issues no request for a reviewer', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
    });
    window.localStorage.setItem('chq.currentEventId', 'ev-1');

    const { result } = renderHook(() => useNavExceptions(), { wrapper });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/me'), expect.anything());
    });

    expect(result.current).toEqual({ late: null, clash: null });
    expect(overviewCallCount(fetchMock)).toBe(0);
  });

  it('issues exactly one request for an organizer', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { overdueAssignments: 3 },
        agenda: { conflicts: 1 },
      },
    });
    window.localStorage.setItem('chq.currentEventId', 'ev-1');

    const { result } = renderHook(() => useNavExceptions(), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ late: 3, clash: 1 });
    });

    expect(overviewCallCount(fetchMock)).toBe(1);
  });

  it('refetches and replaces a stale badge value after a successful mutation elsewhere', async () => {
    let overviewCalls = 0;
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events/ev-1/overview': () => {
        overviewCalls += 1;
        return overviewCalls === 1
          ? { speakers: { overdueAssignments: 1 }, agenda: { conflicts: 1 } }
          : { speakers: { overdueAssignments: 0 }, agenda: { conflicts: 0 } };
      },
      'POST /api/v1/events/ev-1/agenda/resolve': { ok: true },
    });
    window.localStorage.setItem('chq.currentEventId', 'ev-1');

    const { result } = renderHook(() => useNavExceptions(), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ late: 1, clash: 1 });
    });
    expect(overviewCallCount(fetchMock)).toBe(1);

    await act(async () => {
      await apiPost('/events/ev-1/agenda/resolve', {});
    });

    await waitFor(() => {
      expect(result.current).toEqual({ late: 0, clash: 0 });
    });
    expect(overviewCallCount(fetchMock)).toBe(2);
  });

  it('refetches on navigation alone', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { overdueAssignments: 2 },
        agenda: { conflicts: 2 },
      },
    });
    window.localStorage.setItem('chq.currentEventId', 'ev-1');

    renderHook(() => useNavExceptions(), { wrapper });

    await waitFor(() => {
      expect(overviewCallCount(fetchMock)).toBe(1);
    });

    await act(async () => {
      navigate?.('/events/ev-1/agenda');
    });

    await waitFor(() => {
      expect(overviewCallCount(fetchMock)).toBe(2);
    });
  });

  it('does not refetch on a mere GET', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { overdueAssignments: 1 },
        agenda: { conflicts: 1 },
      },
      'GET /api/v1/events/ev-1/speakers': { items: [], total: 0, page: 1, perPage: 20 },
    });
    window.localStorage.setItem('chq.currentEventId', 'ev-1');

    renderHook(() => useNavExceptions(), { wrapper });

    await waitFor(() => {
      expect(overviewCallCount(fetchMock)).toBe(1);
    });

    await act(async () => {
      await apiGet('/events/ev-1/speakers');
    });

    // Give any (incorrect) refetch a chance to land, then assert it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(overviewCallCount(fetchMock)).toBe(1);
  });
});
