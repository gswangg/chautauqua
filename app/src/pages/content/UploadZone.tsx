import { useId, useRef, useState } from 'react';
import { validateUpload, uploadHintText, allowedUploadExtensions } from '../../../../src/domain/files';
import type { FileKind } from './types';
import { UploadRejectedModal } from './UploadRejectedModal';
import { usePendingLabel } from '../../components/PendingAction';

interface UploadZoneProps {
  kind: FileKind;
  /** The session this deliverable belongs to, for the rejected-upload
   * modal's subtitle (DEC-901: passed in, never fetched here). */
  sessionTitle: string;
  replacesFileId?: string;
  onUpload: (file: File, kind: FileKind, replacesFileId?: string) => Promise<void>;
}

/** A validateUpload field-level refusal, held for the "Upload rejected"
 * modal (DEC-653 findings-wave-5 amendment) -- distinct from `message`
 * below, which stays the onUpload network/server-failure surface. */
interface Refusal {
  filename: string;
  refusalMessage: string;
  hintText: string;
  survives: string;
}

/** File input + drag-drop upload zone: a single-line dashed strip (w41-a --
 * replaces the old 180px wrapped-sentence box), the accepted-type/size-cap
 * text (CNT-06) still stated verbatim (never hidden behind a tooltip) but
 * now right-flushed against the "Drop a file..." prompt on the same line,
 * uppercased for that chrome-strip register. The native file input is kept
 * reachable rather than removed -- visually hidden (not display:none, so it
 * stays in the tab order) and pointed at by a <label for>, so it is still
 * keyboard-focusable and still the thing screen readers land on -- the
 * dashed box's own click/drag affordance is layered on top of that same
 * input via the label, not a second parallel control. Validated by the
 * same pure-core rule (src/domain/files.ts) the server enforces. */
export function UploadZone({ kind, sessionTitle, replacesFileId, onUpload }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  // onUpload network/server-failure surface only (DEC-653, DEC-124) -- a
  // validateUpload field-level refusal is handled entirely by `refusal`
  // below, never this state, since the wave-5 amendment moved it into a
  // modal rather than the inline .chq-error/.chq-field-error treatment.
  const [message, setMessage] = useState<string | null>(null);
  // DEC-653 (findings wave 5 amendment): a validateUpload refusal opens the
  // framed "Upload rejected" modal instead of setting an inline field error.
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  // DEC-733 (V11 pending grammar): file-upload is one of the four slow
  // operations. There is no incremental byte count, so this stays the
  // single unmoving line ("Uploading…") -- no done/total. The label
  // replaces the dashed strip's own prompt text (the strip IS the
  // button here, opened via the visually-hidden file input's <label>).
  const uploadPendingLabel = usePendingLabel({
    pending,
    restLabel: 'Drop a file to upload for the speaker',
    participle: 'Uploading',
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const check = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
    if (!check.ok) {
      // What survived -- replace vs a fresh upload -- computed here once and
      // handed to the modal, never recomputed there.
      const survives = replacesFileId
        ? 'The current file is unchanged. Nothing was replaced.'
        : 'Nothing was uploaded.';
      setRefusal({
        filename: file.name,
        refusalMessage: check.message,
        hintText: uploadHintText(kind),
        survives,
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setPending(true);
    try {
      await onUpload(file, kind, replacesFileId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div
      className={dragOver ? 'chq-upload-zone chq-content-upload-zone drag-over' : 'chq-upload-zone chq-content-upload-zone'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
    >
      {/* G13 lane-D fix (05-content--01): the DEC-020 two-line re-review
          notice is unframed here — the frame's drop zone carries only the
          prompt plus the formats caption. The portal keeps its own
          ReuploadReviewNotice; uploadReopened still reports after the act. */}
      {/* CNT-06: the accepted-types + size-cap text must be visible verbatim on
          the upload zone, not hidden behind a tooltip or validation-only
          error -- the prompt and the caps text share this one line, the
          label wraps the whole line so a click anywhere in it opens the
          (visually hidden) file input below. */}
      <label
        htmlFor={inputId}
        className={`chq-content-upload-label ${uploadPendingLabel.buttonProps.className}`.trim()}
      >
        <span className="chq-content-upload-prompt">{uploadPendingLabel.label}</span>
        <span className="chq-upload-caps chq-content-upload-caps">{uploadHintText(kind)}</span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="chq-file chq-content-upload-input"
        accept={allowedUploadExtensions(kind).map((e) => `.${e}`).join(',')}
        aria-label={replacesFileId ? `Replace ${kind}` : `Upload ${kind}`}
        disabled={uploadPendingLabel.buttonProps.disabled}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {message && (
        <span className="chq-error" role="alert">
          {message}
        </span>
      )}
      {refusal && (
        <UploadRejectedModal
          sessionTitle={sessionTitle}
          kind={kind}
          filename={refusal.filename}
          refusalMessage={refusal.refusalMessage}
          hintText={refusal.hintText}
          survives={refusal.survives}
          onClose={() => setRefusal(null)}
          onChooseAnother={() => {
            setRefusal(null);
            inputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
