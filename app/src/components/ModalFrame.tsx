import type { FormEvent, MouseEvent, ReactNode } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
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
  /** Body content, below the header. */
  children: ReactNode;
  /** Rendered inside .chq-modal-actions. Per DEC-651/the mock, the PRIMARY
   * action goes first and Cancel/secondary second -- callers supply
   * actions already in that order. Omit entirely for a body-only dialog. */
  actions?: ReactNode;
}

type ModalFrameProps =
  | (ModalFrameBaseProps & { as?: 'div' })
  | (ModalFrameBaseProps & { as: 'form'; onSubmit: (e: FormEvent<HTMLFormElement>) => void });

// DEC-651: the ONE dialog frame. Renders the existing .chq-scrim + .chq-modal
// contract (role="dialog" + aria-modal on the scrim, useEscapeKey, scrim-click
// close) -- callers must not re-invent that chrome -- plus a bordered header
// (.chq-modal-title, optional .chq-modal-sub, a Close control on the right)
// and a .chq-modal-actions slot. Every dialog in the app should be built on
// this frame so the header/action-order contract can't drift per-modal.
export function ModalFrame(props: ModalFrameProps) {
  const { title, subtitle, ariaLabel, onClose, closeDisabled = false, modalClassName, children, actions } = props;

  useEscapeKey(!closeDisabled, onClose);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !closeDisabled) onClose();
  }

  const head = (
    <div className="chq-modal-head">
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

  const modalClass = modalClassName ? `chq-modal ${modalClassName}` : 'chq-modal';
  const body = (
    <>
      {head}
      {children}
      {actions !== undefined && <div className="chq-modal-actions">{actions}</div>}
    </>
  );

  return (
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
    </div>
  );
}
