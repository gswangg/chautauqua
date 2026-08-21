// DEC-265 amendment (wave 25): applyCellStatus's SUCCESS path used to null
// the ENTIRE optimisticOverride once its own refetch settled -- since
// `grid = optimisticOverride ?? gridRead.data ?? null`, that discarded every
// OTHER cell's still-in-flight optimistic flip too, visibly snapping a
// second toggled cell back to its pre-click status until its own PATCH
// resolved. These tests drive two concurrent applyCellStatus calls with
// controllable PATCH promises and assert (1) the first write resolving does
// not snap back the second cell's optimistic flip, and (2) the second
// write's own failure still rolls its cell back (the failure branch's
// `current ? ... : current` guard is no longer a no-op against a
// concurrent success).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { resetApiCacheForTests } from '../../lib/api';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-concurrent-writes';

function baseGrid(status1: 'pending' | 'complete', status2: 'pending' | 'complete'): OnboardingGridResponse {
  return {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
    rows: [
      {
        contact: {
          id: 'ct1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          company: 'Acme',
          hasAccount: true,
          participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: status1, completedAt: status1 === 'complete' ? 1700000000000 : null, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        contact: {
          id: 'ct2',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          company: 'Navy',
          hasAccount: false,
          participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as2', status: status2, completedAt: status2 === 'complete' ? 1700000000000 : null, fileId: null, fileName: null, assignedAt: 0 }],
      },
    ],
    total: 2,
    page: 1,
    perPage: 50,
    counts: { speakers: 2, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
    timezone: 'UTC',
  };
}

interface Deferred {
  promise: Promise<Response>;
  resolve: () => void;
  reject: () => void;
}

function deferredPatch(): Deferred {
  let resolveFn!: () => void;
  let rejectFn!: () => void;
  const promise = new Promise<Response>((resolve, reject) => {
    resolveFn = () => resolve(new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }));
    rejectFn = () =>
      resolve(
        new Response(JSON.stringify({ error: { code: 'internal', message: 'write failed' } }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetApiCacheForTests();
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('OnboardingGrid: DEC-265 amendment (wave 25) -- per-cell success retirement', () => {
  it('does not snap a second in-flight optimistic cell back to its pre-click status when the first write resolves', async () => {
    // Server starts both cells pending. Clicking either flips it to
    // complete (nextStatus).
    let serverGrid = baseGrid('pending', 'pending');
    const patches: Record<string, Deferred> = {};
    let onboardingGetCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === 'string' ? input : input.toString();
        const path: string = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0] ?? rawUrl;
        const method = (init?.method ?? 'GET').toUpperCase();

        if (method === 'GET' && path === `/api/v1/events/${EVENT_ID}/onboarding`) {
          onboardingGetCount += 1;
          return new Response(JSON.stringify(serverGrid), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (method === 'PATCH' && path.startsWith('/api/v1/task-assignments/')) {
          const assignmentId = path.split('/').pop()!;
          const def = deferredPatch();
          patches[assignmentId] = def;
          return def.promise;
        }
        throw new Error(`unmocked route ${method} ${path}`);
      }),
    );

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
    const table = within(screen.getByRole('table'));
    const btn1 = table.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    const btn2 = table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' });
    expect(onboardingGetCount).toBe(1);

    // Click both cells before either PATCH resolves.
    fireEvent.click(btn1);
    await waitFor(() => expect(patches.as1).toBeDefined());
    fireEvent.click(btn2);
    await waitFor(() => expect(patches.as2).toBeDefined());

    // Both flipped optimistically to complete.
    await waitFor(() => expect(btn1.className).toContain('chq-speakers-status-complete'));
    await waitFor(() => expect(btn2.className).toContain('chq-speakers-status-complete'));

    // The server confirms as1's write (its own refetch reflects as1 =
    // complete, as2 still pending -- as2's own PATCH hasn't resolved yet).
    serverGrid = baseGrid('complete', 'pending');
    patches.as1!.resolve();

    // Give the success path's await gridRead.refetch() + setOptimisticOverride
    // a turn to settle -- the refetch this triggers is the SECOND
    // onboarding GET.
    await waitFor(() => expect(onboardingGetCount).toBeGreaterThanOrEqual(2));

    // The defect: nulling the whole override here would drop as2's flip
    // back to the server's still-pending truth. It must not.
    expect(btn2.className).toContain('chq-speakers-status-complete');
    expect(btn1.className).toContain('chq-speakers-status-complete');
  });

  it('still rolls the second cell back to its pre-click status when its own write fails, after the first write already succeeded', async () => {
    let serverGrid = baseGrid('pending', 'pending');
    const patches: Record<string, Deferred> = {};
    let onboardingGetCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === 'string' ? input : input.toString();
        const path: string = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0] ?? rawUrl;
        const method = (init?.method ?? 'GET').toUpperCase();

        if (method === 'GET' && path === `/api/v1/events/${EVENT_ID}/onboarding`) {
          onboardingGetCount += 1;
          return new Response(JSON.stringify(serverGrid), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (method === 'PATCH' && path.startsWith('/api/v1/task-assignments/')) {
          const assignmentId = path.split('/').pop()!;
          const def = deferredPatch();
          patches[assignmentId] = def;
          return def.promise;
        }
        throw new Error(`unmocked route ${method} ${path}`);
      }),
    );

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
    const table = within(screen.getByRole('table'));
    const btn1 = table.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' });
    const btn2 = table.getByRole('button', { name: 'Toggle Sign speaker agreement for Grace Hopper' });

    fireEvent.click(btn1);
    await waitFor(() => expect(patches.as1).toBeDefined());
    fireEvent.click(btn2);
    await waitFor(() => expect(patches.as2).toBeDefined());

    await waitFor(() => expect(btn1.className).toContain('chq-speakers-status-complete'));
    await waitFor(() => expect(btn2.className).toContain('chq-speakers-status-complete'));

    // First write succeeds.
    serverGrid = baseGrid('complete', 'pending');
    patches.as1!.resolve();
    await waitFor(() => expect(onboardingGetCount).toBeGreaterThanOrEqual(2));
    expect(btn2.className).toContain('chq-speakers-status-complete');

    // Second write then fails -- its own cell must roll back to its
    // pre-click status (pending; DEC-265's "rolled-back write borrows the
    // overdue class family" marker in TaskCell.tsx renders that as
    // chq-speakers-status-overdue plus a "not saved" label, never
    // chq-speakers-status-complete), proving the failure branch's per-cell
    // rewrite is no longer a no-op against the override a concurrent
    // success left behind.
    patches.as2!.reject();
    await waitFor(() => expect(btn2).toHaveTextContent('not saved'));
    expect(btn2.className).not.toContain('chq-speakers-status-complete');
    expect(btn2.className).toContain('chq-speakers-status-overdue');
    // as1's confirmed success must survive the sibling's rollback.
    expect(btn1.className).toContain('chq-speakers-status-complete');
  });
});
