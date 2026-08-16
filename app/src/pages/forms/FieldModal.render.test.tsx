// DEC-681 (SPA half, w14-b): the rule-builder's Value control must be one
// the selected trigger can actually match -- checkbox trigger -> Yes/No
// select serializing 'true'/'false', number trigger -> a number input,
// dropdown trigger -> a select/checkbox-list drawn from the trigger's own
// options, everything else -> free text. Swapping the trigger (or the op)
// must swap the control and reset the value so a stale unmatchable value
// never survives the swap.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldModal, type FieldModalInput } from './FieldModal';
import { FIELD_KIND_LABELS, type FormField } from './types';

const TITLE: FormField = { id: 'f-title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true };
const FORMAT: FormField = {
  id: 'f-format',
  section: 'session',
  kind: 'dropdown',
  label: 'Format',
  required: false,
  position: 1,
  locked: false,
  options: ['Talk', 'Workshop', 'Panel'],
};
const ATTENDING: FormField = { id: 'f-attending', section: 'session', kind: 'checkbox', label: 'Attending in person', required: false, position: 2, locked: false };
const HEADCOUNT: FormField = { id: 'f-headcount', section: 'session', kind: 'number', label: 'Headcount', required: false, position: 3, locked: false };
const SLIDES: FormField = { id: 'f-slides', section: 'session', kind: 'file', label: 'Slides', required: false, position: 4, locked: false };

const ALL_FIELDS = [TITLE, FORMAT, ATTENDING, HEADCOUNT, SLIDES];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

/** Renders a brand-new field (appended at the end), so every existing
 * non-file field is a candidate trigger. */
function renderModal(onSubmit: (input: FieldModalInput) => Promise<void>) {
  return render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={onSubmit} />);
}

function selectTrigger(id: string) {
  fireEvent.change(screen.getByLabelText('Field', { selector: 'select' }), { target: { value: id } });
}

