// DEC-291: viewer for a kind='form' task_assignment's saved answers, opened
// from the OnboardingGrid's 'View response' cell control. DEC-599/DEC-694
// (design v4): exactly one action, 'Reopen this task', writing the existing
// PATCH /task-assignments/:id status back to pending. The grid that opened
// this modal owns the write + optimistic reconcile/rollback (matching
// toggleCell), so this component only calls back up.

import { formatDate } from '../../lib/dates';
import { ModalFrame } from '../../components/ModalFrame';
import { DelayedLoading } from '../../components/DelayedLoading';
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
        !loading && detail && detail.status !== 'pending' ? (
          <>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => onStatusChange('pending')}>
              Reopen this task
            </button>
            <span className="chq-summary">Sets it back to pending — the next reminder picks it up</span>
          </>
        ) : undefined
      }
    >
      {loading && <DelayedLoading />}
      {error && <div className="chq-error">{error}</div>}

      {!loading && detail && (
        <dl className="chq-speakers-response-fields">
          {detail.fields.map((field) => (
            <div key={field.label} className="chq-speakers-response-field">
              <dt>{field.label}</dt>
              <dd>
                {field.file ? (
                  <a
                    href={`/files/${field.file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="chq-speakers-file-link"
                    aria-label={`Download ${field.file.filename}`}
                    title={field.file.filename}
                  >
                    {field.file.filename}
                  </a>
                ) : field.value.length > 0 ? (
                  field.value
                ) : (
                  '—'
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </ModalFrame>
  );
}
