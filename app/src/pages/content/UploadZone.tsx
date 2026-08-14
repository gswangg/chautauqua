import { useId, useRef, useState } from 'react';
import { validateUpload, uploadHintText, allowedUploadExtensions } from '../../../../src/domain/files';
import type { FileKind } from './types';

interface UploadZoneProps {
  kind: FileKind;
  replacesFileId?: string;
  onUpload: (file: File, kind: FileKind, replacesFileId?: string) => Promise<void>;
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
export function UploadZone({ kind, replacesFileId, onUpload }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // V9 error standard (DEC-653, DEC-124): true only for a validation refusal
  // on the file input itself (never for an onUpload network/server failure,
  // which is a different failure surface, not a field-level refusal).
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setInvalid(false);
    const check = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
    if (!check.ok) {
      // Three clauses -- what was refused (the pure core's own message),
      // which formats are accepted and why (derived from
      // allowedUploadExtensions/uploadHintText, never a second hand-written
      // list), and what survived.
      const survives = replacesFileId
        ? 'The current file is unchanged. Nothing was replaced.'
        : 'Nothing was uploaded.';
      setMessage(`${check.message} ${uploadHintText(kind)} ${survives}`);
      setInvalid(true);
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
      {/* CNT-06: the accepted-types + size-cap text must be visible verbatim on
          the upload zone, not hidden behind a tooltip or validation-only
          error -- the prompt and the caps text share this one line, the
          label wraps the whole line so a click anywhere in it opens the
          (visually hidden) file input below. */}
      <label htmlFor={inputId} className="chq-content-upload-label">
        <span className="chq-content-upload-prompt">Drop a file to upload for the speaker</span>
        <span className="chq-upload-caps chq-content-upload-caps">{uploadHintText(kind)}</span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className={
          invalid
            ? 'chq-file chq-content-upload-input chq-field-invalid'
            : 'chq-file chq-content-upload-input'
        }
        accept={allowedUploadExtensions(kind).map((e) => `.${e}`).join(',')}
        aria-label={replacesFileId ? `Replace ${kind}` : `Upload ${kind}`}
        aria-invalid={invalid ? 'true' : undefined}
        disabled={pending}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {pending && <span>Uploading…</span>}
      {invalid && message ? (
        <span className="chq-field-error" role="alert">
          {message}
        </span>
      ) : (
        message && (
          <span className="chq-error" role="alert">
            {message}
          </span>
        )
      )}
    </div>
  );
}
