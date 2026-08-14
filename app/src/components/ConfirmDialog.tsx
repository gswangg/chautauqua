import type { ReactNode } from 'react';
import { ModalFrame } from './ModalFrame';
import './confirm-dialog.css';

interface ConfirmDialogProps {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  // Disables only the confirm control (e.g. a still-loading or failed
  // preview) without also disabling Cancel/Close -- unlike `pending`, which
  // is a busy state that blocks the whole dialog.
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// DEC-631: the ONE dialog contract for confirmation prompts, replacing
// window.confirm/prompt/alert everywhere. Built on ModalFrame (DEC-651) so
// it shares the bordered header/Close control and PRIMARY-first action
// order with every other modal in the app.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalFrame
      title={title}
      onClose={onCancel}
      closeDisabled={pending}
      modalClassName="chq-confirm-modal"
      actions={
        <>
          <button
            type="button"
            className={destructive ? 'chq-btn chq-confirm-btn-danger' : 'chq-btn chq-btn-primary'}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {confirmLabel}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
        </>
      }
    >
      {body !== undefined && <div className="chq-confirm-body">{body}</div>}
    </ModalFrame>
  );
}
