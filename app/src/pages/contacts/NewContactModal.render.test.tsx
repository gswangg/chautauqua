// DEC-788: NewContactModal fires the create-time duplicate check as the
// name/company/email fields settle (debounced) and renders a quiet inline
// hint above the submit row that never blocks Create.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { NewContactModal } from './NewContactModal';
import { mockApi, errorEnvelope, listEnvelope } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODAL_FRAME_CSS = readFileSync(join(HERE, '..', '..', 'components', 'modal-frame.css'), 'utf-8');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderModal(onCreated = vi.fn()) {
  return render(
    <MemoryRouter>
      <NewContactModal onClose={() => {}} onCreated={onCreated} />
    </MemoryRouter>,
  );
}

// DEC-950: every dialog field is a FormRow -- NewContactModal's five fields
// (First name / Last name / Email / Company / Title) render through the
// shared ModalFrame FormRow, not a bare <label><input></label> pair.
describe('NewContactModal fields render as FormRow (DEC-950)', () => {
  it('renders each field inside a .chq-form-row with its label explicitly associated to the input', () => {
    mockApi({});
    renderModal();

    const rows = document.querySelectorAll('.chq-form-row');
    expect(rows.length).toBe(5);

    for (const labelText of ['First name', 'Last name', 'Email', 'Company', 'Title']) {
      const input = screen.getByLabelText(new RegExp(`^${labelText}`));
      expect(input.closest('.chq-form-row')).not.toBeNull();
    }
  });

  it('marks Company and Title optional', () => {
    mockApi({});
    renderModal();

    const rows = Array.from(document.querySelectorAll('.chq-form-row'));
    const companyRow = rows.find((row) => row.textContent?.includes('Company'));
    const titleRow = rows.find((row) => row.textContent?.includes('Title'));
    expect(companyRow?.querySelector('.chq-form-row-optional')).not.toBeNull();
    expect(titleRow?.querySelector('.chq-form-row-optional')).not.toBeNull();

    const firstNameRow = rows.find((row) => row.textContent?.startsWith('First name'));
    expect(firstNameRow?.querySelector('.chq-form-row-optional')).toBeNull();
  });

  // w3-h/DEC-917 amendment: .chq-form-row-label (ModalFrame's FormRow label)
  // sets text-transform: uppercase; before this fix .chq-form-row-optional
  // never reset it, so this modal's "Company" / "Title" rows painted
  // ' · OPTIONAL' instead of the ruled-on lowercase ' · optional'
  // (DESIGN-RULINGS #7/#21). Pin both the class's presence and the CSS rule
  // that keeps it lowercase, so a future ancestor rewrite can't silently
  // re-uppercase it.
  it('renders .chq-form-row-optional with a stylesheet rule that resets the label ancestor\'s uppercase', () => {
    mockApi({});
    renderModal();

    const rows = Array.from(document.querySelectorAll('.chq-form-row'));
    const companyRow = rows.find((row) => row.textContent?.includes('Company'));
    const optionalSpan = companyRow?.querySelector('.chq-form-row-optional');
    expect(optionalSpan).not.toBeNull();
    expect(optionalSpan?.closest('.chq-form-row-label')).not.toBeNull();

    const match = MODAL_FRAME_CSS.match(/\.chq-form-row-optional\s*\{([^}]*)\}/);
    expect(match?.[1]).toContain('text-transform: none');
  });
});

// DEC-597 (wave 64 amendment): the modal states why email is required and
// ends by naming what it does not do (directory add != event add).
describe('NewContactModal copy (DEC-597 wave 64 amendment)', () => {
  it('gives the email field a help reason about matching/merging', () => {
    mockApi({});
    renderModal();

    const emailInput = screen.getByLabelText('Email');
    const helpText = emailInput.closest('.chq-form-row')?.querySelector('.chq-form-row-help');
    expect(helpText).not.toBeNull();
    expect(helpText?.textContent).toMatch(/matched and merged/);
  });

  it('closes by naming that adding a contact does not put them on an event', () => {
    mockApi({});
    renderModal();

    expect(screen.getByText(/does not put them on an event/)).toBeInTheDocument();
    expect(screen.getByText(/Add to an event/)).toBeInTheDocument();
  });
});

