// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke test
// for the form-builder page. Mounts the real FormsPage against the real
// GET .../forms single-object envelope ({id, fields: [...]}, not a list
// envelope -- DEC-146/wire-contract shaped payload), asserts the field
// list renders a conditional-rule field's condition summary, opens
// FieldModal (create), and asserts FormSettings renders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-1', name: 'Frontend' }]),
    });

    const { container } = render(<FormsPage />);

    await waitFor(() => {
      expect(screen.getByText('Co-speaker email')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'CFP form' })).toBeInTheDocument();

    // FieldList: locked marker on the built-in, condition summary on the rule field.
    expect(screen.getByLabelText('Locked built-in field')).toBeInTheDocument();
    expect(screen.getByText('if f1 eq "Panel"')).toBeInTheDocument();

    // Required/optional read as text (type), not colour (DEC-367).
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    expect(screen.getByText('Optional')).toBeInTheDocument();

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
    expect(screen.getByLabelText('Help text', { selector: 'textarea' })).toHaveClass('chq-textarea');
    expect(screen.getByLabelText('Required', { selector: 'input' })).toHaveClass('chq-check');
    expect(screen.getByLabelText('Options (one per line)', { selector: 'textarea' })).toHaveClass('chq-textarea');
    expect(fieldSelect).toHaveClass('chq-select');
    expect(screen.getByLabelText('Condition', { selector: 'select' })).toHaveClass('chq-select');
    expect(screen.getByLabelText('Value', { selector: 'input' })).toHaveClass('chq-input');

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const saveButton = screen.getByRole('button', { name: 'Save' });
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
