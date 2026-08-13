// DEC-616: the drawer is a record, not a form — a component-render smoke
// test asserting (1) labelled facts render as plain values from the fixture
// ContactDetail (including an em dash for an absent value, never a
// fabricated one), (2) the "Across your events" section renders one row per
// history entry across all three history collections, and (3) the bottom
// action bar exposes Save / Email / Add to event as real <button>s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContactDrawer } from './ContactDrawer';
import { mockApi } from '../../test-utils/mockApi';
import type { ContactDetail } from './types';

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
    submissions: [{ id: 'sub1', ref: 'SUB-1', title: 'Scaling caches', eventName: 'DevCon 2026', status: 'accepted' }],
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
