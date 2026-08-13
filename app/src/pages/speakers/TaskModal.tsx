import { useEffect, useState, type FormEvent } from 'react';
import {
  DELIVERABLE_KINDS,
  TASK_KINDS,
  type DeliverableKind,
  type EventForm,
  type NewTaskInput,
  type TaskKind,
} from './types';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { dateInputToMs } from '../../lib/dates';

interface TaskModalProps {
  onCancel: () => void;
  onSubmit: (input: NewTaskInput) => Promise<void>;
  // DEC-398: the event's own forms, {id, title, isDefault} — the producer
  // picks a form by NAME from this list; the client never types or invents
  // an id. An empty list (no forms yet, or the fetch failed) disables the
  // select and blocks submit rather than silently posting no formId.
  forms: EventForm[];
  // DEC-746: createTask always expands to every accepted speaker now -- the
  // subtitle states the count instead of offering an opt-out checkbox.
  acceptedCount: number;
}

// DEC-746: the segmented control's labels/order per
// docs/design/Chautauqua Speakers.dc.html:186-216 -- Upload, Form,
// Acknowledge, mapping onto the existing kind values so every other kind
// gate (deliverable-kind row, form picker) keeps working unchanged.
export function kindLabel(kind: TaskKind): string {
  if (kind === 'file_request') return 'Upload';
  if (kind === 'form') return 'Form';
  return 'Acknowledge';
}

const KIND_ORDER: readonly TaskKind[] = (() => {
  const order: TaskKind[] = ['file_request', 'form', 'general'];
  // TASK_KINDS is the source enumeration; assert the display order is a
  // permutation of it so a new kind can't silently go unlisted here.
  if (order.length !== TASK_KINDS.length || !TASK_KINDS.every((k) => order.includes(k))) {
    throw new Error('TaskModal: KIND_ORDER is out of sync with TASK_KINDS');
  }
  return order;
})();

function deliverableKindLabel(kind: DeliverableKind): string {
  if (kind === 'presentation') return 'Presentation';
  if (kind === 'poster') return 'Poster';
  return 'Handout';
}

export function TaskModal({ onCancel, onSubmit, forms, acceptedCount }: TaskModalProps) {
  const [kind, setKind] = useState<TaskKind>('file_request');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [required, setRequired] = useState(true);
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
        dueDate: dateInputToMs(dueDate) ?? undefined,
        required,
        formId: kind === 'form' ? formId : undefined,
        deliverableKind: kind === 'file_request' ? deliverableKind : undefined,
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
      subtitle={`Created for all ${acceptedCount} accepted speakers`}
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

        <FormRow label="Task" htmlFor="task-title">
          <input
            id="task-title"
            className="chq-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Submit your slides"
            required
          />
        </FormRow>

        <FormRow label="Due date" htmlFor="task-due-date">
          <input
            id="task-due-date"
            className="chq-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            placeholder="2026-05-01"
          />
        </FormRow>

        <div className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label" id="task-kind-label">
            Kind
          </span>
          <div className="chq-segmented" role="group" aria-label="Kind">
            {KIND_ORDER.map((k) => (
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

        {kind === 'form' && (
          <FormRow
            label="Form"
            htmlFor="task-form"
            help={
              forms.length === 0
                ? 'This event has no forms yet. Add a form before creating a form task.'
                : undefined
            }
          >
            <select
              id="task-form"
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
          </FormRow>
        )}

        {kind === 'file_request' && (
          <FormRow label="Deliverable kind" htmlFor="task-deliverable-kind">
            <select
              id="task-deliverable-kind"
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
          </FormRow>
        )}

        <label className="chq-check-label">
          <input className="chq-check" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
    </ModalFrame>
  );
}
