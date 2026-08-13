// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke test
// for the form-builder page. Mounts the real FormsPage against the real
// GET .../forms single-object envelope ({id, fields: [...]}, not a list
// envelope -- DEC-146/wire-contract shaped payload), asserts the field
// list renders a conditional-rule field's condition summary, opens
// FieldModal (create), and asserts FormSettings renders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FormsPage } from './FormsPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { CfpForm } from './types';

const EVENT_ID = 'evt-forms-render';

const FORM: CfpForm = {
  id: 'form-1',
  eventId: EVENT_ID,
  title: 'DevCon 2026 CFP',
  intro: 'Submit your talk!',
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracks: [],
  fields: [
    { id: 'f1', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true },
    {
      id: 'f2',
      section: 'session',
      kind: 'text',
      label: 'Co-speaker email',
      required: false,
      position: 1,
      locked: false,
      rule: { fieldId: 'f1', op: 'eq', value: 'Panel' },
    },
  ],
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('FormsPage render smoke', () => {
  it('renders the field list with a conditional-rule field, opens FieldModal, and renders FormSettings', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-1', name: 'Frontend' }]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 47 }),
    });

    const { container } = render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Co-speaker email')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'CFP form' })).toBeInTheDocument();

    // FieldList (DEC-715 row anatomy): the locked built-in gets a quiet
    // caption/kind treatment (no LOCKED pill), and the custom field's
    // condition summary renders as its own line.
    expect(screen.getByText('Shown when Title is "Panel"')).toBeInTheDocument();

    // No up/down move buttons remain; the drag handle is the ONE reorder
    // affordance, a real button with an accessible position label.
    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder Title (position 1 of 2)' })).toBeInTheDocument();

    // Received strip cell: a real read of the submissions total (never a
    // fabricated count), rendered "N submissions".
    await waitFor(() => {
      expect(screen.getByText('47 submissions')).toBeInTheDocument();
    });

    // Required/optional read as text (type), not colour (DEC-367).
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    expect(screen.getByText('Optional')).toBeInTheDocument();

    // Fields-section footer row: "Public link · <url> · Copy" (item 51).
    const footer = container.querySelector('.chq-forms-fields-footer');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByText('http://localhost:3000/submit/devcon-2026')).toBeInTheDocument();
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    // FormSettings strip.
    expect(screen.getByDisplayValue('DevCon 2026 CFP')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Submit your talk!')).toBeInTheDocument();

    // The settings strip renders styled .chq-input controls, not bare
    // elements, and 'Tracks offered' as a pill-toggle chipstrip rather
    // than raw checkboxes (DEC-367/372/379).
    expect(container.querySelectorAll('.chq-forms-settings .chq-input').length).toBeGreaterThan(0);
    const trackToggle = screen.getByRole('button', { name: 'Frontend' });
    expect(trackToggle).toHaveClass('chq-pill');
    expect(trackToggle).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.chq-forms-settings input[type="checkbox"]')).not.toBeInTheDocument();

    // FieldModal (create).
    const addButton = screen.getByRole('button', { name: 'Add a question' });
    expect(addButton).toHaveClass('chq-btn', 'chq-btn-secondary');
    addButton.click();
    const dialog = await screen.findByRole('dialog', { name: 'New field' });
    expect(dialog).toBeInTheDocument();

    // ONE dialog contract (DEC-368/378): [role=dialog] IS the .chq-scrim
    // wrapper, with .chq-modal as a STATIC (single) child.
    expect(dialog).toHaveClass('chq-scrim');
    expect(dialog.children).toHaveLength(1);
    expect(dialog.firstElementChild).toHaveClass('chq-modal');

    // Reveal the dropdown-options textarea and the conditional-rule
    // op/value selects so every DEC-406 shell class gets asserted, not
    // just the always-mounted controls.
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'dropdown' } });
    const fieldSelect = screen.getByLabelText('Field', { selector: 'select' });
    fireEvent.change(fieldSelect, { target: { value: 'f1' } });

    expect(screen.getByLabelText('Section', { selector: 'select' })).toHaveClass('chq-select');
    expect(screen.getByLabelText('Kind', { selector: 'select' })).toHaveClass('chq-select');
    expect(screen.getByLabelText('Label', { selector: 'input' })).toHaveClass('chq-input');
    expect(screen.getByLabelText('Help text', { selector: 'textarea', exact: false })).toHaveClass('chq-textarea');
    expect(screen.getByLabelText('Required', { selector: 'input' })).toHaveClass('chq-check');
    expect(
      screen.getByLabelText('Options (one per line)', { selector: 'textarea', exact: false }),
    ).toHaveClass('chq-textarea');
    expect(fieldSelect).toHaveClass('chq-select');
    expect(screen.getByLabelText('Condition', { selector: 'select' })).toHaveClass('chq-select');
    expect(screen.getByLabelText('Value', { selector: 'input' })).toHaveClass('chq-input');

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const saveButton = within(dialog).getByRole('button', { name: 'Save' });
    expect(cancelButton).toHaveClass('chq-btn', 'chq-btn-secondary');
    expect(cancelButton.parentElement).toHaveClass('chq-modal-actions');
    expect(saveButton).toHaveClass('chq-btn', 'chq-btn-primary');
    expect(saveButton.parentElement).toHaveClass('chq-modal-actions');

    // DEC-378: Escape closes the dialog.
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New field' })).not.toBeInTheDocument();
    });
  });
});
