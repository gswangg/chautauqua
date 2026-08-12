import { useEffect, useState, type FormEvent } from 'react';
import {
  DELIVERABLE_KINDS,
  TASK_KINDS,
  type DeliverableKind,
  type EventForm,
  type NewTaskInput,
  type TaskKind,
} from './types';
import { ModalFrame } from '../../components/ModalFrame';
import { dateInputToMs } from '../../lib/dates';

interface TaskModalProps {
  onCancel: () => void;
  onSubmit: (input: NewTaskInput) => Promise<void>;
  // DEC-398: the event's own forms, {id, title, isDefault} — the producer
  // picks a form by NAME from this list; the client never types or invents
  // an id. An empty list (no forms yet, or the fetch failed) disables the
  // select and blocks submit rather than silently posting no formId.
  forms: EventForm[];
}

function kindLabel(kind: TaskKind): string {
  if (kind === 'general') return 'General';
  if (kind === 'file_request') return 'File request';
  return 'Form';
}

function deliverableKindLabel(kind: DeliverableKind): string {
  if (kind === 'presentation') return 'Presentation';
  if (kind === 'poster') return 'Poster';
  return 'Handout';
}

export function TaskModal({ onCancel, onSubmit, forms }: TaskModalProps) {
  const [kind, setKind] = useState<TaskKind>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [required, setRequired] = useState(true);
  const [assignToAllAccepted, setAssignToAllAccepted] = useState(true);
  const [formId, setFormId] = useState('');
  const [deliverableKind, setDeliverableKind] = useState<DeliverableKind>('handout');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults to the first form in the (default-first, per DEC-398) list, and
  // re-syncs if the previously-selected id falls out of the list (e.g. the
  // async fetch resolves after the modal has already mounted with none) --
  // a blank submit is impossible by construction.
  useEffect(() => {
    if (forms.length === 0) {
      setFormId('');
      return;
    }
    setFormId((current) => (forms.some((f) => f.id === current) ? current : forms[0]!.id));
  }, [forms]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError('Title is required.');
      return;
    }
    if (kind === 'form' && (forms.length === 0 || formId.trim().length === 0)) {
      setError('Select a form before creating a form task.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        description: description.trim().length > 0 ? description.trim() : undefined,
        dueDate: dateInputToMs(dueDate) ?? undefined,
        required,
        formId: kind === 'form' ? formId : undefined,
        deliverableKind: kind === 'file_request' ? deliverableKind : undefined,
        assignToAllAccepted,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title="New task"
      subtitle="Applies to every accepted speaker"
      onClose={onCancel}
      closeDisabled={submitting}
      modalClassName="chq-speakers-modal"
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create the task'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}

        <div className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label" id="task-kind-label">
            Kind
          </span>
          <div className="chq-segmented" role="group" aria-label="Kind">
            {TASK_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {kindLabel(k)}
              </button>
            ))}
          </div>
        </div>

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Task</span>
          <input
            className="chq-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Submit your slides"
            required
          />
        </label>

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Description</span>
          <textarea
            className="chq-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional instructions shown to the speaker"
          />
        </label>

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Due date</span>
          <input
            className="chq-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            placeholder="2026-05-01"
          />
        </label>

        {kind === 'form' && (
          <div className="chq-speakers-modal-field">
            <label>
              <span className="chq-speakers-modal-label">Form</span>
              <select
                className="chq-select"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                disabled={forms.length === 0}
              >
                {forms.length === 0 ? (
                  <option value="">No forms available</option>
                ) : (
                  forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))
                )}
              </select>
            </label>
            {forms.length === 0 && (
              <span className="chq-summary">This event has no forms yet. Add a form before creating a form task.</span>
            )}
          </div>
        )}

        {kind === 'file_request' && (
          <label className="chq-speakers-modal-field">
            <span className="chq-speakers-modal-label">Deliverable kind</span>
            <select
              className="chq-select"
              value={deliverableKind}
              onChange={(e) => setDeliverableKind(e.target.value as DeliverableKind)}
            >
              {DELIVERABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {deliverableKindLabel(k)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="chq-check-label">
          <input className="chq-check" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>

        <label className="chq-check-label">
          <input
            className="chq-check"
            type="checkbox"
            checked={assignToAllAccepted}
            onChange={(e) => setAssignToAllAccepted(e.target.checked)}
          />
          Assign to all accepted speakers
        </label>
    </ModalFrame>
  );
}
