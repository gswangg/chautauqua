import { useState } from 'react';
import { formatRelative } from '../../lib/dates';
import { useMe } from '../../lib/useMe';
import { countOf, capitalizeFirst } from '../../lib/plural';
import { EmptyState } from '../../components/EmptyState';
import { SendFailures } from '../../components/SendFailures';
import { MAX_COMMENT_BODY_LENGTH } from '../../lib/file-caps';
import type { FileComment } from './types';

/** Thousands-grouped integer, e.g. 4000 -> "4,000". A plain regex rather
 * than toLocaleString/Intl (banned outside lib/dates.ts, DEC-963) -- this
 * is a character-count grouping, not a locale-sensitive date/number (same
 * idiom as forms/FieldList.tsx's local formatThousands). */
function formatThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// DEC-020's own header ("author name + role"): the wire has always carried
// authorRole (FileComment, src/routes/api/files-comments.ts) but nothing
// rendered it -- a portal speaker note (no linked user) has authorRole
// null and must render with no label at all, never a fabricated "(unknown)".
const COMMENT_ROLE_LABELS: Record<string, string> = { organizer: 'Organizer', reviewer: 'Reviewer' };
function commentRoleLabel(role: string): string {
  return COMMENT_ROLE_LABELS[role] ?? capitalizeFirst(role);
}

interface SendResult {
  sent: number;
  failed: { email: string; message: string }[];
  recipients: number;
}

interface CommentThreadProps {
  comments: FileComment[];
  /** DEC-720/DEC-741: every note posted here goes through /content-note.
   * The send to the submission's active-invite participants is best-effort
   * — with zero such participants the note still posts and the status
   * still moves (DEC-317/DEC-720 wave-30 amendment). */
  onSend: (body: string, requestChanges: boolean) => Promise<SendResult>;
}

/** Comment thread for one deliverable's latest file (DEC-573 chain thread).
 * The composer always sends through /content-note (DEC-720/DEC-741): "Ask
 * for changes" also moves content_status to changes_requested, "Send note
 * only" leaves status untouched — both attempt a best-effort email to
 * whatever active-invite participants exist, so the caption below never
 * promises a silent post but also never guarantees a recipient. */
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
      {comments.length === 0 ? (
        <EmptyState variant="fresh" what="No comments yet." action={null} />
      ) : (
        <ul className="chq-comment-list chq-content-comment-list">
          {comments.map((c) => (
            <li key={c.id} className="chq-comment-item chq-content-comment-item">
              <div className="chq-content-comment-head">
                <span className="chq-comment-author chq-content-comment-author">
                  {me && c.authorUserId === me.userId ? 'You' : c.authorName}
                </span>
                {c.authorRole && (
                  <span className="chq-role-label chq-meta"> ({commentRoleLabel(c.authorRole)})</span>
                )}
                <span className="chq-comment-version chq-meta">v{c.versionNumber}</span>
                <span className="chq-comment-date chq-meta"> · {formatRelative(c.createdAt, now)}</span>
              </div>
              <span className="chq-comment-body chq-content-comment-body">{c.body}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="chq-comment-composer chq-content-comment-composer">
        <textarea
          className="chq-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note — sent with the decision, and kept on the thread"
          disabled={pending}
          maxLength={MAX_COMMENT_BODY_LENGTH}
        />
        <p className="chq-meta chq-content-comment-limit">
          Up to {formatThousands(MAX_COMMENT_BODY_LENGTH)} characters.
        </p>
        <div className="chq-content-comment-actions">
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={pending || draft.trim().length === 0}
            onClick={() => void submit(true)}
          >
            Ask for changes
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={pending || draft.trim().length === 0}
            onClick={() => void submit(false)}
          >
            Send note only
          </button>
        </div>
        <p className="chq-meta chq-content-comment-caption">
          Ask for changes emails this note and moves the session out of your queue · Send note only emails it and
          leaves the status alone
        </p>
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
      {summary && summary.failed.length > 0 && (
        <div className="chq-error" role="alert">
          <p>Sent to {countOf(summary.sent, 'recipient')}; failed for:</p>
          <SendFailures failed={summary.failed} />
        </div>
      )}
      {summary && summary.failed.length === 0 && summary.recipients === 0 && (
        <p className="chq-meta chq-content-comment-sent">Posted to the thread · nobody to email</p>
      )}
      {summary && summary.failed.length === 0 && summary.recipients > 0 && (
        <p className="chq-meta chq-content-comment-sent">
          Sent to {countOf(summary.sent, 'recipient')}.
        </p>
      )}
    </div>
  );
}
