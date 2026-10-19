// New library item (Portals frame, flow 2, e2-x8): a task, form, file
// request, resource page or share kit saved to the event's library. From
// the portal editor it is then added to that portal ("Create and add");
// from Settings · Portals › Libraries it is only saved. The fields follow
// the type: a file request carries its accepted types, size and count; a
// share kit's text takes {name} {event} {session} {link}; a resource is a
// page participants read or a file they download (decision 74: the library
// is where resources are made). A new form opens the form builder after
// this step.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FormRow, FormRowPair, ModalFrame } from '../../components/ModalFrame';
import { apiPost, apiUpload, ApiError } from '../../lib/api';
import {
  MAX_FILE_REQUEST_FILES,
  MAX_FILE_REQUEST_SIZE_MB,
  MAX_LIBRARY_INSTRUCTIONS,
  MAX_LIBRARY_PAGE,
  MAX_LIBRARY_TITLE,
} from '../../lib/domain-caps';
import { MARKDOWN_SYNTAX_HINT } from '../../lib/markdown-hint';
import { countOf } from '../../lib/plural';
import { FILE_TYPE_GROUPS, FILE_TYPE_GROUP_LABELS, limitSentence } from '../../../../src/domain/portals/file-types';
import { ITEM_SCOPE_LABELS } from '../../../../src/domain/portals/items';
import { allowedUploadExtensions, uploadHintText, validateUpload } from '../../../../src/domain/files';
import type { FileTypeGroup, ItemScope, LibraryItemCreate, LibraryType } from './types';

export const LIBRARY_TYPE_LABELS: Record<LibraryType, string> = {
  task: 'Task',
  form: 'Form',
  file_request: 'File request',
  resource: 'Resource',
  share_kit: 'Share kit',
};

const TYPE_ORDER: LibraryType[] = ['task', 'form', 'file_request', 'resource', 'share_kit'];

const SIZE_STEPS = [10, 25, 50, 100, 200];

export interface CreatedLibraryItem {
  type: LibraryType;
  title: string;
  scope: ItemScope;
  taskId: string | null;
  resourceId: string | null;
  formId: string | null;
}

interface NewLibraryItemModalProps {
  eventId: string;
  // 'portal': "Create and add" with Back to the library list; 'library':
  // "Create" with Cancel
  mode: 'portal' | 'library';
  portalName?: string;
  onCreated: (item: CreatedLibraryItem) => void;
  onClose: () => void;
}

// the instructions box changes its job with the type
function textRow(type: LibraryType): { label: string; help: string; max: number } {
  if (type === 'resource') return { label: 'Page', help: `What participants read. ${MARKDOWN_SYNTAX_HINT}`, max: MAX_LIBRARY_PAGE };
  if (type === 'share_kit') {
    return {
      label: 'Share text',
      help: '{name}, {event}, {session} and {link} are filled in for each person who shares it.',
      max: MAX_LIBRARY_INSTRUCTIONS,
    };
  }
  return { label: 'Instructions', help: 'Shown with the item on the participant’s home.', max: MAX_LIBRARY_INSTRUCTIONS };
}

/** A file request's limits: accepted types (Any file clears the rest),
 * largest size and how many files. Enforced on upload. */
/** The form builder opened on one library form ("Form saved", the library's
 * Questions link); the CFP form when the id is missing. */
export function formBuilderPath(formId: string | null): string {
  return formId ? `/submissions/forms?form=${encodeURIComponent(formId)}` : '/submissions/forms';
}

