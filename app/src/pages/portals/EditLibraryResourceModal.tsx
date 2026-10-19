// Settings · Portals › Libraries · Edit a resource (decision 74): its name,
// and a page's text. A file resource keeps its file; to send a different
// one, delete it and upload the new file. The change reaches every portal
// that lists it.
import { useState, type FormEvent } from 'react';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { apiPatch, ApiError } from '../../lib/api';
import { MAX_LIBRARY_PAGE, MAX_LIBRARY_TITLE } from '../../lib/domain-caps';
import { MARKDOWN_SYNTAX_HINT } from '../../lib/markdown-hint';
import { countOf } from '../../lib/plural';
import type { LibraryEntry } from './types';

interface EditLibraryResourceModalProps {
  entry: LibraryEntry & { ref: { resourceId: string } };
  onSaved: (title: string) => void;
  onClose: () => void;
}

export function EditLibraryResourceModal({ entry, onSaved, onClose }: EditLibraryResourceModalProps) {
  const isFile = entry.resource?.kind === 'file';
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.resource?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim() === '') {
      setFieldErrors({ title: 'Give the resource a name.' });
      return;
    }
    if (!isFile && content.trim() === '') {
      setFieldErrors({ content: 'Write what participants read.' });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiPatch(`/resources/${entry.ref.resourceId}`, isFile ? { title: title.trim() } : { title: title.trim(), content });
      onSaved(title.trim());
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) setFieldErrors(err.fields);
      else setError(err instanceof ApiError ? err.message : 'The resource could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title={`Edit ${entry.title}`}
      subtitle={entry.usedBy.length > 0 ? `Resource · changes reach ${countOf(entry.usedBy.length, 'portal')} that list it` : 'Resource · not in any portal yet'}
      onClose={onClose}
      closeDisabled={saving}
      modalClassName="chq-portal-modal"
      actions={
        <>
          <button type="submit" className={saving ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'} disabled={saving}>
            {saving ? 'Saving…' : 'Save resource'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </>
      }
    >
      <FormRow label="Name" htmlFor="library-resource-name" error={fieldErrors.title}>
        <input id="library-resource-name" className="chq-input" value={title} maxLength={MAX_LIBRARY_TITLE} onChange={(e) => setTitle(e.target.value)} />
      </FormRow>
      {isFile ? (
        <p className="chq-portal-modal-note">
          {`The file is ${entry.resource?.fileName ?? 'kept as it is'}. To send a different one, delete this resource and upload the new file.`}
        </p>
      ) : (
        <FormRow label="Page" htmlFor="library-resource-page" help={`What participants read. ${MARKDOWN_SYNTAX_HINT}`} error={fieldErrors.content}>
          <textarea id="library-resource-page" className="chq-textarea" value={content} maxLength={MAX_LIBRARY_PAGE} onChange={(e) => setContent(e.target.value)} />
        </FormRow>
      )}
      {error ? (
        <p className="chq-error" role="alert">
          {error}
        </p>
      ) : null}
    </ModalFrame>
  );
}
