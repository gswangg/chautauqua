import { useState, type FormEvent } from 'react';
import { DELIVERABLE_KINDS, TASK_KINDS, type DeliverableKind, type NewTaskInput, type TaskKind } from './types';

interface TaskModalProps {
  onCancel: () => void;
  onSubmit: (input: NewTaskInput) => Promise<void>;
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

export function TaskModal({ onCancel, onSubmit }: TaskModalProps) {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError('Title is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        description: description.trim().length > 0 ? description.trim() : undefined,
        dueDate: dueDate.length > 0 ? new Date(dueDate).getTime() : undefined,
        required,
        formId: kind === 'form' && formId.trim().length > 0 ? formId.trim() : undefined,
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
    <div className="chq-modal-overlay" role="dialog" aria-modal="true" aria-label="New task">
      <form className="chq-modal chq-speakers-modal" onSubmit={handleSubmit}>
        <div className="chq-speakers-modal-head">
          <div className="chq-speakers-modal-head-titles">
            <h2 className="chq-speakers-modal-title">New task</h2>
            <span className="chq-summary">Applies to every accepted speaker</span>
          </div>
          <button type="button" className="chq-btn-tertiary" onClick={onCancel} disabled={submitting}>
            Close
          </button>
        </div>

        {error && <div className="chq-error">{error}</div>}

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Kind</span>
          <select className="chq-select" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
            {TASK_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Task</span>
          <input className="chq-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Description</span>
          <textarea className="chq-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="chq-speakers-modal-field">
          <span className="chq-speakers-modal-label">Due date</span>
          <input className="chq-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        {kind === 'form' && (
          <label className="chq-speakers-modal-field">
            <span className="chq-speakers-modal-label">Form ID</span>
            <input className="chq-input" type="text" value={formId} onChange={(e) => setFormId(e.target.value)} />
          </label>
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

        <div className="chq-modal-actions">
          <button type="submit" className="chq-btn chq-btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create the task'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
