// DEC-685: FormRow is the ONE form-row skeleton every dialog field is
// built on -- label above the control, optional help caption, and an
// error slot marked by more than colour alone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FormRow, ModalFrame } from './ModalFrame';

afterEach(() => {
  cleanup();
});

describe('ModalFrame: FormRow', () => {
  it('puts the label before its control, associated via htmlFor/id', () => {
    render(
      <FormRow label="Subject" htmlFor="subject-field">
        <input id="subject-field" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    const label = screen.getByText('Subject');
    const input = screen.getByLabelText('Subject');
    expect(label.tagName).toBe('LABEL');
    expect(input).toBeInTheDocument();

    // Label precedes the control in document order.
    const position = label.compareDocumentPosition(input);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders an optional help caption below the control', () => {
    render(
      <FormRow label="Body" htmlFor="body-field" help="Sent one at a time">
        <textarea id="body-field" className="chq-textarea" defaultValue="" />
      </FormRow>,
    );

    expect(screen.getByText('Sent one at a time')).toBeInTheDocument();
  });

  it('renders an error slot with role="alert", distinguished by more than colour', () => {
    render(
      <FormRow label="Title" htmlFor="title-field" error="Title is required">
        <input id="title-field" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Title is required');
    // Distinguished by a leading glyph, not colour alone.
    expect(alert.textContent).not.toBe('Title is required');
    expect(alert.id).toBe('title-field-error');
  });

  it('marks the .chq-form-row wrapper data-invalid="true" whenever error is truthy', () => {
    const { container, rerender } = render(
      <FormRow label="Title" htmlFor="title-field-3" error="Title is required">
        <input id="title-field-3" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    const row = container.querySelector('.chq-form-row');
    expect(row).toHaveAttribute('data-invalid', 'true');

    rerender(
      <FormRow label="Title" htmlFor="title-field-3">
        <input id="title-field-3" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    expect(container.querySelector('.chq-form-row')).not.toHaveAttribute('data-invalid');
  });

  it('omits the help/error slots entirely when not provided', () => {
    render(
      <FormRow label="Title" htmlFor="title-field-2">
        <input id="title-field-2" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('composes inside ModalFrame with the header/close contract intact', () => {
    render(
      <ModalFrame title="Test modal" onClose={vi.fn()}>
        <FormRow label="Name" htmlFor="name-field">
          <input id="name-field" className="chq-input" defaultValue="" />
        </FormRow>
      </ModalFrame>,
    );

    expect(screen.getByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('DEC-917: a required row carries no marker at all', () => {
    render(
      <FormRow label="Name" htmlFor="required-name-field">
        <input id="required-name-field" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    const label = screen.getByText('Name', { exact: false });
    expect(label.textContent).toBe('Name');
    expect(label.textContent).not.toContain('optional');
    expect(label.textContent).not.toContain('*');
  });

  it('DEC-917: an optional row\'s label ends in the shared " · optional" suffix', () => {
    render(
      <FormRow label="Venue" htmlFor="optional-venue-field" optional>
        <input id="optional-venue-field" className="chq-input" defaultValue="" />
      </FormRow>,
    );

    const label = screen.getByText('Venue', { exact: false });
    expect(label.textContent).toBe('Venue · optional');
  });
});

describe('ModalFrame: back link (DEC-651, wave 7 amendment)', () => {
  it('renders no .chq-phone-back when the back prop is omitted', () => {
    render(
      <ModalFrame title="No back" onClose={vi.fn()}>
        <p>Body</p>
      </ModalFrame>,
    );

    // Portaled to document.body -- the render-root container never holds it.
    expect(document.body.querySelector('.chq-phone-back')).toBeNull();
  });

  it('renders the back link as the FIRST child of .chq-modal-head when the prop is present', () => {
    const onBack = vi.fn();
    render(
      <ModalFrame title="Contact detail" onClose={vi.fn()} backLink={{ label: '‹ Contacts', onClick: onBack }}>
        <p>Body</p>
      </ModalFrame>,
    );

    const head = document.body.querySelector('.chq-modal-head');
    expect(head).not.toBeNull();
    const back = head!.firstElementChild;
    expect(back).not.toBeNull();
    expect(back).toHaveClass('chq-phone-back');
    expect(back!.textContent).toBe('‹ Contacts');
  });

  it('renders the back link as a real <button>, not a bare anchor', () => {
    render(
      <ModalFrame title="Contact detail" onClose={vi.fn()} backLink={{ label: '‹ Contacts', onClick: vi.fn() }}>
        <p>Body</p>
      </ModalFrame>,
    );

    const back = screen.getByRole('button', { name: '‹ Contacts' });
    expect(back.tagName).toBe('BUTTON');
    expect(back).toHaveAttribute('type', 'button');
    expect(back).toHaveClass('chq-link-button');
  });

  it('calls the back handler on click, independent of onClose', () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <ModalFrame title="Contact detail" onClose={onClose} backLink={{ label: '‹ Contacts', onClick: onBack }}>
        <p>Body</p>
      </ModalFrame>,
    );

    screen.getByRole('button', { name: '‹ Contacts' }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ModalFrame: root portal (DEC-732)', () => {
  it('renders the dialog as a child of document.body, not of the caller-supplied React tree', () => {
    // An ancestor that sets text-transform: uppercase -- the exact shape of
    // the bug (eval-findings 25): EventSwitcher's "New event…" trigger sits
    // inside .chq-header-identity, which does this for real. Without a
    // portal the dialog would render as this div's DOM descendant and
    // silently inherit the transform.
    const { container } = render(
      <div style={{ textTransform: 'uppercase' }} data-testid="uppercase-ancestor">
        <ModalFrame title="Portaled" onClose={vi.fn()}>
          <p>Body</p>
        </ModalFrame>
      </div>,
    );

    const ancestor = screen.getByTestId('uppercase-ancestor');
    const dialog = screen.getByRole('dialog', { name: 'Portaled' });

    expect(ancestor).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
    // The render-root container itself only holds the ancestor div — the
    // dialog escaped it entirely via the portal.
    expect(container.querySelector('.chq-scrim')).toBeNull();
  });
});
