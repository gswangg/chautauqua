import { useEffect, useState, type FormEvent } from 'react';
import {
  DELIVERABLE_KINDS,
  TASK_KINDS,
  type DeliverableKind,
  type EventForm,
  type NewTaskInput,
  type OnboardingTask,
  type TaskKind,
} from './types';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { dateInputToMs, msToDateInput } from '../../lib/dates';

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
  // DEC-933: when provided, the modal opens in EDIT mode for this existing
  // task instead of creating a new one. Kind/Form/Deliverable-kind are the
  // task's shape and are fixed in edit mode -- changing kind would orphan
  // stored responses, and this modal has no wire-safe way to learn a task's
  // current deliverableKind (the onboarding grid response never carries it,
  // and widening that wire shape is out of this change's scope), so that
  // picker stays hidden too rather than risk clobbering it with a fresh
  // default. Only title/due date/required are editable; the caller is
  // responsible for stripping kind/formId/deliverableKind out of the
  // NewTaskInput this modal hands back before it PATCHes.
  task?: OnboardingTask | null;
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

// DEC-928: exhaustive Record so a new FILE_KINDS entry fails to compile
// here rather than silently rendering unlabeled.
const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  presentation: 'Presentation',
  poster: 'Poster',
  handout: 'Handout',
  recording: 'Recording',
};

function deliverableKindLabel(kind: DeliverableKind): string {
  return DELIVERABLE_KIND_LABELS[kind];
}

export function TaskModal({ onCancel, onSubmit, forms, acceptedCount, task = null }: TaskModalProps) {
  const isEdit = task !== null;
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'file_request');
  const [title, setTitle] = useState(task?.title ?? '');
  const [dueDate, setDueDate] = useState(task ? msToDateInput(task.dueDate) : '');
  const [required, setRequired] = useState(task?.required ?? true);
  const [formId, setFormId] = useState('');
  const [deliverableKind, setDeliverableKind] = useState<DeliverableKind>(DELIVERABLE_KINDS[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults to the first form in the (default-first, per DEC-398) list, and
  // re-syncs if the previously-selected id falls out of the list (e.g. the
  // async fetch resolves after the modal has already mounted with none) --
  // a blank submit is impossible by construction.
  useEffect(() => {
    if (isEdit) return; // edit mode never renders the Form picker.
    if (forms.length === 0) {
      setFormId('');
      return;
    }
    setFormId((current) => (forms.some((f) => f.id === current) ? current : forms[0]!.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError('Title is required.');
      return;
    }
    if (!isEdit && kind === 'form' && (forms.length === 0 || formId.trim().length === 0)) {
      setError('Select a form before creating a form task.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        dueDate: dateInputToMs(dueDate),
        required,
        formId: !isEdit && kind === 'form' ? formId : undefined,
        deliverableKind: !isEdit && kind === 'file_request' ? deliverableKind : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? 'Failed to save task' : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title={isEdit ? 'Edit task' : 'New task'}
      subtitle={isEdit ? undefined : `Created for all ${acceptedCount} accepted speakers`}
      onClose={onCancel}
      closeDisabled={submitting}
      modalClassName="chq-speakers-modal"
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={submitting}>
            {isEdit ? (submitting ? 'Saving...' : 'Save changes') : submitting ? 'Creating...' : 'Create the task'}
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

        <FormRow label="Due date" htmlFor="task-due-date" optional>
          <input
            id="task-due-date"
            className="chq-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            placeholder="2026-05-01"
          />
        </FormRow>

        {/* DEC-933: kind is a task's shape and is fixed once created --
            edit mode shows it as a quiet read-only line rather than the
            interactive segmented control (changing kind would orphan
            responses already stored against it). */}
        {isEdit ? (
          <div className="chq-speakers-modal-field">
            <span className="chq-speakers-modal-label">Kind</span>
            <span className="chq-meta">{kindLabel(kind)} (not editable)</span>
          </div>
        ) : (
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
        )}

        {!isEdit && kind === 'form' && (
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

        {!isEdit && kind === 'file_request' && (
          <FormRow label="Deliverable kind" htmlFor="task-deliverable-kind" optional>
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
