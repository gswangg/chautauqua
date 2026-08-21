// w33-e (DEC-730 wave-33): the Speakers head summary bolded the RESTING
// clause and un-bolded the EXCEPTION clause -- the inverse of the pack's
// own rule. docs/design/Chautauqua Speakers.dc.html draws the resting
// clause plain and the whole exception clause (numeral AND noun) as ONE
// strong, inked span at :57 (desktop landing) and :140 (390 landing);
// :469 (a filtered zero-row result -- caption at :442 "Speakers · search
// found nothing") and :563 (a mounted optimistic-rollback banner --
// caption at :549 "Speakers · a write failed") already spend the page's
// emphasis budget, so the same span keeps its element but drops its
// exception class there; :264 (the 390 Roster drill-in) drops emphasis
// entirely. Full verdict prose lives in
// docs/design/audit/speakers-summary-emphasis-v12.md; this file is the
// render RECEIPT each row cites.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { OnboardingGridResponse } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Speakers.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- copied from Speakers.frame-verdicts.render.test.tsx's
 * own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-speakers-summary-emphasis';

const TASKS: OnboardingGridResponse['tasks'] = [
  { id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true },
];

const GRID_WITH_ROWS: OnboardingGridResponse = {
  tasks: TASKS,
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
      cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
  counts: { speakers: 12, outstandingRequired: 1, overdue: 3, outstandingContacts: 1 },
  timezone: 'UTC',
};

const GRID_EMPTY: OnboardingGridResponse = {
  tasks: TASKS,
  rows: [],
  total: 0,
  page: 1,
  perPage: 50,
  counts: { speakers: 12, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
  timezone: 'UTC',
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetApiCacheForTests();
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

function summaryStrongNodes(): HTMLElement[] {
  const summary = document.querySelector('.chq-speakers-head .chq-summary');
  if (!summary) throw new Error('summary span not found');
  return Array.from(summary.querySelectorAll('strong'));
}

describe('Speakers head summary emphasis (DEC-730 wave-33)', () => {
  it('rest state: exactly one emphasized node, "<n> overdue" verbatim, no emphasis on the accepted clause', async () => {
    // docs/design/Chautauqua Speakers.dc.html:57 (desktop) --
    verbatimLine(
      57,
      '            <span style="font-size:13px; color:#565A4B">12 accepted · <strong style="color:#1B1D17">3 overdue</strong></span>',
    );
    // docs/design/Chautauqua Speakers.dc.html:140 (390) --
    verbatimLine(140, '        <span style="font-size:13px; color:#565A4B; line-height:1.5">12 accepted · <strong style="color:#1B1D17">3 overdue</strong></span>');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_WITH_ROWS,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

    const strongs = summaryStrongNodes();
    expect(strongs).toHaveLength(1);
    expect(strongs[0]?.textContent).toBe('3 overdue');
    expect(strongs[0]?.className).toBe('chq-speakers-summary-exception');

    const summary = document.querySelector('.chq-speakers-head .chq-summary')!;
    expect(summary.textContent).toBe('12 accepted · 3 overdue');
    // The accepted clause carries no emphasized ancestor -- every child
    // node up to the <strong> is a plain text node, never an element.
    const strongIndex = Array.from(summary.childNodes).findIndex((n) => n.nodeType === Node.ELEMENT_NODE);
    expect(strongIndex).toBeGreaterThan(-1);
    const beforeStrong = Array.from(summary.childNodes).slice(0, strongIndex);
    expect(beforeStrong.every((n) => n.nodeType === Node.TEXT_NODE)).toBe(true);
    expect(beforeStrong.map((n) => n.textContent).join('')).toBe('12 accepted · ');
  });

  it('empty-filter state: the exception node exists but carries no exception class', async () => {
    // docs/design/Chautauqua Speakers.dc.html:469 (caption at :442
    // "Speakers · search found nothing" -- filtered zero-row result) --
    verbatimLine(469, '          <span style="font-size:13px; color:#565A4B">12 accepted · 3 overdue</span>');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_EMPTY,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Overdue only' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));

    await waitFor(() => expect(screen.getByText('No speakers match the current filters.')).toBeInTheDocument());

    const strongs = summaryStrongNodes();
    expect(strongs).toHaveLength(1);
    expect(strongs[0]?.className).toBe('');
  });

  it('rollback-banner state: the exception node exists but carries no exception class', async () => {
    // docs/design/Chautauqua Speakers.dc.html:563 (caption at :549
    // "Speakers · a write failed" -- optimistic rollback, said out loud;
    // this is the SAME head-summary line, entirely plain, above the
    // rollback banner the frame also draws) --
    verbatimLine(563, '          <span style="font-size:13px; color:#565A4B">12 accepted · 3 overdue</span>');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_WITH_ROWS,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': {
        status: 404,
        body: errorEnvelope('not_found', 'Task assignment not found'),
      },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    const table = within(await screen.findByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' }));

    await screen.findByRole('alert');

    const strongs = summaryStrongNodes();
    expect(strongs).toHaveLength(1);
    expect(strongs[0]?.className).toBe('');
  });

  it('roster drill-in: no emphasized node at all', async () => {
    // docs/design/Chautauqua Speakers.dc.html:264 --
    verbatimLine(264, '        <span style="font-size:13px; color:#565A4B">12 accepted · 2 not claimed</span>');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID_WITH_ROWS,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /^Roster/ }));

    await screen.findByRole('heading', { name: 'Roster' });
    const summary = document.querySelector('.chq-speakers-roster-drillin .chq-summary')!;
    expect(summary.querySelectorAll('strong')).toHaveLength(0);
    expect(summary.textContent).toMatch(/^\d+ accepted · \d+ not claimed$/);
  });
});
