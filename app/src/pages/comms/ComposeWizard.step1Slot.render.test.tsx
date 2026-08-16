// task-w51-e item 3 (falsifiability batch B, DEC-358 wave-51): compose
// step-1 SLOT (ComposeWizard.tsx:713-716, "1. Pick submissions") and the
// step-4 "no slot yet" footer list (ComposeWizard.tsx:1226-1230). TEST-ONLY
// per this task's scope -- ComposeWizard.tsx itself is not touched here
// (wave-49's DEC-037 lane may also be touching this file).
//
// Existing coverage (ComposeWizard.render.test.tsx / .idsParam / .template
// Param) already asserts the "1. Pick submissions" label is present on
// first render, but nothing exercises the step-4 per-recipient no-slot
// exclusion LIST with real (mixed scheduled/unscheduled) preview data and
// checks the actual rendered ref/name text for each excluded row -- the
// existing icsRefusal test only covers the DIFFERENT, fully-blocking
// icsUnscheduledIds banner. This file closes that gap.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-step1-slot';

function submission(n: number) {
  return {
    id: `sub-${n}`,
    ref: `S-${String(n).padStart(3, '0')}`,
    title: `Talk number ${n}`,
    status: 'accepted',
    contentStatus: 'approved',
    speakers: [{ contactId: `c${n}`, name: `Speaker ${n}` }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

function page1() {
  return Array.from({ length: 3 }, (_, i) => submission(i + 1));
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

describe('ComposeWizard step-1 "1. Pick submissions" slot (item 3)', () => {
  it('renders the step-1 section label as the section head of the select step, and it disappears on step 2', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    const label = screen.getByText('1. Pick submissions');
    expect(label).toHaveClass('chq-section-label');
    // Statuses filter checkboxes are real siblings of the slot -- confirms
    // this is the live select-step section head, not an unrelated string
    // match elsewhere on the page.
    expect(screen.getByRole('checkbox', { name: 'Accepted' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    await screen.findByLabelText('Subject');
    expect(screen.queryByText('1. Pick submissions')).not.toBeInTheDocument();
  });
});

describe('ComposeWizard step-4 no-slot-yet footer list (item 3)', () => {
  function recipient(contactId: string, submissionId: string, name: string, ref: string, scheduled: boolean) {
    return {
      contactId,
      submissionId,
      email: `${contactId}@example.com`,
      name,
      ref,
      scheduled,
      subject: 'You are in!',
      text: 'See you there',
    };
  }

  it('names each unscheduled recipient individually in the step-4 footer, and omits scheduled ones from that list', async () => {
    const items = [
      recipient('c1', 'sub-1', 'Priya Raman', 'S-001', true),
      recipient('c2', 'sub-2', 'Nadia Ferrone', 'S-002', false),
      recipient('c3', 'sub-3', 'Speaker 3', 'S-003', false),
    ];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    // Step 3: flip attachIcs on -- the mocked preview always returns the
    // same mixed-scheduled items, so this succeeds (200) and populates
    // noSlotCount without tripping the (unrelated) icsUnscheduledIds
    // refusal banner.
    await screen.findByLabelText('Attach calendar invite');
    fireEvent.click(screen.getByLabelText('Attach calendar invite'));
    await screen.findByText('Priya Raman');

    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    await screen.findByText(/3 recipients/);
    expect(screen.getByText(/2 of 3 have no slot yet/)).toBeInTheDocument();

    const noteLines = screen.getAllByText(/no slot yet, no invite attached/);
    expect(noteLines).toHaveLength(2);
    expect(noteLines.some((el) => el.textContent?.includes('S-002') && el.textContent?.includes('Nadia Ferrone'))).toBe(
      true,
    );
    expect(noteLines.some((el) => el.textContent?.includes('S-003') && el.textContent?.includes('Speaker 3'))).toBe(
      true,
    );
    // The scheduled recipient is never listed as excluded.
    expect(noteLines.some((el) => el.textContent?.includes('S-001'))).toBe(false);
  });

  it('omits the no-slot footer entirely when every recipient is scheduled', async () => {
    const items = [
      recipient('c1', 'sub-1', 'Priya Raman', 'S-001', true),
      recipient('c2', 'sub-2', 'Nadia Ferrone', 'S-002', true),
    ];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByLabelText('Attach calendar invite');
    fireEvent.click(screen.getByLabelText('Attach calendar invite'));
    await screen.findByText('Priya Raman');

    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    await screen.findByText(/2 recipients/);
    expect(screen.queryByText(/have no slot yet/)).not.toBeInTheDocument();
  });
});
