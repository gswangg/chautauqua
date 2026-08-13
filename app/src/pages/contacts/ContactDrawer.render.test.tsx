// DEC-616: the drawer is a record, not a form — a component-render smoke
// test asserting (1) labelled facts render as plain values from the fixture
// ContactDetail (including an em dash for an absent value, never a
// fabricated one), (2) the "Across your events" section renders one row per
// history entry across all three history collections, and (3) the bottom
// action bar exposes Save / Email / Add to event as real <button>s.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactDrawer } from './ContactDrawer';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { ContactDetail } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED_CSS = readFileSync(join(HERE, '../../styles.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector -- same helper as FilterRulesPanel.render.test.tsx. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const CONTACT: ContactDetail = {
  id: 'ct1',
  firstName: 'Priya',
  lastName: 'Raman',
  email: 'priya@example.com',
  company: 'Latticework Systems',
  title: 'Principal Engineer',
  labels: [],
  phone: null,
  notes: null,
  bio: 'Distributed systems engineer.',
  headshotUrl: null,
  socialLinks: { twitter: '@priya', linkedin: null, github: null, website: null },
  customFields: {},
  history: {
    submissions: [
      { id: 'sub1', ref: 'SUB-1', title: 'Scaling caches', eventId: 'ev-1', eventName: 'DevCon 2026', status: 'accepted' },
    ],
    emails: [{ id: 'em1', subject: 'Welcome', toEmail: 'priya@example.com', sentAt: 1735689600000 }],
    events: ['DevCon 2025'],
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ContactDrawer render (DEC-616 record view)', () => {
  it('renders label/value facts, one em dash for an absent value, and the action bar', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });

    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    // DEC-960: ModalFrame is now the sole scrim/dialog frame, but the
    // drawer's own geometry (fixed right-hand panel, not a centred modal)
    // must still win the cascade -- the dialog element carries chq-drawer
    // alongside ModalFrame's own chq-modal class.
    const modalEl = dialog.querySelector('.chq-modal');
    expect(modalEl).toHaveClass('chq-drawer');

    // '{company} · {title}' subline.
    expect(within(dialog).getByText('Latticework Systems · Principal Engineer')).toBeInTheDocument();

    // Labels present, uppercase-tracked via CSS (class asserted, not computed style).
    expect(within(dialog).getByText('Company')).toBeInTheDocument();
    expect(within(dialog).getByText('Title')).toBeInTheDocument();
    expect(within(dialog).getByText('Latticework Systems')).toBeInTheDocument();
    expect(within(dialog).getByText('Principal Engineer')).toBeInTheDocument();
    expect(within(dialog).getByText('Distributed systems engineer.')).toBeInTheDocument();

    // Phone is absent on the fixture -> renders as an em dash, never "" or "null".
    const phoneLabel = within(dialog).getByText('Phone');
    const phoneRow = phoneLabel.closest('.chq-contacts-record-row');
    expect(phoneRow).not.toBeNull();
    expect(within(phoneRow as HTMLElement).getByText('—')).toBeInTheDocument();

    // Close affordance present.
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders one history row per submission/email/event history entry', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    const history = await within(dialog).findByRole('region', { name: 'Across your events' });

    await waitFor(() => {
      expect(within(history).getByText('DevCon 2026')).toBeInTheDocument();
    });

    const rows = history.querySelectorAll('.chq-contacts-history-row');
    expect(rows.length).toBe(
      CONTACT.history.submissions.length + CONTACT.history.emails.length + CONTACT.history.events.length,
    );

    expect(within(history).getByText(/Scaling caches \(SUB-1\) — accepted/)).toBeInTheDocument();
    expect(within(history).getByText(/Welcome → priya@example.com/)).toBeInTheDocument();
    expect(within(history).getByText('DevCon 2025')).toBeInTheDocument();
  });

  it('exposes Save / Email / Add to event as real buttons in one action bar', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const saveButton = within(dialog).getByRole('button', { name: 'Save' });
    const emailButton = within(dialog).getByRole('button', { name: 'Email' });
    const addToEventButton = within(dialog).getByRole('button', { name: 'Add to event' });

    expect(saveButton.tagName).toBe('BUTTON');
    expect(emailButton.tagName).toBe('BUTTON');
    expect(addToEventButton.tagName).toBe('BUTTON');

    const actionBar = saveButton.closest('.chq-contacts-drawer-actions');
    expect(actionBar).not.toBeNull();
    expect(actionBar).toContainElement(emailButton);
    expect(actionBar).toContainElement(addToEventButton);
  });

  // DEC-894: the headshot file input uses the shared .chq-file control
  // (not the generic .chq-input, which overflows the panel), and the
  // drawer prints the stored file's filename and upload date beside the
  // image so an uploaded headshot reads as a record, not decoration.
  it('gives the headshot input the shared .chq-file class and prints stored file metadata', async () => {
    const contactWithHeadshot: ContactDetail = {
      ...CONTACT,
      headshotUrl: '/headshots/file1',
      headshotFile: { filename: 'priya-headshot.jpg', uploadedAt: 1735689600000 },
    };
    mockApi({ 'GET /api/v1/contacts/ct1': contactWithHeadshot });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const fileInput = dialog.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveClass('chq-file');
    expect(fileInput).not.toHaveClass('chq-input');

    expect(within(dialog).getByText(/priya-headshot\.jpg/)).toBeInTheDocument();
  });

  // DEC-894 amendment (wave 53): .chq-file had no width bound at all, so
  // the UA's intrinsic file-input width won and pushed the control's right
  // edge past the drawer's viewport (~38px of horizontal scroll). The rule
  // must bound the control to its container.
  it('bounds .chq-file to its container so the drawer never scrolls horizontally', () => {
    const body = topLevelRuleBody(SHARED_CSS, '.chq-file');
    expect(body).toMatch(/max-width:\s*100%/);
  });

  it('renders no headshot metadata line when there is no stored headshot', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    expect(dialog.querySelector('.chq-contacts-headshot-meta')).toBeNull();
  });
});

