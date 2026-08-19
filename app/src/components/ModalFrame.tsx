import type { FormEvent, MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../lib/useEscapeKey';
import { OPTIONAL_SUFFIX } from '../../../src/domain/form-copy';
import './modal-frame.css';

interface ModalFrameBaseProps {
  /** Rendered as .chq-modal-title in a bordered header. */
  title: string;
  /** Optional .chq-modal-sub line under the title. */
  subtitle?: ReactNode;
  /** aria-label for the dialog; defaults to `title`. */
  ariaLabel?: string;
  onClose: () => void;
  /** Disables the header Close control + Escape + scrim-click (e.g. while a request is in flight). */
  closeDisabled?: boolean;
  /** Extra class(es) appended to the .chq-modal element for page-specific sizing/layout. */
  modalClassName?: string;
  /** Widens the frame itself. Default 560px; 'wide' is 640px (adds
   * .is-wide to the .chq-modal element) for dialogs whose body needs the
   * extra room (e.g. a two-column grid). */
  size?: 'default' | 'wide';
  /** Body content, below the header. */
  children: ReactNode;
  /** Rendered inside .chq-modal-actions. Per DEC-651/the mock, the PRIMARY
   * action goes first and Cancel/secondary second -- callers supply
   * actions already in that order. Omit entirely for a body-only dialog. */
  actions?: ReactNode;
  /** Phone drill-in back link (`.chq-phone-back`), rendered as the FIRST
   * child of the header -- a ModalFrame affordance, never a page-local
   * re-implementation and never a second close control on desktop (w6-d).
   * Hidden above the 700px breakpoint by modal-frame.css. */
  backLink?: { label: string; onClick: () => void } | null;
}

type ModalFrameProps =
  | (ModalFrameBaseProps & { as?: 'div' })
  | (ModalFrameBaseProps & { as: 'form'; onSubmit: (e: FormEvent<HTMLFormElement>) => void });

interface FormRowProps {
  /** Section-label text rendered ABOVE the control (11px/700/0.12em
   * uppercase, per the shared .chq-section-label type). */
  label: string;
  /** id of the control inside `children`, for explicit label association.
   * Omit for controls that aren't a single labelable element (e.g. a
   * segmented button group) -- the visual contract is unchanged either
   * way. */
  htmlFor?: string;
  /** Optional caption rendered below the control. */
  help?: ReactNode;
  /** Validation message. Rendered with role="alert" and marked with a
   * leading glyph + weight (DEC-367: never colour alone). */
  error?: string | null;
  /** DEC-917: marks a row as skippable per its own submit/validate handler.
   * Renders the identical ' · optional' suffix src/views/form-render.tsx
   * uses (DEC-909) so the two renderers cannot drift. Required rows carry
   * no marker at all -- no asterisks anywhere in the product. */
  optional?: boolean;
  children: ReactNode;
}

// DEC-124/DEC-958: an errored row carries `data-invalid="true"` on the
// .chq-form-row wrapper, which error-states.css picks up via
// `.chq-form-row[data-invalid='true'] .chq-form-row-control > .chq-input`
// (and its .chq-select/.chq-textarea siblings) -- the same border treatment
// the standalone `.chq-field-invalid` class applies elsewhere (the public
// CFP builder), reached here without adding a second className.
// DEC-685: the ONE form-row skeleton every dialog field is built on --
// label above the control at the modal's full measure, so every field in
// every modal lines up on the same left edge instead of the drifting
// label-beside-input layout it replaces.
export function FormRow({ label, htmlFor, help, error, optional = false, children }: FormRowProps) {
  return (
    <div className="chq-form-row" data-invalid={error ? 'true' : undefined}>
      <label className="chq-form-row-label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="chq-form-row-optional">{OPTIONAL_SUFFIX}</span> : null}
      </label>
      <div className="chq-form-row-control">{children}</div>
      {help !== undefined && <div className="chq-form-row-help">{help}</div>}
      {error ? (
        <div id={htmlFor + '-error'} className="chq-form-row-error" role="alert">
          <span aria-hidden="true">&#9650; </span>
          {error}
        </div>
      ) : null}
    </div>
  );
}

// DEC-897: the ONE paired-row layout -- exactly two FormRow children share
// one row of the modal's form grid (equal columns), stacking below the
// modal's narrow breakpoint. Used for date/time ranges (e.g. Starts/Ends)
// so the pairing itself, not a caption, is what makes a close-before-open
// relationship legible.
export function FormRowPair({ children }: { children: ReactNode }) {
  return <div className="chq-form-row-pair">{children}</div>;
}

// DEC-651: the ONE dialog frame. Renders the existing .chq-scrim + .chq-modal
// contract (role="dialog" + aria-modal on the scrim, useEscapeKey, scrim-click
// close) -- callers must not re-invent that chrome -- plus a bordered header
// (.chq-modal-title, optional .chq-modal-sub, a Close control on the right)
// and a .chq-modal-actions slot. Every dialog in the app should be built on
// this frame so the header/action-order contract can't drift per-modal.
export function ModalFrame(props: ModalFrameProps) {
  const { title, subtitle, ariaLabel, onClose, closeDisabled = false, modalClassName, size = 'default', children, actions, backLink } = props;

  useEscapeKey(!closeDisabled, onClose);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !closeDisabled) onClose();
  }

  const head = (
    <div className="chq-modal-head">
      {backLink ? (
        <button type="button" className="chq-link-button chq-phone-back" onClick={backLink.onClick}>
          {backLink.label}
        </button>
      ) : null}
      <div className="chq-modal-head-titles">
        <h2 className="chq-modal-title">{title}</h2>
        {subtitle !== undefined && <span className="chq-modal-sub">{subtitle}</span>}
      </div>
      <button
        type="button"
        className="chq-btn chq-btn-tertiary chq-modal-close-btn"
        onClick={onClose}
        disabled={closeDisabled}
      >
        Close
      </button>
    </div>
  );

  const modalClass = [
    'chq-modal',
    size === 'wide' ? 'is-wide' : null,
    modalClassName ?? null,
  ]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      {head}
      {children}
      {actions !== undefined && <div className="chq-modal-actions">{actions}</div>}
    </>
  );

  // DEC-732: mounted through a root portal so no ancestor's stacking
  // context, position, or (per eval-findings 25) inherited text-transform
  // decides how the modal renders -- a caller nested arbitrarily deep (e.g.
  // EventSwitcher's "New event…" trigger, itself inside the ALL-CAPS
  // .chq-header-identity block) still gets the dialog's own typography.
  return createPortal(
    <div
      className="chq-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={handleScrimClick}
    >
      {props.as === 'form' ? (
        <form className={modalClass} onSubmit={props.onSubmit}>
          {body}
        </form>
      ) : (
        <div className={modalClass}>{body}</div>
      )}
    </div>,
    document.body,
  );
}