describe('FieldModal rule-value control (DEC-681)', () => {
  it('excludes file-kind fields from the trigger dropdown', () => {
    renderModal(async () => {});
    const fieldSelect = screen.getByLabelText('Field', { selector: 'select' });
    const optionValues = Array.from(fieldSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).not.toContain(SLIDES.id);
  });

  it('renders a text input for a text-kind trigger', () => {
    renderModal(async () => {});
    selectTrigger(TITLE.id);
    const value = screen.getByLabelText('Value', { selector: 'input' });
    expect(value).toHaveAttribute('type', 'text');
    expect(value).toHaveClass('chq-input');
  });

  it('swaps to a Yes/No select for a checkbox trigger and serializes true/false', async () => {
    let captured: FieldModalInput | undefined;
    renderModal(async (input) => {
      captured = input;
    });
    selectTrigger(ATTENDING.id);

    // No free-text value input for a checkbox trigger.
    expect(screen.queryByLabelText('Value', { selector: 'input' })).not.toBeInTheDocument();
    const valueSelect = screen.getByLabelText('Value', { selector: 'select' });
    expect(valueSelect).toHaveClass('chq-select');
    expect(valueSelect).toHaveValue('false'); // reset to the boolean default on trigger swap

    fireEvent.change(screen.getByLabelText('Label', { selector: 'input' }), { target: { value: 'Dietary needs' } });
    fireEvent.change(valueSelect, { target: { value: 'true' } });
    expect(valueSelect).toHaveValue('true');

    fireEvent.click(screen.getByRole('button', { name: 'Save the question' }));
    await vi.waitFor(() => expect(captured).toBeDefined());
    expect(captured?.rule).toEqual({ fieldId: ATTENDING.id, op: 'eq', value: 'true' });
  });

  it('swaps to a number input for a number trigger', () => {
    renderModal(async () => {});
    selectTrigger(HEADCOUNT.id);
    const value = screen.getByLabelText('Value', { selector: 'input' });
    expect(value).toHaveAttribute('type', 'number');
    expect(value).toHaveClass('chq-input');
  });

  it('swaps to an options select (eq/ne) drawn from the trigger own options', () => {
    renderModal(async () => {});
    selectTrigger(FORMAT.id);
    const value = screen.getByLabelText('Value', { selector: 'select' });
    expect(value).toHaveClass('chq-select');
    const optionValues = Array.from(value.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toEqual(expect.arrayContaining(['Talk', 'Workshop', 'Panel']));
  });

  it('swaps to an options checkbox list when op is `in`, and resets the value when the op changes', () => {
    renderModal(async () => {});
    selectTrigger(FORMAT.id);
    fireEvent.change(screen.getByLabelText('Value', { selector: 'select' }), { target: { value: 'Workshop' } });
    fireEvent.change(screen.getByLabelText('Is', { selector: 'select' }), { target: { value: 'in' } });

    // Options control is now a checkbox list, not a single select, and the
    // eq-picked value did not survive the op swap.
    expect(screen.queryByLabelText('Value', { selector: 'select' })).not.toBeInTheDocument();
    const workshopCheckbox = screen.getByLabelText('Workshop');
    expect(workshopCheckbox).toHaveClass('chq-check');
    expect(workshopCheckbox).not.toBeChecked();

    fireEvent.click(workshopCheckbox);
    expect(workshopCheckbox).toBeChecked();
    fireEvent.click(screen.getByLabelText('Panel'));
    expect(screen.getByLabelText('Panel')).toBeChecked();
  });

  it('resets the value control (and its value) when the trigger changes kind', () => {
    renderModal(async () => {});
    selectTrigger(FORMAT.id);
    fireEvent.change(screen.getByLabelText('Value', { selector: 'select' }), { target: { value: 'Workshop' } });
    selectTrigger(ATTENDING.id);
    const valueSelect = screen.getByLabelText('Value', { selector: 'select' });
    expect(valueSelect).toHaveValue('false');
  });
});

describe('FieldModal kind vocabulary (DEC-762)', () => {
  it("lists the design pack's \"Single choice\" option for the dropdown kind, never \"Dropdown\"", () => {
    renderModal(async () => {});
    const kindSelect = screen.getByLabelText('Kind', { selector: 'select' });
    const optionLabels = Array.from(kindSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toContain('Single choice');
    expect(optionLabels).not.toContain('Dropdown');
  });

  it('reads the dropdown-options-required error from the SAME kind-label map as the Kind select', async () => {
    renderModal(async () => {});
    fireEvent.change(screen.getByLabelText('Label', { selector: 'input' }), { target: { value: 'Track' } });
    fireEvent.change(screen.getByLabelText('Kind', { selector: 'select' }), { target: { value: 'dropdown' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the question' }));
    expect(await screen.findByText(`${FIELD_KIND_LABELS.dropdown} fields need at least one option.`)).toBeInTheDocument();
  });
});

// DEC-650 (wave-58 amendment): V11 frame 02--10 -- the conditional-
// visibility control reads as a sentence with the off case stated, a
// hidden question is never required (enforced on save, not just
// captioned), and the header states the blast radius when a count is
// known.
describe('FieldModal conditional-visibility sentence + required guard (DEC-650)', () => {
  it('states the off case when no trigger is set', () => {
    renderModal(async () => {});
    expect(screen.getByText('Only show this question when…')).toBeInTheDocument();
    expect(screen.getByText('Leave it off and the question always shows.')).toBeInTheDocument();
  });

  // DEC-650 (wave 8, frame 02--10 :700-702 amendment): the caption is a
  // fixed intro line under the sentence, not conditional on whether a
  // trigger is chosen -- it stays put once a trigger is set too.
  it('still states the off case once a trigger is set (fixed intro caption)', () => {
    renderModal(async () => {});
    selectTrigger(FORMAT.id);
    expect(screen.getByText('Leave it off and the question always shows.')).toBeInTheDocument();
  });

  it('disables Required and captions why once a rule is set', () => {
    renderModal(async () => {});
    const requiredBox = screen.getByRole('checkbox', { name: 'Required' });
    fireEvent.click(requiredBox);
    expect(requiredBox).toBeChecked();

    selectTrigger(FORMAT.id);
    expect(requiredBox).toBeDisabled();
    expect(requiredBox).not.toBeChecked();
    expect(
      screen.getByText('A hidden question is never required — if the submitter cannot see it, it cannot block their submission.'),
    ).toBeInTheDocument();
  });

  it('sends required:false on save when a rule is set, even though the box was ticked before the rule was added', async () => {
    let captured: FieldModalInput | undefined;
    renderModal(async (input) => {
      captured = input;
    });
    fireEvent.change(screen.getByLabelText('Label', { selector: 'input' }), { target: { value: 'Slides link' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Required' }));
    selectTrigger(FORMAT.id);
    fireEvent.change(screen.getByLabelText('Value', { selector: 'select' }), { target: { value: 'Workshop' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save the question' }));
    await vi.waitFor(() => expect(captured).toBeDefined());
    expect(captured?.required).toBe(false);
    expect(captured?.rule).toEqual({ fieldId: FORMAT.id, op: 'eq', value: 'Workshop' });
  });

  it('renders the blast-radius header line when answeredCount is a number', () => {
    render(
      <FieldModal
        field={FORMAT}
        allFields={ALL_FIELDS}
        answeredCount={47}
        onCancel={() => {}}
        onSubmit={async () => {}}
      />,
    );
    expect(
      screen.getByText('47 people have already answered this form — editing a live question changes what those answers mean'),
    ).toBeInTheDocument();
  });

  it('renders no blast-radius line when answeredCount is null', () => {
    render(
      <FieldModal field={FORMAT} allFields={ALL_FIELDS} answeredCount={null} onCancel={() => {}} onSubmit={async () => {}} />,
    );
    expect(screen.queryByText(/already answered this form/)).not.toBeInTheDocument();
  });

  it('renders no blast-radius line when answeredCount is omitted', () => {
    renderModal(async () => {});
    expect(screen.queryByText(/already answered this form/)).not.toBeInTheDocument();
  });
});