describe('ContactDrawer delete (DEC-758)', () => {
  it('offers a quiet tertiary "Delete this contact" control, and confirming names the record', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(
      <MemoryRouter>
        <ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const deleteTrigger = within(dialog).getByRole('button', { name: 'Delete this contact' });
    expect(deleteTrigger.tagName).toBe('BUTTON');
    expect(deleteTrigger.className).toContain('chq-btn-tertiary');

    fireEvent.click(deleteTrigger);

    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this contact' });
    expect(
      within(confirmDialog).getByText(
        'Delete Priya Raman? Any task assignments and sourcing-pipeline history for this person are removed with them. This cannot be undone.',
      ),
    ).toBeInTheDocument();
    expect(within(confirmDialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(confirmDialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('closes the drawer and refetches on a successful delete', async () => {
    const onSaved = vi.fn();
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      // mockApi's Response constructor can't carry a 204 + body (per the
      // Fetch spec) -- 200 exercises the same res.ok success path apiDelete
      // reads (the route itself returns a real, bodyless 204).
      'DELETE /api/v1/contacts/ct1': { status: 200, body: { ok: true } },
    });

    render(
      <MemoryRouter>
        <ContactDrawer contactId="ct1" onClose={() => {}} onSaved={onSaved} onContactChanged={() => {}} />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this contact' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this contact' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('on a 409, shows the server message with a Duplicates-tab link and keeps the drawer open', async () => {
    const onSaved = vi.fn();
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      'DELETE /api/v1/contacts/ct1': {
        status: 409,
        body: errorEnvelope('conflict', 'This contact is on 3 submissions and 1 task. Merge it into another record instead of deleting it.', {
          participants: '3',
          taskAssignments: '1',
        }),
      },
    });

    render(
      <MemoryRouter>
        <ContactDrawer contactId="ct1" onClose={() => {}} onSaved={onSaved} onContactChanged={() => {}} />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this contact' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this contact' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        within(confirmDialog).getByText(
          'This contact is on 3 submissions and 1 task. Merge it into another record instead of deleting it.',
        ),
      ).toBeInTheDocument();
    });
    expect(within(confirmDialog).getByRole('link', { name: 'Go to the Duplicates tab' })).toHaveAttribute(
      'href',
      '/contacts?tab=duplicates',
    );

    // Neither onSaved (which would close+refetch) nor the confirm dialog's
    // own dismissal fired -- the drawer and its confirm step stay open.
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Contact detail' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete this contact' })).toBeInTheDocument();
  });
});
