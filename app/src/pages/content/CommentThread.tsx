import { useState } from 'react';
import { formatDateTime } from './format';
import type { FileComment } from './types';

interface CommentThreadProps {
  comments: FileComment[];
  onPost: (body: string) => Promise<void>;
}

/** Comment thread for one deliverable's latest file; producer posts, speaker replies render with role labels. */
export function CommentThread({ comments, onPost }: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const body = draft.trim();
    if (body.length === 0) return;
    setPending(true);
    setError(null);
    try {
      await onPost(body);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.');
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
              <span className="chq-comment-author chq-content-comment-author">{c.authorName}</span>
              <span className="chq-role-label chq-meta">({c.authorRole})</span>
              <span className="chq-comment-date chq-meta">{formatDateTime(c.createdAt)}</span>
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
          placeholder="Add a comment..."
          disabled={pending}
        />
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={pending || draft.trim().length === 0}
          onClick={() => void submit()}
        >
          Post
        </button>
      </div>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
