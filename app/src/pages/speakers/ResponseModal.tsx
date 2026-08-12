// DEC-291: dumb read-only viewer for a kind='form' task_assignment's saved
// answers, opened from the OnboardingGrid's 'View response' cell control.

import { formatDate } from '../../lib/dates';
import type { AssignmentResponseDetail } from './types';

interface ResponseModalProps {
  contactName: string;
  loading: boolean;
  error: string | null;
  detail: AssignmentResponseDetail | null;
  onClose: () => void;
}

export function ResponseModal({ contactName, loading, error, detail, onClose }: ResponseModalProps) {
  return (
    <div className="chq-modal-overlay" role="dialog" aria-modal="true" aria-label="Task response">
      <div className="chq-modal chq-speakers-modal">
        <div className="chq-speakers-modal-head">
          <div className="chq-speakers-modal-head-titles">
            <h2 className="chq-speakers-modal-title">{detail ? detail.taskTitle : 'Task response'}</h2>
            <span className="chq-summary">
              {contactName}
              {detail && <> &middot; Completed {formatDate(detail.completedAt)}</>}
            </span>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <div className="chq-error">{error}</div>}

        {!loading && !error && detail && (
          <dl className="chq-speakers-response-fields">
            {detail.fields.map((field) => (
              <div key={field.label} className="chq-speakers-response-field">
                <dt>{field.label}</dt>
                <dd>{field.value.length > 0 ? field.value : '—'}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
