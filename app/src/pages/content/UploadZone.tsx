import { useRef, useState } from 'react';
import { validateUpload, uploadHintText, ALLOWED_UPLOAD_EXTENSIONS } from '../../../../src/domain/files';
import type { FileKind } from './types';

interface UploadZoneProps {
  kind: FileKind;
  replacesFileId?: string;
  onUpload: (file: File, kind: FileKind, replacesFileId?: string) => Promise<void>;
}

const ACCEPT_ATTR = ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(',');

/** File input + drag-drop upload zone. States DEC-020 accepted types/caps verbatim (CNT-12),
 * validated by the same pure-core rule (src/domain/files.ts) the server enforces. */
export function UploadZone({ kind, replacesFileId, onUpload }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const check = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
    if (!check.ok) {
      setMessage(check.message);
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
      {/* CNT-12: the accepted-types + size-cap text must be visible verbatim on
          the upload zone, not hidden behind a tooltip or validation-only error. */}
      <p className="chq-upload-caps chq-content-upload-caps">{uploadHintText()}</p>
      <input
        ref={inputRef}
        type="file"
        className="chq-file"
        accept={ACCEPT_ATTR}
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
