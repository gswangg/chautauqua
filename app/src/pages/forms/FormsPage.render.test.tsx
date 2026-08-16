// DEC-144 layer-2 harness (batch B, task-w3-e; w42-i: builder ends at the
// Public link row, DEC-731). Mounts the real FormsPage against the real
// GET .../forms single-object envelope ({id, fields: [...]}, not a list
// envelope -- DEC-146/wire-contract shaped payload), asserts the field
// list renders a conditional-rule field's condition summary, opens
// FieldModal (create), and asserts the Settings > Call for papers link
// renders in place of the old FormSettings block.
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
      id: 'form-1:description',
      section: 'session',
      kind: 'long_text',
      label: 'Abstract',
      required: true,
      position: 1,
      locked: true,
    },
    {
      id: 'f2',
      section: 'session',
      kind: 'text',
      label: 'Co-speaker email',
      required: false,
      position: 2,
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
  it('renders the field list with a conditional-rule field, opens FieldModal, and links into Settings > Call for papers', async () => {
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

    // Frame-04 anatomy (w5-h): the builder header bar goes full bleed at
    // 1440 -- the page root carries .chq-measure-table, not the narrower
    // .chq-measure the content column below re-clamps itself to.
    const pageRoot = container.querySelector('.chq-forms-page');
    expect(pageRoot).toHaveClass('chq-measure-table');
    expect(pageRoot).not.toHaveClass('chq-measure');

    // DEC-008 amendment (w45-e), frame-04 anatomy (w5-h): the builder
    // synthesizes a Track row from the event's tracks -- the SAME
    // single-choice question the public CFP (TrackChoices) renders -- as a
    // view, never a real field row backed by its own PATCH/DELETE. It still
    // carries the same ⋮⋮ handle its siblings have (disabled -- there is no
    // real position to drag) and an active Edit whose target is the
    // Settings tracks editor, paired with a greyed (disabled) Delete like
    // every other built-in row -- "Manage in Settings" no longer stands in
    // for the row's Edit/Delete pair.
    const trackRow = screen.getByText('Track').closest('[role="listitem"]') as HTMLElement;
    expect(trackRow).not.toBeNull();
    expect(trackRow).toHaveClass('chq-forms-field-locked');
    expect(within(trackRow).getByText('Single choice')).toBeInTheDocument();
    expect(within(trackRow).getByText('1 option')).toBeInTheDocument();
    const trackHandle = within(trackRow).getByRole('button', { name: /^Reorder /i });
    expect(trackHandle).toBeDisabled();
    expect(within(trackRow).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    const trackDelete = within(trackRow).getByRole('button', { name: 'Delete' });
    expect(trackDelete).toBeDisabled();
    const trackLink = within(trackRow).getByRole('link', { name: 'Edit' });
    expect(trackLink).toHaveAttribute('href', '/settings?section=tracks-rooms&edit=1');

    // FieldList (DEC-715 row anatomy): the locked built-in gets a quiet
    // caption/kind treatment (no LOCKED pill), and the custom field's
    // condition summary renders as its own line.
    expect(screen.getByText('Shown when Title is "Panel"')).toBeInTheDocument();

    // No up/down move buttons remain; the drag handle is the ONE reorder
    // affordance, a real button with an accessible position label.
    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder Title (position 1 of 4)' })).toBeInTheDocument();

    // Received strip cell: a real read of the submissions total (never a
    // fabricated count), rendered "N submissions".
    await waitFor(() => {
      expect(screen.getByText('47 submissions')).toBeInTheDocument();
    });

    // Required/optional read as text (type), not colour (DEC-367).
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    expect(screen.getByText('Optional')).toBeInTheDocument();

    // Fields-section footer row: host+path with the protocol stripped
    // ("Public link · <host/path> · Copy", item 51 + gate-3 strip finding);
    // Copy itself still copies the absolute URL.
    const footer = container.querySelector('.chq-forms-fields-footer');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByText('localhost:3000/submit/devcon-2026')).toBeInTheDocument();
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    // G13 lane-D fix (02-submissions--04): the builder ends AT the Public
    // link row -- the frame draws no Settings link below it.
    expect(screen.queryByRole('link', { name: 'Settings › Call for papers' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('DevCon 2026 CFP')).not.toBeInTheDocument();

    // Amendment (wave 72): the header's Save renders from load and is
    // disabled until the Opens/Closes strip differs from the loaded form.
    const headerSave = screen.getByRole('button', { name: 'Save' });
    expect(headerSave).toHaveClass('chq-btn', 'chq-btn-primary');
    expect(headerSave).toBeDisabled();

    // FieldModal (create). Frame 04: "Add a question" is a green text link
    // on the section rule, not a bordered button.
    const addButton = screen.getByRole('button', { name: 'Add a question' });
    expect(addButton).toHaveClass('chq-link-button');
    expect(addButton).not.toHaveClass('chq-btn-secondary');
    addButton.click();
    const dialog = await screen.findByRole('dialog', { name: 'Add a question' });
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
    expect(screen.getByLabelText('Is', { selector: 'select' })).toHaveClass('chq-select');
    expect(screen.getByLabelText('Value', { selector: 'input' })).toHaveClass('chq-input');

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const saveButton = within(dialog).getByRole('button', { name: 'Save the question' });
    // DEC-650 (wave-66 amendment): Save/Cancel sit in their own
    // right-flushed group (chq-forms-field-modal-actions-right) inside the
    // shared chq-modal-actions footer, so a far-left Delete (edit mode
    // only) never lands adjacent to them.
    expect(cancelButton).toHaveClass('chq-btn', 'chq-btn-secondary');
    expect(cancelButton.parentElement).toHaveClass('chq-forms-field-modal-actions-right');
    expect(cancelButton.parentElement?.parentElement).toHaveClass('chq-modal-actions');
    expect(saveButton).toHaveClass('chq-btn', 'chq-btn-primary');
    expect(saveButton.parentElement).toHaveClass('chq-forms-field-modal-actions-right');

    // DEC-378: Escape closes the dialog.
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add a question' })).not.toBeInTheDocument();
    });
  });
});

