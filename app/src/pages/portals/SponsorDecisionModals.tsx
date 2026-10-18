// The organizer's three decisions on a sponsor-designed session (Portals
// frame, flow 5): Request changes ("Ask Latticework for changes"), Decline
// (a reason is required: a sponsor never gets a bare decline, and the slot
// goes back to them), and the Approved receipt shown after Approve (added
// to the program as Accepted, new speakers invited, the sponsor told).
// useSponsorDecisions wires all three for the queue and the review page:
// Approve posts at once and opens the receipt; the other two open their
// dialog; request-changes and decline report who was told in a toast.
import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiPost, ApiError } from '../../lib/api';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { MAX_ORGANIZER_NOTE } from '../../lib/domain-caps';
import { countOf } from '../../lib/plural';
import { formatNoun } from '../../../../src/domain/sponsors';
import { mailFailurePhrase, nameList } from './sponsorCopy';
import type { MailResult, SponsorDecisionResult, SponsorSessionDetail } from './types';

function sessionTitle(session: SponsorSessionDetail): string {
  return session.title || 'Untitled session';
}

// ---------------------------------------------------------------------------
// Request changes
// ---------------------------------------------------------------------------

interface DecisionModalProps {
  session: SponsorSessionDetail;
  onClose: () => void;
  onDone: (result: SponsorDecisionResult) => void;
}

export function RequestChangesModal({ session, onClose, onDone }: DecisionModalProps) {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (note.trim() === '') {
      setNoteError('Say what needs to change. The sponsor contacts get this note.');
      return;
    }
    setNoteError(null);
    setSending(true);
    try {
      const result = await apiPost<SponsorDecisionResult>(
        `/events/${session.eventId}/sponsor-sessions/${session.id}/request-changes`,
        { note: note.trim() },
      );
      onDone(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send this request.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={send}
      title={`Ask ${session.companyName} for changes`}
      subtitle={sessionTitle(session)}
      onClose={onClose}
      closeDisabled={sending}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={sending}>
            {sending ? 'Sending…' : `Send to ${session.companyName}`}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
        </>
      }
    >
      {error ? (
        <div className="chq-error" role="alert">
          {error}
        </div>
      ) : null}
      <FormRow label="What needs to change · sent to the sponsor contacts" htmlFor="sponsor-changes-note" error={noteError}>
        <textarea
          id="sponsor-changes-note"
          className="chq-textarea"
          rows={4}
          value={note}
          maxLength={MAX_ORGANIZER_NOTE}
          onChange={(e) => setNote(e.target.value)}
          disabled={sending}
        />
      </FormRow>
    </ModalFrame>
  );
}

// ---------------------------------------------------------------------------
// Decline
// ---------------------------------------------------------------------------

