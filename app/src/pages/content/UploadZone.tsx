import { useRef, useState } from 'react';
import { formatAcceptedTypesMessage, validateUploadFile } from './upload-validation';
import type { DeliverableKind } from './types';

interface UploadZoneProps {
  kind: DeliverableKind;
  replacesFileId?: string;
  onUpload: (file: File, kind: DeliverableKind, replacesFileId?: string) => Promise<void>;
}

/** File input + drag-drop upload zone. States DEC-020 accepted types/caps verbatim (CNT-12). */
export function UploadZone({ kind, replacesFileId, onUpload }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const check = validateUploadFile(file);
    if (!check.valid) {
      setMessage(check.message ?? 'File rejected.');
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

  // CNT-12: the accepted-types + size-cap text must be visible verbatim on
  // the upload zone, not hidden behind a tooltip or validation-only error.
  const uploadHintText = `Accepted: ${formatAcceptedTypesMessage()}`;

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
      <p className="chq-upload-caps chq-content-upload-caps">{uploadHintText}</p>
      <input
        ref={inputRef}
        type="file"
        className="chq-input"
        aria-label={replacesFileId ? `Replace ${kind}` : `Upload ${kind}`}
        disabled={pending}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {pending && <span>Uploading…</span>}
      {message && (
        <span className="chq-error" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
