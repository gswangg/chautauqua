// DEC-144 layer-2 harness (batch B, task-w3-e): component-render smoke test
// for the form-builder page. Mounts the real FormsPage against the real
// GET .../forms single-object envelope ({id, fields: [...]}, not a list
// envelope -- DEC-146/wire-contract shaped payload), asserts the field
// list renders a conditional-rule field's condition summary, opens
// FieldModal (create), and asserts FormSettings renders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    });

    render(<FormsPage />);

    expect(screen.getByRole('heading', { name: 'Forms' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Co-speaker email')).toBeInTheDocument();
    });

    // FieldList: locked marker on the built-in, condition summary on the rule field.
    expect(screen.getByLabelText('Locked built-in field')).toBeInTheDocument();
    expect(screen.getByText('if f1 eq "Panel"')).toBeInTheDocument();

    // FormSettings strip.
    expect(screen.getByDisplayValue('DevCon 2026 CFP')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Submit your talk!')).toBeInTheDocument();

    // FieldModal (create).
    screen.getByRole('button', { name: 'Add field' }).click();
    const dialog = await screen.findByRole('dialog', { name: 'New field' });
    expect(dialog).toBeInTheDocument();
  });
});
