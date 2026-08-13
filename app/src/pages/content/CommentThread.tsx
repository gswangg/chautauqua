import { useState } from 'react';
import { formatRelative } from '../../lib/dates';
import { useMe } from '../../lib/useMe';
import { countOf } from '../../lib/plural';
import type { FileComment } from './types';

interface SendResult {
  sent: number;
  failed: { email: string; message: string }[];
}

interface CommentThreadProps {
  comments: FileComment[];
  /** DEC-720/DEC-741: every note posted here is emailed to the submission's
   * active participants — there is no silent "just comment" path. */
  onSend: (body: string, requestChanges: boolean) => Promise<SendResult>;
}

/** Comment thread for one deliverable's latest file (DEC-573 chain thread).
 * The composer always sends through /content-note (DEC-720/DEC-741): "Ask
 * for changes" also moves content_status to changes_requested, "Send note
 * only" leaves status untouched — both always email the speakers, so the
 * caption below never promises a silent post. */
export function CommentThread({ comments, onSend }: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SendResult | null>(null);
  const { me } = useMe();
  const now = Date.now();

  async function submit(requestChanges: boolean) {
    const body = draft.trim();
    if (body.length === 0) return;
    setPending(true);
    setError(null);
    setSummary(null);
    try {
      const result = await onSend(body, requestChanges);
      setDraft('');
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send note.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="chq-comment-thread">
      <ul className="chq-comment-list chq-content-comment-list">
        {comments.map((c) => (
          <li key={c.id} className="chq-comment-item chq-content-comment-item">
            <div className="chq-content-comment-head">
              <span className="chq-comment-author chq-content-comment-author">
                {me && c.authorUserId === me.userId ? 'You' : c.authorName}
              </span>
              <span className="chq-comment-version chq-meta">v{c.versionNumber}</span>
              <span className="chq-comment-date chq-meta"> · {formatRelative(c.createdAt, now)}</span>
            </div>
            <span className="chq-comment-body chq-content-comment-body">{c.body}</span>
          </li>
        ))}
        {comments.length === 0 && <li className="chq-empty">No comments yet.</li>}
      </ul>
      <div className="chq-comment-composer chq-content-comment-composer">
        <textarea
          className="chq-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note to the speakers..."
          disabled={pending}
        />
        <p className="chq-meta chq-content-comment-caption">
          Ask for changes emails this note and moves the session out of your queue · Send note only emails it and
          leaves the status alone
        </p>
        <div className="chq-content-comment-actions">
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={pending || draft.trim().length === 0}
            onClick={() => void submit(true)}
          >
            Ask for changes
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={pending || draft.trim().length === 0}
            onClick={() => void submit(false)}
          >
            Send note only
          </button>
        </div>
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {summary && summary.failed.length > 0 && (
        <div className="chq-error" role="alert">
          Sent to {countOf(summary.sent, 'recipient')}; failed for{' '}
          {summary.failed.map((f) => f.email).join(', ')}.
        </div>
      )}
      {summary && summary.failed.length === 0 && (
        <p className="chq-meta chq-content-comment-sent">
          Sent to {countOf(summary.sent, 'recipient')}.
        </p>
      )}
    </div>
  );
}
