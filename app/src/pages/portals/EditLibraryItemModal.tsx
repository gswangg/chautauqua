// Settings · Portals › Libraries · Edit an item: a library task's name,
// what it is about, its instructions and (for a file request) its file
// limits. The change reaches every portal that lists the item; an item's
// type can't change.
import { useState, type FormEvent } from 'react';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { apiPatch, ApiError } from '../../lib/api';
import { MAX_LIBRARY_INSTRUCTIONS, MAX_LIBRARY_TITLE } from '../../lib/domain-caps';
import { countOf } from '../../lib/plural';
import { ITEM_SCOPE_LABELS } from '../../../../src/domain/portals/items';
import { FileLimitFields, LIBRARY_TYPE_LABELS } from './NewLibraryItemModal';
import type { FileTypeGroup, ItemScope, LibraryEntry, LibraryType } from './types';

interface EditLibraryItemModalProps {
  eventId: string;
  entry: LibraryEntry & { ref: { taskId: string } };
  onSaved: (title: string) => void;
  onClose: () => void;
}

export function EditLibraryItemModal({ eventId, entry, onSaved, onClose }: EditLibraryItemModalProps) {
  const type = entry.type as LibraryType;
  const [title, setTitle] = useState(entry.title);
  const [scope, setScope] = useState<ItemScope>(entry.scope);
  const [text, setText] = useState(entry.instructions ?? '');
  const [types, setTypes] = useState<FileTypeGroup[]>(entry.acceptedTypes ?? []);
  const [maxSize, setMaxSize] = useState<number | null>(entry.maxSizeMb);
  const [maxFiles, setMaxFiles] = useState<number>(entry.maxFiles ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim() === '') {
      setFieldErrors({ title: 'Give the item a name.' });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      // file limits only apply to a file request; the route ignores them otherwise
      const fileRequest = type === 'file_request';
      await apiPatch(`/events/${eventId}/library/tasks/${entry.ref.taskId}`, {
        title: title.trim(),
        scope,
        instructions: text.trim() === '' ? null : text,
        acceptedTypes: fileRequest && types.length > 0 ? types : null,
        maxSizeMb: fileRequest ? maxSize : null,
        maxFiles: fileRequest ? maxFiles : null,
      });
      onSaved(title.trim());
    } catch (err) {
      if (err instanceof ApiError && err.fields?.title) setFieldErrors({ title: err.message });
      else setError(err instanceof ApiError ? err.message : 'The item could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title={`Edit ${entry.title}`}
      subtitle={
        entry.usedBy.length > 0
          ? `${LIBRARY_TYPE_LABELS[type]} · changes reach ${countOf(entry.usedBy.length, 'portal')} that list it`
          : `${LIBRARY_TYPE_LABELS[type]} · not in any portal yet`
      }
      onClose={onClose}
      closeDisabled={saving}
      modalClassName="chq-portal-modal"
      actions={
        <>
          <button type="submit" className={saving ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'} disabled={saving}>
            {saving ? 'Saving…' : 'Save item'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </>
      }
    >
      <FormRow label="Name" htmlFor="library-edit-name" error={fieldErrors.title}>
        <input id="library-edit-name" className="chq-input" value={title} maxLength={MAX_LIBRARY_TITLE} onChange={(e) => setTitle(e.target.value)} />
      </FormRow>
      <FormRow
        label="About"
        help={scope !== entry.scope && entry.usedBy.length > 0 ? 'This moves the item between the profile area and the session sections in every portal that lists it.' : undefined}
      >
        <div className="chq-portal-seg chq-portal-seg-wide" role="group" aria-label="About">
          {(['person', 'participation'] as const).map((option) => (
            <button key={option} type="button" className="chq-portal-seg-btn" aria-pressed={scope === option} onClick={() => setScope(option)}>
              {ITEM_SCOPE_LABELS[option]}
            </button>
          ))}
        </div>
      </FormRow>
      <FormRow
        label={type === 'share_kit' ? 'Share text' : 'Instructions'}
        htmlFor="library-edit-text"
        optional
        help={type === 'share_kit' ? '{name}, {event}, {session} and {link} are filled in for each person who shares it.' : undefined}
      >
        <textarea id="library-edit-text" className="chq-textarea" value={text} maxLength={MAX_LIBRARY_INSTRUCTIONS} onChange={(e) => setText(e.target.value)} />
      </FormRow>
      {type === 'file_request' ? (
        <FileLimitFields types={types} onTypes={setTypes} maxSize={maxSize} onMaxSize={setMaxSize} maxFiles={maxFiles} onMaxFiles={setMaxFiles} errors={fieldErrors} />
      ) : null}
      {error ? (
        <p className="chq-error" role="alert">
          {error}
        </p>
      ) : null}
    </ModalFrame>
  );
}
