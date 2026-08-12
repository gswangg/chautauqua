// DEC-395: the shell must not request overview aggregates on a reviewer's
// behalf — a reviewer has no access to that endpoint and no use for the
// late/clash badges it drives.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useNavExceptions } from './useNavExceptions';
import { mockApi } from '../test-utils/mockApi';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('useNavExceptions (DEC-395)', () => {
  it('issues no request for a reviewer', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
    });
    window.localStorage.setItem('chq.currentEventId', 'ev-1');

    const { result } = renderHook(() => useNavExceptions());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/me'), expect.anything());
    });

    expect(result.current).toEqual({ late: null, clash: null });
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/overview'))).toHaveLength(0);
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

    const { result } = renderHook(() => useNavExceptions());

    await waitFor(() => {
      expect(result.current).toEqual({ late: 3, clash: 1 });
    });

    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/overview'))).toHaveLength(1);
  });
});
