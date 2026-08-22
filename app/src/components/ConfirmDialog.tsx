import { useState, type ReactNode } from 'react';
import { ModalFrame } from './ModalFrame';
import { confirmPhraseMatches } from '../lib/confirmPhrase';
import { DEC_613 } from '../../../src/decisions';
import './confirm-dialog.css';

// DEC-613 wave-32 amendment: the typed-confirmation label states the
// frame's generic instruction (`Type the ${confirmNoun} to confirm`); the
// object's own name lives in the input's placeholder, never composed into
// the label text.
void DEC_613;

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
  // DEC-613 wave-32 amendment: the frame's typed-confirmation label is a
  // GENERIC instruction ("Type the file name to confirm",
  // Chautauqua Settings.dc.html:1429) with the object's own name rendered
  // as muted content inside the value box below it, not composed into the
  // label text itself. `confirmNoun` names what the caller is typing (e.g.
  // "file name", "field name", "name") -- required whenever `weight` is
  // 'irreversible', same as `confirmPhrase`.
  confirmNoun?: string;
  onConfirm: () => void;
  onCancel: () => void;
  // DEC-781 (wave-9 amendment): no `subtitle` slot is added here. Frame
  // :1400 (Chautauqua Settings.dc.html) is the only caller-visible demand
  // for one -- a saved-embed delete confirm naming the embed's HOST -- and
  // that data does not exist: the schema carries no referrer/host column
  // and no endpoint tracks where an embed is pasted on the open web (see
  // SavedEmbedsPanel.tsx's own comment near its `{{ e.used }}` field, which
  // records the identical absence for that panel's read surface). Adding a
  // slot this component's only relevant caller could never fill would be
  // DEC-851/DEC-988's knob with no reader.
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
  confirmNoun,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  // FAIL LOUDLY: an irreversible weight with no phrase to type is not a
  // silent degrade to the reversible weight -- it is a caller bug.
  if (weight === 'irreversible' && !confirmPhrase?.trim()) {
    throw new Error("ConfirmDialog: weight='irreversible' requires a non-empty confirmPhrase");
  }
  if (weight === 'irreversible' && !confirmNoun?.trim()) {
    throw new Error("ConfirmDialog: weight='irreversible' requires a non-empty confirmNoun");
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
            {`Type the ${confirmNoun} to confirm`}
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
