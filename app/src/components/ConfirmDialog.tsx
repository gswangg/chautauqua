import { useState, type ReactNode } from 'react';
import { ModalFrame } from './ModalFrame';
import { confirmPhraseMatches } from '../lib/confirmPhrase';
import './confirm-dialog.css';

interface ConfirmDialogProps {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  // Disables only the confirm control (e.g. a still-loading or failed
  // preview) without also disabling Cancel/Close -- unlike `pending`, which
  // is a busy state that blocks the whole dialog.
  confirmDisabled?: boolean;
  // DEC-941 (wave-58 amendment): the confirm's WEIGHT is decided by
  // reversibility, not by how alarming the action sounds. 'reversible' (the
  // default) is one sentence + Cancel + primary, no typing. 'irreversible'
  // additionally requires typing `confirmPhrase` to unlock the primary --
  // reserved for deletes that cannot be undone: a portal resource, an
  // event, a contact merge (DESIGN-RULINGS.md:342-349). DEC-941 (wave-134
  // amendment): the irreversible population is a WEIGHT -- satisfiable by
  // this dialog's own typed-phrase gate OR by a page arming the same act
  // in its own footer, when a stacked dialog would only restate prose the
  // page already printed (DEC-886). This component's own callers today are
  // ResourcesPanel.tsx (portal resource delete) and FormsPage.tsx (form
  // field delete, x2) and MergePage.tsx (contact merge); bulk session
  // delete arms via DeleteSubmissionsPage.tsx's own footer field instead,
  // reusing this component's match semantics (confirmPhraseMatches) without
  // rendering it. The ruling's third named site, EVENT DELETE, has NO
  // control in the SPA: no `apiDelete` against `/events/:id` exists
  // anywhere under app/src. That absence is recorded here, not designed for.
  weight?: 'reversible' | 'irreversible';
  confirmPhrase?: string;
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
  pending = false,
  confirmDisabled = false,
  weight = 'reversible',
  confirmPhrase,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  // FAIL LOUDLY: an irreversible weight with no phrase to type is not a
  // silent degrade to the reversible weight -- it is a caller bug.
  if (weight === 'irreversible' && !confirmPhrase?.trim()) {
    throw new Error("ConfirmDialog: weight='irreversible' requires a non-empty confirmPhrase");
  }

  const phraseMatches =
    weight !== 'irreversible' || confirmPhraseMatches(typed, confirmPhrase as string);

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
            className="chq-btn chq-btn-primary"
            onClick={onConfirm}
            disabled={pending || confirmDisabled || !phraseMatches}
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
      {weight === 'irreversible' && (
        <div className="chq-confirm-typed-row">
          <label className="chq-confirm-typed-label" htmlFor="chq-confirm-typed-input">
            {`Type "${confirmPhrase}" to confirm`}
          </label>
          <input
            id="chq-confirm-typed-input"
            className="chq-input"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            disabled={pending}
            autoComplete="off"
          />
        </div>
      )}
    </ModalFrame>
  );
}