export function FileLimitFields({
  types,
  onTypes,
  maxSize,
  onMaxSize,
  maxFiles,
  onMaxFiles,
  errors,
}: {
  types: FileTypeGroup[];
  onTypes: (next: FileTypeGroup[]) => void;
  maxSize: number | null;
  onMaxSize: (next: number | null) => void;
  maxFiles: number;
  onMaxFiles: (next: number) => void;
  errors: Record<string, string>;
}) {
  const sizes = SIZE_STEPS.filter((n) => n <= MAX_FILE_REQUEST_SIZE_MB);
  if (maxSize !== null && !sizes.includes(maxSize)) sizes.push(maxSize);
  const counts = Array.from({ length: MAX_FILE_REQUEST_FILES }, (_, i) => i + 1);

  function toggle(group: FileTypeGroup) {
    if (group === 'any') {
      onTypes(types.includes('any') ? [] : ['any']);
      return;
    }
    const rest = types.filter((t) => t !== 'any');
    onTypes(rest.includes(group) ? rest.filter((t) => t !== group) : [...rest, group]);
  }

  return (
    <>
      <FormRow
        label="File types"
        error={errors.acceptedTypes}
        help={`Enforced on upload: ${limitSentence(types.length > 0 ? types : null, maxSize)}${maxFiles > 1 ? `, ${countOf(maxFiles, 'file')}` : ''}.`}
      >
        <div className="chq-chipstrip chq-portal-chips" role="group" aria-label="File types">
          {FILE_TYPE_GROUPS.map((g) => (
            <button key={g} type="button" className={types.includes(g) ? 'chq-pill is-active' : 'chq-pill'} aria-pressed={types.includes(g)} onClick={() => toggle(g)}>
              {FILE_TYPE_GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </FormRow>
      <FormRowPair>
        <FormRow label="Max size" htmlFor="library-item-size" error={errors.maxSizeMb}>
          <select id="library-item-size" className="chq-select" value={maxSize ?? ''} onChange={(e) => onMaxSize(e.target.value === '' ? null : Number(e.target.value))}>
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n} MB
              </option>
            ))}
            <option value="">No limit</option>
          </select>
        </FormRow>
        <FormRow label="Files" htmlFor="library-item-files" error={errors.maxFiles}>
          <select id="library-item-files" className="chq-select" value={maxFiles} onChange={(e) => onMaxFiles(Number(e.target.value))}>
            {counts.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'One file' : `Up to ${countOf(n, 'file')}`}
              </option>
            ))}
          </select>
        </FormRow>
      </FormRowPair>
    </>
  );
}

