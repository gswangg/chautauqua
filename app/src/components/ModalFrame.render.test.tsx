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
        <FormRow label="Name" htmlFor="name-field" required>
          <input id="name-field" className="chq-input" defaultValue="" />
        </FormRow>
      </ModalFrame>,
    );

    expect(screen.getByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
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
