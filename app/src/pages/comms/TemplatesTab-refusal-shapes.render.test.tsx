// DEC-505/DEC-856 (wave-13 amendment): src/routes/comms/templates.ts's POST
// /events/:eventId/templates and PATCH /templates/:templateId both throw a
// {name,subject,bodyText}-keyed "Validation failed" ApiError (:51/:92). Save
// used to read only err.message, so any of those three refusals rendered
// the same generic top-level sentence, dropping which field the server
// actually objected to. This proves each field-keyed refusal now reaches
// its own control, and that a field-less refusal (not_found) still renders
// through the shared top-level banner unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesTab } from './TemplatesTab';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { EmailTemplate } from './types';

const EVENT_ID = 'evt-templates-refusal';

function template(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tpl-1',
    eventId: EVENT_ID,
    name: 'Acceptance',
    subject: 'You are in!',
    bodyText: 'Hi {speaker_name}',
    lastUsedAt: null,
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('TemplatesTab save refusal shapes (DEC-856 wave-13 amendment)', () => {
  it('a { subject } refusal renders beside the Subject field', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      'PATCH /api/v1/templates/tpl-1': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { subject: 'must be a non-empty string' }),
      },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    const subjectInput = screen.getByLabelText('Subject');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const label = subjectInput.closest('label')!;
      expect(label.textContent).toContain('must be a non-empty string');
    });
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  it('a { bodyText } refusal renders beside the Body field', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      'PATCH /api/v1/templates/tpl-1': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { bodyText: 'must be a non-empty string' }),
      },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    const bodyField = screen.getByLabelText('Body');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const label = bodyField.closest('label')!;
      expect(label.textContent).toContain('must be a non-empty string');
    });
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  it('a { name } refusal on the POST (new template) path renders at the Name field too', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/templates`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { name: 'required' }),
      },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'New template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const nameLabel = screen.getByText('Name').closest('label')!;
    await waitFor(() => expect(nameLabel.textContent).toContain('required'));
  });

  it('a field-less refusal (template not found) still renders through the shared top-level banner', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      'PATCH /api/v1/templates/tpl-1': {
        status: 404,
        body: errorEnvelope('not_found', 'Template not found'),
      },
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Template not found')).toBeInTheDocument();
    expect(document.querySelector('.chq-error-banner')?.textContent).toBe('Template not found');
  });
});
