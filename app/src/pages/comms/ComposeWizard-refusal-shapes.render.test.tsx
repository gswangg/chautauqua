// DEC-505 (wave-13 amendment task-w13-a): the ledger's `proven` citation for
// ComposeWizard.tsx (`refusal-rendering-ledger.scan.test.ts`) previously
// pointed at compose-refusal-shapes.test.ts -- a readFileSync source-grep
// over ComposeWizard.tsx with zero `render(` calls and zero `errorEnvelope`
// calls, so it proved the component's SOURCE names a resolution branch,
// never that a server-authored refusal actually reaches the rendered DOM.
// This file is the missing DOM proof: it drives the wizard through
// mockApi/errorEnvelope exactly as src/routes/comms/compose-core.ts and
// send.ts really respond, for the two fields-map shapes runPreview/send
// resolve by name -- 'no eligible recipients' and 'missing merge fields: …'
// -- and asserts the server's own message/fields text lands verbatim in the
// DOM, not a client-composed sentence.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { SubmissionListItem } from '../submissions/types';

const EVENT_ID = 'evt-compose-refusals';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  window.history.pushState({}, '', '/comms/compose?ids=sub1');
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.history.pushState({}, '', '/');
  vi.unstubAllGlobals();
  cleanup();
});

const SUB1: SubmissionListItem = {
  id: 'sub1',
  ref: 'S1',
  title: 'Intro to Rust',
  status: 'accepted',
  contentStatus: 'approved',
  speakers: [{ contactId: 'c1', name: 'Ada Lovelace', email: 'ada@example.com' } as never],
  trackIds: [],
  submittedAt: 1000,
  createdAt: 1000,
  slot: null,
};

function mockBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([SUB1]),
    [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([]),
    ...overrides,
  });
}

/** Arrives on step 2 (?ids=sub1 hydration) and fills in the minimum for the
 * "Next: preview" primary to be enabled. */
async function reachTemplateStep() {
  render(
    <MemoryRouter>
      <ComposeWizard eventId={EVENT_ID} />
    </MemoryRouter>,
  );
  const subjectInput = await screen.findByLabelText('Subject');
  fireEvent.change(subjectInput, { target: { value: 'Congratulations!' } });
  const bodyInput = screen.getByLabelText('Body');
  fireEvent.change(bodyInput, { target: { value: 'You are in.' } });
  return screen.getByRole('button', { name: 'Next: preview' });
}

describe('ComposeWizard refusal shapes reach the DOM verbatim (DEC-505/DEC-317)', () => {
  it("'no eligible recipients' refusal message renders in the top error banner, not a client-composed sentence", async () => {
    mockBase({
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        status: 400,
        body: errorEnvelope('invalid', 'These submissions have no eligible recipients to send to.', {
          sub1: 'no eligible recipients',
        }),
      },
    });
    const nextButton = await reachTemplateStep();
    fireEvent.click(nextButton);

    // Rendered both by the wizard's top banner and the step-local repeat
    // (DEC-856 grammar) -- both instances are the server's own sentence,
    // never a client-composed one.
    const messageNodes = await screen.findAllByText(
      'These submissions have no eligible recipients to send to.',
    );
    expect(messageNodes.length).toBeGreaterThanOrEqual(1);
    // Resolved through the already-loaded submission, not left as a raw id.
    expect(await screen.findByText('S1 — Intro to Rust')).toBeInTheDocument();
  });

  it("'missing merge fields: …' refusal lists the server-named field per recipient, not a generic sentence", async () => {
    mockBase({
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Some recipients are missing merge fields.', {
          'c1:sub1': 'missing merge fields: track',
        }),
      },
    });
    const nextButton = await reachTemplateStep();
    fireEvent.click(nextButton);

    const messageNodes = await screen.findAllByText('Some recipients are missing merge fields.');
    expect(messageNodes.length).toBeGreaterThanOrEqual(1);
    // Resolved through the matching submission's speaker, naming the person
    // and the exact missing merge-field token -- never a raw contact id.
    expect(await screen.findByText('Ada Lovelace — missing {track}')).toBeInTheDocument();
  });
});
