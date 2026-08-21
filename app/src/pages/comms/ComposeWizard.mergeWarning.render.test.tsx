// task w4-aj (DEC-660/DEC-939, wave-148): the pre-emptive unresolvable-
// merge-field advisory band on the template step (frame :769) and the
// desktop header step breadcrumb (frame :757). Both render from state the
// wizard already holds -- no new /compose/preview round-trip for the band,
// and the breadcrumb's `n` is `currentIndex + 1`, the same index stepMeta
// already derives from `step`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-merge-warning';

function submission(n: number, slot: { day: string; startMin: number; endMin: number; roomName: string | null } | null) {
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
    slot,
  };
}

const SLOT = { day: '2027-05-12', startMin: 540, endMin: 570, roomName: 'Main Hall' };

function threeSubmissionsTwoSlotless() {
  // sub-1 has a slot, sub-2 and sub-3 don't -- selecting all three should
  // read selectedNoSlotCount === 2.
  return [submission(1, SLOT), submission(2, null), submission(3, null)];
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

async function arriveAtTemplateStepSelectingAll() {
  await screen.findByText('Talk number 1');
  fireEvent.click(screen.getByLabelText('Select Talk number 1'));
  fireEvent.click(screen.getByLabelText('Select Talk number 2'));
  fireEvent.click(screen.getByLabelText('Select Talk number 3'));
  fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));
  await screen.findByLabelText('Subject');
}

describe('ComposeWizard pre-emptive unresolvable-merge-field band (DEC-660, frame :769)', () => {
  it('is absent when the body never references a slot-dependent merge field, even with slotless recipients selected', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(threeSubmissionsTwoSlotless(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await arriveAtTemplateStepSelectingAll();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'No merge fields here.' } });

    expect(screen.queryByText(/will not resolve for/)).not.toBeInTheDocument();
  });

  it('is absent when the body uses {session_time} but every selected recipient already has a slot', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([submission(1, SLOT)], { total: 1, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));
    await screen.findByLabelText('Subject');
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'See you at {session_time}.' } });

    expect(screen.queryByText(/will not resolve for/)).not.toBeInTheDocument();
  });

  it('renders the frame heading (pluralised for one field) and a refusal consequence clause, not the frame\'s literal-text claim, once the body uses {session_time} and slotless recipients are selected', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(threeSubmissionsTwoSlotless(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await arriveAtTemplateStepSelectingAll();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'See you at {session_time}.' } });

    const heading = await screen.findByText('One merge field will not resolve for 2 of 3');
    expect(heading).toHaveClass('chq-comms-merge-warning-title');
    const band = heading.closest('.chq-comms-merge-warning');
    expect(band).not.toBeNull();
    expect(band).toHaveAttribute('role', 'status');

    // The frame's own consequence sentence ("They would receive the literal
    // text '{session_time}'") is false for this app -- assert we say the
    // opposite: a refusal, not literal placeholder text.
    expect(within(band as HTMLElement).getByText(/Sending will refuse/)).toBeInTheDocument();
    expect(screen.queryByText(/receive the literal text/)).not.toBeInTheDocument();

    // No new /compose/preview round-trip: still on the template step, no
    // preview call has been mocked or hit for this to appear.
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
  });

  it('checks both subject and body for the slot-dependent token', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(threeSubmissionsTwoSlotless(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await arriveAtTemplateStepSelectingAll();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Your talk at {session_time}' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'No token in the body.' } });

    expect(await screen.findByText('One merge field will not resolve for 2 of 3')).toBeInTheDocument();
  });
});

describe('ComposeWizard desktop header step breadcrumb (DEC-939, frame :757)', () => {
  it('portals "Comms · Compose · step N" into #chq-header-slot and advances N with the step', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(threeSubmissionsTwoSlotless(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    const headerSlot = document.createElement('div');
    headerSlot.id = 'chq-header-slot';
    document.body.appendChild(headerSlot);

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(within(headerSlot).getByText('Comms · Compose · step 1')).toBeInTheDocument());

    await arriveAtTemplateStepSelectingAll();

    await waitFor(() => expect(within(headerSlot).getByText('Comms · Compose · step 2')).toBeInTheDocument());
    expect(within(headerSlot).queryByText('Comms · Compose · step 1')).not.toBeInTheDocument();

    headerSlot.remove();
  });

  it('renders nothing when mounted with no #chq-header-slot node in the document', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(threeSubmissionsTwoSlotless(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    expect(document.getElementById('chq-header-slot')).toBeNull();
    expect(screen.queryByText(/Comms · Compose · step/)).not.toBeInTheDocument();
  });
});