// DEC-597 (wave 8 amendment): frame 08--16's anatomy -- subtitle, primary
// verb, neutral placeholders, and the two-up First/Last + Company/Title
// rows -- WITHOUT the frame's false "Must be unique" email caption.
describe('NewContactModal frame 08--16 anatomy (DEC-597 wave 8 amendment)', () => {
  it('renders "Add the contact" as the primary action\'s accessible name', () => {
    mockApi({});
    renderModal();
    expect(screen.getByRole('button', { name: 'Add the contact' })).toBeInTheDocument();
  });

  it('renders the "Added to the org, not to an event" subtitle', () => {
    mockApi({});
    renderModal();
    expect(document.querySelector('.chq-modal-sub')?.textContent).toBe('Added to the org, not to an event');
  });

  it('keeps the closing scope note distinct from the subtitle', () => {
    mockApi({});
    renderModal();
    expect(screen.getByText(/does not put them on an event/)).toBeInTheDocument();
  });

  it('uses neutral, non-example placeholders for all five fields', () => {
    mockApi({});
    renderModal();
    expect(screen.getByLabelText('First name')).toHaveAttribute('placeholder', 'First name');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('placeholder', 'Last name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'their@email.com');
    expect(screen.getByLabelText(/^Company/)).toHaveAttribute('placeholder', 'Company');
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute('placeholder', 'Job title');
  });

  it('does not adopt the frame\'s "Must be unique" email caption (DEC-597)', () => {
    mockApi({});
    renderModal();
    const emailInput = screen.getByLabelText('Email');
    const helpText = emailInput.closest('.chq-form-row')?.querySelector('.chq-form-row-help');
    expect(helpText?.textContent).not.toMatch(/Must be unique/);
    expect(helpText?.textContent).toMatch(/matched and merged/);
  });

  it('groups First/Last name in one row container, and Company/Title in another, while Email stands alone', () => {
    mockApi({});
    renderModal();

    const firstNameRow = screen.getByLabelText('First name').closest('.chq-form-row');
    const lastNameRow = screen.getByLabelText('Last name').closest('.chq-form-row');
    const companyRow = screen.getByLabelText(/^Company/).closest('.chq-form-row');
    const titleRow = screen.getByLabelText(/^Title/).closest('.chq-form-row');
    const emailRow = screen.getByLabelText('Email').closest('.chq-form-row');

    const nameContainer = firstNameRow?.closest('.chq-contacts-new-contact-row-2up');
    expect(nameContainer).not.toBeNull();
    expect(lastNameRow?.closest('.chq-contacts-new-contact-row-2up')).toBe(nameContainer);

    const companyContainer = companyRow?.closest('.chq-contacts-new-contact-row-2up');
    expect(companyContainer).not.toBeNull();
    expect(titleRow?.closest('.chq-contacts-new-contact-row-2up')).toBe(companyContainer);
    expect(companyContainer).not.toBe(nameContainer);

    expect(emailRow?.closest('.chq-contacts-new-contact-row-2up')).toBeNull();
  });
});

describe('NewContactModal duplicate hint (DEC-788)', () => {
  it('shows a "Possible duplicate" hint once the check finds a match, and Create still succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      'GET /api/v1/contacts/duplicates/check': {
        items: [{ id: 'ct-1', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', company: 'Latticework', reason: 'email' }],
      },
      'POST /api/v1/contacts': { status: 201, body: { id: 'ct-new', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com' } },
    });

    renderModal();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Raman' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'priya@example.com' } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicate:/)).toBeInTheDocument();
    });
    const duplicateLink = screen.getByRole('link', { name: /Priya Raman, Latticework/ });
    expect(duplicateLink).toBeInTheDocument();
    // DEC-834 / DEC-837: the app is mounted under <BrowserRouter basename="/admin">,
    // so an in-app `to` must be basename-relative ("/contacts?...") -- a
    // "/admin/..." literal here would double the prefix to /admin/admin/...
    expect(duplicateLink).toHaveAttribute('href', '/contacts?openContact=ct-1');

    const createButton = screen.getByRole('button', { name: 'Add the contact' });
    expect(createButton).not.toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicate:/)).toBeInTheDocument();
    });
  });

  it('renders no hint when the check finds nothing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      'GET /api/v1/contacts/duplicates/check': { items: [] },
    });

    renderModal();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nora' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'North' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nora@example.com' } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText(/Possible duplicate:/)).not.toBeInTheDocument();
  });
});

describe('NewContactModal duplicate-address 409 (DEC-755 amendment wave 43)', () => {
  it('renders the inline email field error and an "Open the existing record" link on a 409', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates/check': { items: [] },
      'POST /api/v1/contacts': {
        status: 409,
        body: errorEnvelope('conflict', 'Priya Raman already uses this email', {
          email: 'Already on an existing contact',
        }),
      },
      'GET /api/v1/contacts': listEnvelope([
        { id: 'ct-existing', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com' },
      ]),
    });

    renderModal();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Raman' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'priya@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add the contact' }));

    await waitFor(() => {
      expect(document.querySelector('.chq-error')).toHaveTextContent('Priya Raman already uses this email');
    });
    expect(screen.getByLabelText(/^Email/).closest('.chq-form-row')?.textContent).toContain(
      'Already on an existing contact',
    );

    // DEC-788 amendment (wave 8): the 409 forward path now rides the shared
    // DuplicateEmailNotice component (also used by RosterPanel's
    // Add-speaker), which resolves the existing contact and links it with
    // "Open this contact".
    const openLink = await screen.findByRole('link', { name: 'Open this contact' });
    expect(openLink).toHaveAttribute('href', '/contacts?openContact=ct-existing');
  });

  it('does not offer the open-existing link for a non-conflict error', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates/check': { items: [] },
      'POST /api/v1/contacts': {
        status: 400,
        body: errorEnvelope('invalid', 'Validation failed', { email: 'must be a valid email address' }),
      },
    });

    renderModal();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Raman' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add the contact' }));

    await waitFor(() => {
      expect(document.querySelector('.chq-error')).toHaveTextContent('Validation failed');
    });
    expect(screen.queryByRole('link', { name: 'Open this contact' })).not.toBeInTheDocument();
  });
});
