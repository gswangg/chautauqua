import { useState, type FormEvent } from 'react';
import { TASK_KINDS, type NewTaskInput, type TaskKind } from './types';

interface TaskModalProps {
  onCancel: () => void;
  onSubmit: (input: NewTaskInput) => Promise<void>;
}

function kindLabel(kind: TaskKind): string {
  if (kind === 'general') return 'General';
  if (kind === 'file_request') return 'File request';
  return 'Form';
}

export function TaskModal({ onCancel, onSubmit }: TaskModalProps) {
  const [kind, setKind] = useState<TaskKind>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [required, setRequired] = useState(true);
  const [assignToAllAccepted, setAssignToAllAccepted] = useState(true);
  const [formId, setFormId] = useState('');
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
        assignToAllAccepted,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chq-modal-overlay" role="dialog" aria-label="New task">
      <form className="chq-modal" onSubmit={handleSubmit}>
        <h2>New task</h2>

        {error && <div className="chq-error-banner">{error}</div>}

        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
            {TASK_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        {kind === 'form' && (
          <label>
            Form ID
            <input type="text" value={formId} onChange={(e) => setFormId(e.target.value)} />
          </label>
        )}

        <label className="chq-checkbox-label">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>

        <label className="chq-checkbox-label">
          <input
            type="checkbox"
            checked={assignToAllAccepted}
            onChange={(e) => setAssignToAllAccepted(e.target.checked)}
          />
          Assign to all accepted speakers
        </label>

        <div className="chq-modal-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  );
}