// Amendment (wave 72): the Opens/Closes strip cells become the page's
// editable CFP window, and the header's Save PATCHes the SAME endpoint and
// payload keys CallForPapersPanel already uses.
describe('FormsPage CFP window Save (DEC-033 wave-72 amendment)', () => {
  const WINDOW_FORM: CfpForm = {
    id: 'form-1',
    eventId: EVENT_ID,
    title: 'DevCon 2026 CFP',
    intro: 'Submit your talk!',
    isDefault: true,
    openDate: Date.UTC(2026, 0, 1),
    closeDate: Date.UTC(2026, 5, 1),
    tracks: [],
    fields: [],
  };

  function setup(patchHandler: unknown) {
    return mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: WINDOW_FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 0 }),
      [`PATCH /api/v1/forms/${WINDOW_FORM.id}`]: patchHandler,
    });
  }

  it('renders Received as a read-only fact, never an input', async () => {
    setup({ ...WINDOW_FORM });
    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
    expect(screen.getByText('0 submissions')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Received/i)).not.toBeInTheDocument();
  });

  it('enables Save when Opens is edited, and Save PATCHes exactly {openDate, closeDate}', async () => {
    const fetchMock = setup({ ...WINDOW_FORM, openDate: Date.UTC(2026, 0, 15) });
    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    const openField = screen.getByLabelText('Opens');
    fireEvent.change(openField, { target: { value: '2026-01-15' } });
    fireEvent.blur(openField);

    await waitFor(() => expect(saveButton).not.toBeDisabled());

    fireEvent.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        (typeof input === 'string' ? input : input.toString()).includes(`/forms/${WINDOW_FORM.id}`) &&
        (init?.method ?? '').toUpperCase() === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse((patchCall?.[1]?.body as string) ?? '{}');
    expect(body).toEqual({ openDate: Date.UTC(2026, 0, 15), closeDate: Date.UTC(2026, 5, 1) });
  });

  it('renders a server 400 naming closeDate on the Closes cell, not a page-level banner', async () => {
    setup({
      status: 400,
      body: {
        error: {
          code: 'validation_error',
          message: 'The call cannot close before it opens.',
          fields: { closeDate: 'Must be after the open date' },
        },
      },
    });
    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    const saveButton = await screen.findByRole('button', { name: 'Save' });
    const closeField = screen.getByLabelText('Closes');
    fireEvent.change(closeField, { target: { value: '2025-01-01' } });
    fireEvent.blur(closeField);

    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    const closesCell = closeField.closest('.chq-forms-strip-cell') as HTMLElement;
    await waitFor(() => {
      expect(within(closesCell).getByText('Must be after the open date')).toBeInTheDocument();
    });
    expect(screen.queryByText('The call cannot close before it opens.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
