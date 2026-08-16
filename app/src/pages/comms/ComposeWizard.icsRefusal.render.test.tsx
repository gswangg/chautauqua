// DEC-317 + DEC-967 amendments (wave 18): the ics-unscheduled refusal
// (DEC-051) fires from runPreview, which step 2's "Next: preview" button can
// call directly (attachIcs was turned on back on step 3, the organizer went
// Back, edited the body, and pressed "Next: preview" again). Before this
// wave the only surfaces rendering icsUnscheduledIds lived inside the
// step === 'preview' / step === 'sent' panels, so that click registered,
// stayed on step 2, and said nothing. This file asserts the refusal is now
// visible on step 2 itself, and that the wizard does not silently advance.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-ics-refusal';

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

describe('ComposeWizard default status selection (DEC-967 amendment, wave 18)', () => {
  it('pre-checks Accepted alone on first render, not Accepted+Declined', async () => {
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
    expect(screen.getByRole('checkbox', { name: 'Accepted' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Declined' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pending' })).not.toBeChecked();
  });
});

describe('ComposeWizard ics-unscheduled refusal renders on the step that issued the request (DEC-317 amendment, wave 18)', () => {
  it('lands on step 2 with attachIcs on, the preview call rejects not-scheduled, and the refusal renders there instead of silently going nowhere', async () => {
    let previewCall = 0;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 3, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: () => {
        previewCall += 1;
        // First call (fired from step 3's own toggle en route to getting
        // attachIcs on) succeeds so the wizard can reach step 3 and flip the
        // toggle; every later call (including the one this test cares
        // about, fired from step 2's "Next: preview") rejects as
        // not-scheduled -- this is the DEC-051 preflight, never weakened.
        if (previewCall === 1) {
          return { items: [{ contactId: 'c1', submissionId: 'sub-1', email: 'c1@example.com', name: 'Speaker 1', ref: 'S-001', scheduled: false, subject: 'Hi', text: 'Body' }] };
        }
        return {
          status: 400,
          body: {
            error: {
              code: 'invalid',
              message: 'Some submissions are not scheduled',
              fields: { 'sub-1': 'not scheduled' },
            },
          },
        };
      },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    // Reached step 3, flip attachIcs on (the preflight succeeds this once).
    await screen.findByLabelText('Attach calendar invite');
    fireEvent.click(screen.getByLabelText('Attach calendar invite'));
    await screen.findByText('Speaker 1');

    // Go Back to step 2, edit the body, press "Next: preview" again -- this
    // is the click that used to register silently.
    fireEvent.click(screen.getByRole('button', { name: 'Back to the template' }));
    await screen.findByLabelText('Body');
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text, edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    // (a) the refusal text is on screen.
    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain("aren't scheduled yet");
    expect(banner.textContent).toContain('S-001 — Speaker 1');

    // (b) the wizard is still on step 2 -- never silently advanced to
    // preview.
    expect(screen.getByLabelText('Body')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    expect(screen.queryByText('Recipients · 1')).not.toBeInTheDocument();
  });
});
