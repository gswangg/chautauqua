// DEC-597: (1) the New-contact dialog contract — .chq-scrim/.chq-modal,
// opened via the "New contact" toolbar button, posts to POST /contacts and
// reloads the directory. (2) the pipeline phone-card list must be
// display:none at desktop width (the verified "stray concatenated row"
// bug: .chq-contacts-pipeline-phone-stages had a desktop display:none but
// .chq-contacts-pipeline-phone-list had none, so the phone list rendered
// unstyled underneath the desktop board). jsdom does not evaluate @media
// rules, so — mirroring app/src/shell-geometry.test.ts — the CSS half of
// this is a source-scan of contacts-panels.css's own text rather than
// computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-contacts-new-contact';
const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector — same helper as shell-geometry.test.ts. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
});

describe('contacts-panels.css: pipeline phone list hidden at desktop width', () => {
  it('.chq-contacts-pipeline-phone-list is display:none outside the 700px media query', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-pipeline-phone-list');
    expect(body).toMatch(/display:\s*none/);
  });

  it('.chq-contacts-pipeline-phone-stages is also display:none at desktop (existing, unchanged)', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-pipeline-phone-stages');
    expect(body).toMatch(/display:\s*none/);
  });
});

describe('ContactsApp: New-contact dialog (DEC-597)', () => {
  it('opens the dialog from the toolbar, submits to POST /contacts, and reloads the directory', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/stats': { total: 0, topCompanies: [] },
      'GET /api/v1/segments': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([]),
      'POST /api/v1/contacts': { status: 201, body: { id: 'ct-new', firstName: 'Nora', lastName: 'North', email: 'nora@example.com' } },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole('button', { name: 'New contact' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'New contact' });
    expect(dialog).toBeInTheDocument();

    // DEC-950: every dialog field is a FormRow -- the New-contact fields
    // render through the shared .chq-form-row skeleton, not a bare label.
    expect(dialog.querySelectorAll('.chq-form-row').length).toBe(5);

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nora' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'North' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nora@example.com' } });

    const before = fetchMock.mock.calls.filter(([input]) => (typeof input === 'string' ? input : input.toString()).includes('/api/v1/contacts?') || (typeof input === 'string' ? input : input.toString()).endsWith('/api/v1/contacts')).length;

    fireEvent.click(screen.getByRole('button', { name: 'Add the contact' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New contact' })).not.toBeInTheDocument();
    });

    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST');
    expect(postCalls.length).toBeGreaterThan(0);

    // Directory reload fired (GET /contacts called again after creation).
    const contactsGets = fetchMock.mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : input.toString();
      return url.includes('/api/v1/contacts') && (init?.method ?? 'GET').toUpperCase() === 'GET';
    });
    expect(contactsGets.length).toBeGreaterThan(before);
  });

  it('Escape closes the dialog', async () => {
    mockApi({
      'GET /api/v1/contacts/stats': { total: 0, topCompanies: [] },
      'GET /api/v1/segments': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'New contact' }));
    await screen.findByRole('dialog', { name: 'New contact' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New contact' })).not.toBeInTheDocument();
    });
  });
});
