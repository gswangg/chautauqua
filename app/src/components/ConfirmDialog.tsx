import type { MouseEvent, ReactNode } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
import './confirm-dialog.css';

interface ConfirmDialogProps {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// DEC-631: the ONE dialog contract for confirmation prompts, replacing
// window.confirm/prompt/alert everywhere. Matches the shape every other
// modal already uses (chq-scrim + chq-modal, useEscapeKey, scrim-click
// cancel) so it composes with the rest of the app rather than inventing a
// second contract.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEscapeKey(!pending, onCancel);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !pending) onCancel();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label={title} onClick={handleScrimClick}>
      <div className="chq-modal chq-confirm-modal">
        <h2 className="chq-modal-title">{title}</h2>
        {body !== undefined && <div className="chq-confirm-body">{body}</div>}
        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'chq-btn chq-confirm-btn-danger' : 'chq-btn chq-btn-primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
