// DEC-959: the "Contact · 390" frame cut of docs/design/Chautauqua
// Contacts.dc.html (its head band and docked footer are receipted line by
// line at the expects below, not claimed here)
// becomes a READ screen -- values render as inert text, and the sticky
// action bar is replaced by the frame's two-control dock (Email / Edit).
// Follows the matchMedia-stub idiom PlanEditor.render.test.tsx:2496-2504
// uses to force useIsPhone's split in jsdom (which implements no
// matchMedia at all), unstubbed in afterEach so every OTHER render test in
// this directory keeps exercising the desktop tree by default.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContactDrawer } from './ContactDrawer';
import { mockApi } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
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
  history: {
    submissions: [],
    submissionsTotal: 0,
    emails: [],
    emailsTotal: 0,
    events: [],
    eventsTotal: 0,
  },
};

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetEventsCacheForTests();
});

describe('ContactDrawer phone read mode (DEC-959)', () => {
  it('phone: renders exactly the two-control dock, no drawer actions, and inert values', async () => {
    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    // docs/design/Chautauqua Contacts.dc.html:408 `<div style="border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:7px">`
    // -- the READ cut's head band; its docked footer below carries exactly
    // two controls.
    const dock = dialog.querySelector('[data-chq-phone-dock]');
    expect(dock).not.toBeNull();
    expect(dock).toHaveClass('chq-phone-dock');
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons.map((b) => b.textContent)).toEqual(['Email Priya', 'Edit']);

    expect(dialog.querySelector('.chq-contacts-drawer-actions')).toBeNull();

    // Values render as inert text, never a click-to-edit button.
    expect(dialog.querySelector('button.chq-contacts-record-value')).toBeNull();
    expect(within(dialog).getByText('priya@example.com')).toBeInTheDocument();
  });

  it('phone: pressing Edit mounts the five-control action bar and unmounts the dock', async () => {
    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit' }));

    const actions = dialog.querySelector('.chq-contacts-drawer-actions');
    expect(actions).not.toBeNull();
    expect(within(actions as HTMLElement).getByRole('button', { name: 'Delete this contact' })).toBeInTheDocument();
    expect(within(actions as HTMLElement).getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(within(actions as HTMLElement).getByRole('button', { name: 'Add to event' })).toBeInTheDocument();
    expect(within(actions as HTMLElement).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(actions as HTMLElement).getByRole('button', { name: 'Save' })).toBeInTheDocument();

    expect(dialog.querySelector('[data-chq-phone-dock]')).toBeNull();
  });

  it('phone: "Email Priya" opens BulkEmailModal', async () => {
    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Email Priya' }));

    expect(await screen.findByRole('dialog', { name: /email/i })).toBeInTheDocument();
  });

  it('desktop (no matchMedia stub): the actions bar renders, the dock is absent, values are buttons', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    expect(dialog.querySelector('.chq-contacts-drawer-actions')).not.toBeNull();
    expect(dialog.querySelector('[data-chq-phone-dock]')).toBeNull();

    const emailLabel = within(dialog)
      .getAllByText('Email')
      .find((el) => el.classList.contains('chq-contacts-record-label')) as HTMLElement;
    const emailRow = emailLabel.closest('.chq-contacts-record-row') as HTMLElement;
    const emailValueButton = within(emailRow).getByText('priya@example.com');
    expect(emailValueButton.tagName).toBe('BUTTON');
  });
});
