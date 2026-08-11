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
    <div className="chq-modal-overlay" role="dialog" aria-label="Task response">
      <div className="chq-modal chq-response-modal">
        <h2>{detail ? detail.taskTitle : 'Task response'}</h2>
        <p className="chq-contact-meta">
          {contactName}
          {detail && <> &middot; Completed {formatDate(detail.completedAt)}</>}
        </p>

        {loading && <p>Loading...</p>}
        {error && <div className="chq-error-banner">{error}</div>}

        {!loading && !error && detail && (
          <dl className="chq-response-fields">
            {detail.fields.map((field) => (
              <div key={field.label} className="chq-response-field">
                <dt>{field.label}</dt>
                <dd>{field.value.length > 0 ? field.value : '—'}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="chq-modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
