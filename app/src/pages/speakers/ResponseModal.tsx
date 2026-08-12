// DEC-291: viewer for a kind='form' task_assignment's saved answers, opened
// from the OnboardingGrid's 'View response' cell control. DEC-599: no longer
// read-only -- 'Mark complete' and 'Ask for more' both write the existing
// PATCH /task-assignments/:id status (pending|complete, no 'waive'). The
// grid that opened this modal owns the write + optimistic reconcile/rollback
// (matching toggleCell), so this component only calls back up.

import { formatDate } from '../../lib/dates';
import { ModalFrame } from '../../components/ModalFrame';
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
  return (
    <ModalFrame
      title={detail ? detail.taskTitle : 'Task response'}
      subtitle={
        <>
          {contactName}
          {detail && <> &middot; Completed {formatDate(detail.completedAt)}</>}
        </>
      }
      ariaLabel="Task response"
      onClose={onClose}
      modalClassName="chq-speakers-modal"
      actions={
        !loading && detail
          ? detail.status === 'pending'
            ? (
                <button type="button" className="chq-btn chq-btn-primary" onClick={() => onStatusChange('complete')}>
                  Mark complete
                </button>
              )
            : (
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => onStatusChange('pending')}>
                  Ask for more
                </button>
              )
          : undefined
      }
    >
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

      {!loading && detail && <span className="chq-summary">Reopening does not email the speaker.</span>}
    </ModalFrame>
  );
}
