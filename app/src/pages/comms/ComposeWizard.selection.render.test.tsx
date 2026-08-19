// DEC-350 amendment (wave 51, ruling A1): step 1 of the compose wizard gets
// the shared select-all/indeterminate/selection-bar contract from
// ../submissions/selection.ts, matching ContactsTable/SubmissionsTable --
// selecting 23 recipients is no longer 23 clicks.
// DEC-919 wave-96: the 2026-08-16 user ruling supersedes DEC-350 wave-51 for
// every multi-select surface -- the bar is always mounted, idle a visible
// quiet state instead of unmounted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-selection';

function submission(n: number, status: 'accepted' | 'declined' | 'pending' = 'accepted') {
  return {
    id: `sub-${n}`,
    ref: `S-${String(n).padStart(3, '0')}`,
    title: `Talk number ${n}`,
    status,
    contentStatus: 'approved',
    speakers: [{ contactId: `c${n}`, name: `Speaker ${n}` }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

function page(n = 5) {
  return Array.from({ length: n }, (_, i) => submission(i + 1));
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

function headerCheckbox() {
  return screen.getByRole('checkbox', { name: 'Select every submission on this page' }) as HTMLInputElement;
}

describe('ComposeWizard step-1 select-all and selection bar (DEC-350 ruling A1)', () => {
  it('select-all ticks every row on the page and shows the bar', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page(5), { total: 5, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );
    await screen.findByText('Talk number 1');

    const idleBar = screen.getByRole('toolbar', { name: 'Selection' });
    expect(idleBar.className).toContain('chq-bulkbar-idle');
    expect(idleBar.querySelectorAll('.chq-bulkbar-hint')).toHaveLength(1);
    expect(idleBar.querySelectorAll('button')).toHaveLength(0);

    fireEvent.click(headerCheckbox());

    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getByLabelText(`Select Talk number ${i}`)).toBeChecked();
    }
    const bar = screen.getByRole('toolbar', { name: 'Selection' });
    expect(bar.className).not.toContain('chq-bulkbar-idle');
    expect(bar.querySelectorAll('.chq-bulkbar-hint')).toHaveLength(0);
    expect(bar.textContent).toContain('5 submissions selected');
  });

  it('reports indeterminate on the header input when one row is ticked', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page(5), { total: 5, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );
    await screen.findByText('Talk number 1');

    fireEvent.click(screen.getByLabelText('Select Talk number 1'));

    expect(headerCheckbox().indeterminate).toBe(true);
    expect(headerCheckbox().checked).toBe(false);
  });

  it('unticking one row after select-all leaves the others selected', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page(5), { total: 5, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );
    await screen.findByText('Talk number 1');

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByLabelText('Select Talk number 3'));

    expect(screen.getByLabelText('Select Talk number 3')).not.toBeChecked();
    expect(screen.getByLabelText('Select Talk number 1')).toBeChecked();
    expect(screen.getByLabelText('Select Talk number 2')).toBeChecked();
    expect(screen.getByLabelText('Select Talk number 4')).toBeChecked();
    expect(screen.getByLabelText('Select Talk number 5')).toBeChecked();
    expect(headerCheckbox().indeterminate).toBe(true);

    const bar = screen.getByRole('toolbar', { name: 'Selection' });
    expect(bar.textContent).toContain('4 submissions selected');
  });

  it('does not clear the selection when the status filter changes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page(5), { total: 5, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );
    await screen.findByText('Talk number 1');

    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    expect(screen.getByRole('toolbar', { name: 'Selection' }).textContent).toContain('1 submission selected');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Pending' }));

    expect(screen.getByRole('toolbar', { name: 'Selection' }).textContent).toContain('1 submission selected');
    expect(screen.getByLabelText('Select Talk number 1')).toBeChecked();
  });

  it('Clear empties the selection and returns the bar to its idle state', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page(5), { total: 5, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );
    await screen.findByText('Talk number 1');

    fireEvent.click(headerCheckbox());
    expect(screen.getByRole('toolbar', { name: 'Selection' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    const idleBar = screen.getByRole('toolbar', { name: 'Selection' });
    expect(idleBar.className).toContain('chq-bulkbar-idle');
    expect(idleBar.querySelectorAll('.chq-bulkbar-hint')).toHaveLength(1);
    expect(idleBar.querySelectorAll('button')).toHaveLength(0);
    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getByLabelText(`Select Talk number ${i}`)).not.toBeChecked();
    }
    expect(headerCheckbox().checked).toBe(false);
    expect(headerCheckbox().indeterminate).toBe(false);
  });
});
