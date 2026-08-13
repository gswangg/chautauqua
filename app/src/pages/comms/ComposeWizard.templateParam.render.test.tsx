// DEC-890 (Templates "Use in a send" -> `?tab=compose&template=<id>`):
// ComposeWizard reads a ?template= landing param at mount and preselects
// that template exactly like the template <select>'s own onChange -- subject
// and body are prefilled from the template, but (DEC-846/DEC-832)
// templateId itself is never posted; only the prefilled text is.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-template-param';

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
  window.history.pushState({}, '', '/');
});

describe('ComposeWizard ?template= landing', () => {
  it('preselects the named template, prefilling subject/body and landing on the template step', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-9');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-9', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Hi {speaker_name}, still waitlisted.' },
      ]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

    const subjectInput = await waitFor(() => screen.getByLabelText('Subject') as HTMLInputElement);
    expect(subjectInput.value).toBe('Waitlist subject');
    const bodyInput = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(bodyInput.value).toBe('Hi {speaker_name}, still waitlisted.');

    // Preselecting reverts the dropdown to "Write from scratch" (templateId
    // cleared) -- the composer's own edited text is what will be posted.
    const select = screen.getByLabelText('Template') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});
