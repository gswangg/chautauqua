import { ModalFrame } from '../../components/ModalFrame';
import { DELIVERABLE_LABELS, type FileKind } from './types';
import './upload-rejected.css';

interface UploadRejectedModalProps {
  /** The session this deliverable belongs to (DEC-901: passed in from the
   * mounting DeliverableDetail, never fetched here). */
  sessionTitle: string;
  kind: FileKind;
  /** Name of the file that was refused. */
  filename: string;
  /** validateUpload's own refusal message (src/domain/files.ts) -- never a
   * second hand-written explanation. */
  refusalMessage: string;
  /** uploadHintText(kind) -- the why-these-formats sentence, derived from the
   * same pure-core rule the server enforces (DEC-653). */
  hintText: string;
  /** The survival sentence already computed by the caller (replace vs fresh
   * upload) -- rendered here, never recomputed. */
  survives: string;
  onClose: () => void;
  onChooseAnother: () => void;
}

/** docs/design/Chautauqua Content.dc.html :431-457 ("Upload rejected" modal):
 * a validateUpload refusal that discards the user's chosen file is a 560px
 * dialog, not an inline ribbon that can scroll out of view while the file is
 * already gone (DEC-653 findings-wave-5 amendment). Built on the shared
 * ModalFrame vocabulary -- no hand-rolled scrim. */
export function UploadRejectedModal({
  sessionTitle,
  kind,
  filename,
  refusalMessage,
  hintText,
  survives,
  onClose,
  onChooseAnother,
}: UploadRejectedModalProps) {
  return (
    <ModalFrame
      title="That file was not uploaded"
      subtitle={`${sessionTitle} · ${DELIVERABLE_LABELS[kind].toLowerCase()}`}
      onClose={onClose}
      modalClassName="chq-upload-rejected-modal"
      actions={
        <>
          <button type="button" className="chq-btn chq-btn-primary" onClick={onChooseAnother}>
            Choose another file
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="chq-upload-rejected-band" role="alert">
        <span className="chq-upload-rejected-band-headline">
          {filename} {refusalMessage}
        </span>
        <span className="chq-upload-rejected-band-why">{hintText}</span>
      </div>
      <div className="chq-upload-rejected-kept">
        <span className="chq-section-label chq-upload-rejected-kept-label">What was kept</span>
        <span className="chq-upload-rejected-kept-text">{survives}</span>
      </div>
    </ModalFrame>
  );
}