export function NewLibraryItemModal({ eventId, mode, portalName, onCreated, onClose }: NewLibraryItemModalProps) {
  const [type, setType] = useState<LibraryType>('task');
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<ItemScope>('person');
  const [text, setText] = useState('');
  const [types, setTypes] = useState<FileTypeGroup[]>(['pdf']);
  const [maxSize, setMaxSize] = useState<number | null>(50);
  const [maxFiles, setMaxFiles] = useState<number>(1);
  // a resource is written here, or is a file uploaded here
  const [resourceKind, setResourceKind] = useState<'wiki' | 'file'>('wiki');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // a form is saved, then built in the form builder
  const [formMade, setFormMade] = useState<{ title: string; formId: string | null } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim() === '') {
      setFieldErrors({ title: 'Give the item a name.' });
      return;
    }
    const uploading = type === 'resource' && resourceKind === 'file';
    if (uploading && file === null) {
      setFieldErrors({ file: 'Choose the file participants download.' });
      return;
    }
    if (uploading && file !== null) {
      // DEC-020: the client check is the server's, so a refused file says so
      // before any bytes go up
      const check = validateUpload({ filename: file.name, sizeBytes: file.size, kind: 'handout' });
      if (!check.ok) {
        setFieldErrors({ file: `${check.message} ${uploadHintText('handout')}` });
        return;
      }
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    if (uploading && file !== null) {
      // the resource upload route; shown only through the portals that list
      // it, like a page made here
      const form = new FormData();
      form.set('title', title.trim());
      form.set('file', file);
      form.set('visibility', 'portal');
      try {
        const created = await apiUpload<{ id: string }>(`/events/${eventId}/resources`, form);
        onCreated({ type, title: title.trim(), scope: 'person', taskId: null, resourceId: created.id, formId: null });
        onClose();
      } catch (err) {
        if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) setFieldErrors(err.fields);
        setError(err instanceof ApiError ? err.message : 'The file could not be uploaded.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const body: LibraryItemCreate = {
      type,
      title: title.trim(),
      scope: type === 'resource' ? 'person' : scope,
      instructions: type === 'resource' || text.trim() === '' ? null : text,
      acceptedTypes: type === 'file_request' && types.length > 0 ? types : null,
      maxSizeMb: type === 'file_request' ? maxSize : null,
      maxFiles: type === 'file_request' ? maxFiles : null,
      content: type === 'resource' ? text : null,
    };
    try {
      const created = await apiPost<{ taskId: string | null; resourceId: string | null; formId: string | null }>(`/events/${eventId}/library`, body);
      onCreated({ type, title: body.title, scope: body.scope, ...created });
      if (type === 'form') setFormMade({ title: body.title, formId: created.formId });
      else onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields.title ? { ...err.fields, title: err.message } : err.fields);
        setError(err.fields.title ? null : err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'The item could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (formMade !== null) {
    return (
      <ModalFrame
        title="Form saved"
        subtitle={mode === 'portal' ? `${formMade.title} is in the library and added to ${portalName ?? 'this portal'}` : `${formMade.title} is in the library`}
        onClose={onClose}
        modalClassName="chq-portal-modal"
        actions={
          <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <p className="chq-portal-modal-note">
          Its questions are built in the form builder.{' '}
          <Link to={formBuilderPath(formMade.formId)} target="_blank" rel="noreferrer" className="chq-portal-inline-link">
            Open the form builder
          </Link>
          {mode === 'portal' ? ' (it opens in a new tab, so this portal keeps your edits).' : '.'}
        </p>
      </ModalFrame>
    );
  }

  const row = textRow(type);

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title="New item"
      subtitle={mode === 'portal' ? 'Saved to the library, then added to this portal' : 'Saved to the library; add it to portals from their editors'}
      onClose={onClose}
      closeDisabled={saving}
      modalClassName="chq-portal-modal chq-portal-new-item"
      actions={
        <>
          <button type="submit" className={saving ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'} disabled={saving}>
            {saving ? 'Saving…' : mode === 'portal' ? 'Create and add' : 'Create'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={saving}>
            {mode === 'portal' ? 'Back' : 'Cancel'}
          </button>
        </>
      }
    >
      <FormRow label="Type">
        <div className="chq-portal-seg chq-portal-seg-wide" role="group" aria-label="Type">
          {TYPE_ORDER.map((t) => (
            <button key={t} type="button" className="chq-portal-seg-btn" aria-pressed={type === t} onClick={() => setType(t)}>
              {LIBRARY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </FormRow>
      <FormRow label="Name" htmlFor="library-item-name" error={fieldErrors.title}>
        <input id="library-item-name" className="chq-input" value={title} maxLength={MAX_LIBRARY_TITLE} onChange={(e) => setTitle(e.target.value)} />
      </FormRow>
      {type !== 'resource' ? (
        <FormRow label="About" help={scope === 'person' ? 'Shown once, in the person’s profile area.' : 'Shown under each session or sponsor company it applies to.'}>
          <div className="chq-portal-seg chq-portal-seg-wide" role="group" aria-label="About">
            {(['person', 'participation'] as const).map((option) => (
              <button key={option} type="button" className="chq-portal-seg-btn" aria-pressed={scope === option} onClick={() => setScope(option)}>
                {ITEM_SCOPE_LABELS[option]}
              </button>
            ))}
          </div>
        </FormRow>
      ) : null}
      {type === 'resource' ? (
        <FormRow label="Content">
          <div className="chq-portal-seg chq-portal-seg-wide" role="group" aria-label="Content">
            <button type="button" className="chq-portal-seg-btn" aria-pressed={resourceKind === 'wiki'} onClick={() => setResourceKind('wiki')}>
              Write a page
            </button>
            <button type="button" className="chq-portal-seg-btn" aria-pressed={resourceKind === 'file'} onClick={() => setResourceKind('file')}>
              Upload a file
            </button>
          </div>
        </FormRow>
      ) : null}
      {type === 'resource' && resourceKind === 'file' ? (
        <FormRow
          label="File"
          htmlFor="library-item-file"
          help={<span className="chq-upload-caps">{`What participants download, such as a slide template or venue map. ${uploadHintText('handout')}`}</span>}
          error={fieldErrors.file}
        >
          {/* DEC-020: the same accepted types and size cap the server's
              validateUpload({kind: 'handout'}) enforces, from the one
              vocabulary in src/domain/files */}
          <input
            id="library-item-file"
            className="chq-file"
            type="file"
            accept={allowedUploadExtensions('handout').map((e) => `.${e}`).join(',')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </FormRow>
      ) : (
        <FormRow label={row.label} htmlFor="library-item-text" help={row.help} error={fieldErrors.instructions ?? fieldErrors.content} optional={type !== 'resource'}>
          <textarea id="library-item-text" className="chq-textarea" value={text} maxLength={row.max} onChange={(e) => setText(e.target.value)} />
        </FormRow>
      )}
      {type === 'file_request' ? (
        <FileLimitFields
          types={types}
          onTypes={setTypes}
          maxSize={maxSize}
          onMaxSize={setMaxSize}
          maxFiles={maxFiles}
          onMaxFiles={setMaxFiles}
          errors={fieldErrors}
        />
      ) : null}
      {type === 'form' ? <p className="chq-portal-modal-note">After saving, build the form’s questions in the form builder.</p> : null}
      {error ? (
        <p className="chq-error" role="alert">
          {error}
        </p>
      ) : null}
    </ModalFrame>
  );
}