export function DeclineModal({ session, onClose, onDone }: DecisionModalProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function decline(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (reason.trim() === '') {
      setReasonError(`Give ${session.companyName} a reason. A sponsor never gets a bare decline.`);
      return;
    }
    setReasonError(null);
    setSending(true);
    try {
      const result = await apiPost<SponsorDecisionResult>(`/events/${session.eventId}/sponsor-sessions/${session.id}/decline`, {
        reason: reason.trim(),
      });
      onDone(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not decline this session.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={decline}
      title="Decline this session?"
      subtitle={`${sessionTitle(session)} · ${session.companyName}`}
      onClose={onClose}
      closeDisabled={sending}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={sending}>
            {sending ? 'Declining…' : 'Decline'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
        </>
      }
    >
      {error ? (
        <div className="chq-error" role="alert">
          {error}
        </div>
      ) : null}
      <FormRow label={`Reason · sent to ${session.companyName}`} htmlFor="sponsor-decline-reason" error={reasonError}>
        <textarea
          id="sponsor-decline-reason"
          className="chq-textarea"
          rows={3}
          value={reason}
          maxLength={MAX_ORGANIZER_NOTE}
          onChange={(e) => setReason(e.target.value)}
          disabled={sending}
        />
      </FormRow>
      <div className="chq-decision-line">
        <span className="chq-decision-line-text">
          <span className="chq-decision-line-main">{`${formatNoun(session.format, true)} slot`}</span>
          <span className="chq-decision-line-sub">{`Returned to ${session.companyName} to use on another session`}</span>
        </span>
      </div>
    </ModalFrame>
  );
}

// ---------------------------------------------------------------------------
// Approved
// ---------------------------------------------------------------------------

function approvedMail(result: SponsorDecisionResult): { told?: MailResult; invited?: MailResult } {
  const mail = result.mail;
  return mail && 'told' in mail ? mail : {};
}

interface ApprovedModalProps {
  result: SponsorDecisionResult;
  onClose: () => void;
  // "Back to the queue": closes on the queue, navigates from the review page
  onBack: () => void;
}

export function ApprovedModal({ result, onClose, onBack }: ApprovedModalProps) {
  const approved = result.session;
  const invited = result.invited ?? [];
  const mail = approvedMail(result);
  return (
    <ModalFrame
      title="Approved"
      subtitle={sessionTitle(approved)}
      onClose={onClose}
      actions={
        <button type="button" className="chq-btn chq-btn-primary" onClick={onBack}>
          Back to the queue
        </button>
      }
    >
      <div className="chq-decision-lines">
        <div className="chq-decision-line">
          <span className="chq-decision-line-text">
            <span className="chq-decision-line-main">Added to the program</span>
            <span className="chq-decision-line-sub">{`Accepted · ${formatNoun(approved.format, true)} · needs a slot in Agenda`}</span>
          </span>
          <Link to="/agenda" className="chq-link-button chq-decision-line-action">
            Open in Agenda
          </Link>
        </div>
        {invited.map((name) => (
          <div className="chq-decision-line" key={name}>
            <span className="chq-decision-line-text">
              <span className="chq-decision-line-main">{`${name} invited`}</span>
              <span className="chq-decision-line-sub">Gets an email to join as a speaker</span>
            </span>
          </div>
        ))}
        {mail.invited && mail.invited.failed > 0 ? (
          <div className="chq-decision-line">
            <span className="chq-decision-line-text">
              <span className="chq-decision-line-main">Not every invitation went out</span>
              <span className="chq-decision-line-sub">{`${countOf(mail.invited.failed, 'invitation')} didn't send. Resend it from the speaker's page.`}</span>
            </span>
          </div>
        ) : null}
        <div className="chq-decision-line">
          <span className="chq-decision-line-text">
            <span className="chq-decision-line-main">{`${approved.companyName} told`}</span>
            <span className="chq-decision-line-sub">
              {result.told.length > 0 ? `${nameList(result.told)}${mailFailurePhrase(mail.told)}` : 'No contact has joined yet, so nobody was emailed'}
            </span>
          </span>
        </div>
      </div>
    </ModalFrame>
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

type Open =
  | { kind: 'changes'; session: SponsorSessionDetail }
  | { kind: 'decline'; session: SponsorSessionDetail }
  | { kind: 'approved'; result: SponsorDecisionResult }
  | null;

function toldToast(prefix: string, result: SponsorDecisionResult): string {
  const mail = result.mail && 'sent' in result.mail ? result.mail : undefined;
  if (result.told.length === 0) return `${prefix} No contact at ${result.session.companyName} has joined yet, so nobody was emailed.`;
  return `${prefix} Told ${nameList(result.told)}${mailFailurePhrase(mail)}.`;
}

export interface SponsorDecisions {
  approve: (session: SponsorSessionDetail) => Promise<void>;
  requestChanges: (session: SponsorSessionDetail) => void;
  decline: (session: SponsorSessionDetail) => void;
  // the session an Approve is in flight for
  approvingId: string | null;
  error: string | null;
  toast: string | null;
  dismissToast: () => void;
  modals: ReactNode;
}

export function useSponsorDecisions(onBackToQueue: () => void): SponsorDecisions {
  const [open, setOpen] = useState<Open>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const approve = useCallback(async (session: SponsorSessionDetail) => {
    setError(null);
    setToast(null);
    setApprovingId(session.id);
    try {
      const result = await apiPost<SponsorDecisionResult>(`/events/${session.eventId}/sponsor-sessions/${session.id}/approve`);
      setOpen({ kind: 'approved', result });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve this session.');
    } finally {
      setApprovingId(null);
    }
  }, []);

  const close = useCallback(() => setOpen(null), []);

  let modals: ReactNode = null;
  if (open?.kind === 'changes') {
    modals = (
      <RequestChangesModal
        session={open.session}
        onClose={close}
        onDone={(result) => {
          setOpen(null);
          setToast(toldToast('Changes requested.', result));
        }}
      />
    );
  } else if (open?.kind === 'decline') {
    modals = (
      <DeclineModal
        session={open.session}
        onClose={close}
        onDone={(result) => {
          setOpen(null);
          setToast(toldToast('Declined.', result));
        }}
      />
    );
  } else if (open?.kind === 'approved') {
    modals = (
      <ApprovedModal
        result={open.result}
        onClose={close}
        onBack={() => {
          setOpen(null);
          onBackToQueue();
        }}
      />
    );
  }

  return {
    approve,
    requestChanges: (session) => {
      setError(null);
      setToast(null);
      setOpen({ kind: 'changes', session });
    },
    decline: (session) => {
      setError(null);
      setToast(null);
      setOpen({ kind: 'decline', session });
    },
    approvingId,
    error,
    toast,
    dismissToast: () => setToast(null),
    modals,
  };
}
