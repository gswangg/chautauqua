// DEC-291: viewer for a kind='form' task_assignment's saved answers, opened
// from the OnboardingGrid's 'View response' cell control. DEC-599: no longer
// read-only -- 'Mark complete' and 'Ask for more' both write the existing
// PATCH /task-assignments/:id status (pending|complete, no 'waive'). The
// grid that opened this modal owns the write + optimistic reconcile/rollback
// (matching toggleCell), so this component only calls back up.

import type { MouseEvent } from 'react';
import { formatDate } from '../../lib/dates';
import { useEscapeKey } from '../../lib/useEscapeKey';
import type { AssignmentResponseDetail, AssignmentStatus } from './types';

interface ResponseModalProps {
  contactName: string;
  loading: boolean;
  error: string | null;
  detail: AssignmentResponseDetail | null;
  onStatusChange: (status: AssignmentStatus) => void;
  onClose: () => void;
}

export function ResponseModal({ contactName, loading, error, detail, onStatusChange, onClose }: ResponseModalProps) {
  useEscapeKey(true, onClose);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Task response" onClick={handleScrimClick}>
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

        {!loading && detail && (
          <dl className="chq-speakers-response-fields">
            {detail.fields.map((field) => (
              <div key={field.label} className="chq-speakers-response-field">
                <dt>{field.label}</dt>
                <dd>{field.value.length > 0 ? field.value : '—'}</dd>
              </div>
            ))}
          </dl>
        )}

        {!loading && detail && (
          <div className="chq-speakers-response-status">
            {detail.status === 'pending' && (
              <button
                type="button"
                className="chq-btn chq-btn-primary"
                onClick={() => onStatusChange('complete')}
              >
                Mark complete
              </button>
            )}
            {detail.status === 'complete' && (
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                onClick={() => onStatusChange('pending')}
              >
                Ask for more
              </button>
            )}
            <span className="chq-summary">Reopening does not email the speaker.</span>
          </div>
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
