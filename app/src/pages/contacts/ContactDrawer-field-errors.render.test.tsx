// DEC-856 (wave 65): PATCH /contacts/:id (crud.ts) throws a single
// ApiError('invalid', 'Validation failed', fields) with named keys
// (firstName, lastName, email, phone, company, title, bio, notes,
// socialLinks, customFields.<key>). Prior to this task the drawer's catch
// block discarded that map entirely and rendered only the two words
// "Validation failed" -- this test locks the fix: each owned key's message
// renders beside its own control (data-invalid row + role="alert" span),
// and the ONE ErrorSummary above the field groups lists one real anchor per
// problem, with unowned keys (customFields.<key>) rendered labelled instead
// of dropped.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContactDrawer } from './ContactDrawer';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
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
  bio: null,
  headshotUrl: null,
  socialLinks: { twitter: '@priya', linkedin: '', github: '', website: '' },
  customFields: {},
  history: { submissions: [], submissionsTotal: 0, emails: [], emailsTotal: 0, events: [], eventsTotal: 0 },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openDrawer() {
  render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);
  const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
  await waitFor(() => expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument());
  return dialog;
}

describe('ContactDrawer field-error rendering (DEC-856, wave 65)', () => {
  it('puts email + bio messages beside their own control and lists exactly two summary anchors resolving to those control ids', async () => {
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      'PATCH /api/v1/contacts/ct1': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          email: 'must be a valid email address',
          bio: 'Max 20000 characters',
        }),
      },
    });

    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(dialog).getByText('must be a valid email address')).toBeInTheDocument();
    });
    expect(within(dialog).getByText('Max 20000 characters')).toBeInTheDocument();

    // Each message renders inside its own row, and that row is marked invalid.
    const record = dialog.querySelector('.chq-contacts-record') as HTMLElement;
    const emailLabel = within(record).getByText('Email');
    const emailRow = emailLabel.closest('.chq-contacts-record-row') as HTMLElement;
    expect(emailRow).toHaveAttribute('data-invalid', 'true');
    const emailMsg = within(emailRow).getByText('must be a valid email address');
    expect(emailMsg).toHaveAttribute('role', 'alert');
    expect(emailMsg).toHaveClass('chq-field-error');
    expect(emailRow.id).toBeTruthy();

    const bioLabel = within(record).getByText('Bio');
    const bioRow = bioLabel.closest('.chq-contacts-record-row') as HTMLElement;
    expect(bioRow).toHaveAttribute('data-invalid', 'true');
    expect(within(bioRow).getByText('Max 20000 characters')).toHaveAttribute('role', 'alert');
    expect(bioRow.id).toBeTruthy();

    // The ONE ErrorSummary lists exactly two anchors, each resolving to a
    // real element id in the DOM (the two rows just asserted above).
    const summary = dialog.querySelector('.chq-error-summary') as HTMLElement;
    expect(summary).not.toBeNull();
    const links = within(summary).getAllByRole('link');
    expect(links).toHaveLength(2);
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain(`#${emailRow.id}`);
    expect(hrefs).toContain(`#${bioRow.id}`);
    for (const href of hrefs) {
      const targetId = (href as string).slice(1);
      expect(dialog.querySelector(`#${CSS.escape(targetId)}`)).not.toBeNull();
    }
  });

  it('renders a customFields.<key> refusal labelled in the summary, rather than dropping it', async () => {
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      'PATCH /api/v1/contacts/ct1': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', {
          'customFields.travel_logistics': 'Max 2000 characters',
        }),
      },
    });

    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        within(dialog).getByText('customFields.travel_logistics: Max 2000 characters'),
      ).toBeInTheDocument();
    });

    // Never rendered as an unlabelled bullet -- the raw message alone must
    // not appear without its key prefix.
    expect(within(dialog).queryByText('Max 2000 characters')).not.toBeInTheDocument();
  });

  it('renders err.message once when the refusal carries no fields map', async () => {
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      'PATCH /api/v1/contacts/ct1': {
        status: 409,
        body: errorEnvelope('conflict', 'Email already in use by another contact'),
      },
    });

    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(dialog).getByText('Email already in use by another contact')).toBeInTheDocument();
    });
    expect(within(dialog).getAllByText('Email already in use by another contact')).toHaveLength(1);
    expect(dialog.querySelector('.chq-error-summary')).toBeNull();
  });
});
