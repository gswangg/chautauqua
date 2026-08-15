// w15-e (DEC-872, GATE-1): a portal speaker note has authorRole null (no
// linked user) and must render without the '(unknown)' role leak; a
// comment authored by the signed-in organizer reads 'You' (identity by
// useMe().userId, never a display-string comparison).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommentThread } from './CommentThread';
import { MAX_COMMENT_BODY_LENGTH } from '../../lib/file-caps';
import type { FileComment } from './types';

vi.mock('../../lib/useMe', () => ({
  useMe: () => ({ me: { userId: 'user-organizer', email: 'org@example.com', name: 'Pat Organizer', role: 'organizer', orgId: 'org-1' }, loading: false }),
}));

afterEach(() => {
  cleanup();
});

async function noopSend() {
  return { sent: 0, failed: [], recipients: 0 };
}

describe('CommentThread', () => {
  it('renders no role label for a portal speaker note (authorRole null)', () => {
    const comments: FileComment[] = [
      {
        id: 'c1',
        fileId: 'file-1',
        versionNumber: 1,
        authorName: 'Sam Speaker',
        authorRole: null,
        authorUserId: null,
        body: 'Here is v2.',
        createdAt: Date.now() - 86_400_000 * 2,
      },
    ];
    render(<CommentThread comments={comments} onSend={noopSend} />);
    expect(screen.getByText('Sam Speaker')).toBeInTheDocument();
    expect(screen.queryByText('(unknown)')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-role-label')).toBeNull();
  });

  it("renders 'You · relative-time' for the signed-in organizer's own note", () => {
    const comments: FileComment[] = [
      {
        id: 'c2',
        fileId: 'file-1',
        versionNumber: 2,
        authorName: 'Pat Organizer',
        authorRole: 'organizer',
        authorUserId: 'user-organizer',
        body: 'Looks great',
        createdAt: Date.now() - 86_400_000 * 2,
      },
    ];
    render(<CommentThread comments={comments} onSend={noopSend} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.queryByText('Pat Organizer')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-comment-date')).toHaveTextContent('2 days ago');
  });

  // w5-i (DEC-708 amendment): server-side resolution (files-comments.ts)
  // falls back to the raw login email ONLY when the batched account->
  // contact resolver truly has nothing to name -- the render layer just
  // trusts and prints whatever authorName the server sent, including a bare
  // email for that unresolvable case (the email IS the identity, never a
  // fabricated name).
  it('renders a bare email as the author name when the server could not resolve a contact', () => {
    const comments: FileComment[] = [
      {
        id: 'c3',
        fileId: 'file-1',
        versionNumber: 1,
        authorName: 'sbek-organizer@example.com',
        authorRole: 'organizer',
        authorUserId: 'user-unresolved',
        body: 'Please add alt text to slide 4.',
        createdAt: Date.now() - 3_600_000,
      },
    ];
    render(<CommentThread comments={comments} onSend={noopSend} />);
    expect(screen.getByText('sbek-organizer@example.com')).toBeInTheDocument();
  });

  // w5-i: the composer's placeholder states what happens to a note (sent
  // AND kept on the thread), not a generic "to the speakers..." string.
  it('renders the DEC-708-amendment composer placeholder', () => {
    render(<CommentThread comments={[]} onSend={noopSend} />);
    expect(
      screen.getByPlaceholderText('Write a note — sent with the decision, and kept on the thread'),
    ).toBeInTheDocument();
  });

  it('renders "Ask for changes" as the filled (primary) action and "Send note only" as secondary, with the caption below the action group (DEC-720 amendment: the filled action is the one that moves work)', () => {
    render(<CommentThread comments={[]} onSend={noopSend} />);
    const askButton = screen.getByRole('button', { name: 'Ask for changes' });
    const sendButton = screen.getByRole('button', { name: 'Send note only' });
    expect(askButton.className.split(' ')).toEqual(expect.arrayContaining(['chq-btn', 'chq-btn-primary']));
    expect(askButton.className).not.toContain('chq-btn-secondary');
    expect(sendButton.className.split(' ')).toEqual(expect.arrayContaining(['chq-btn', 'chq-btn-secondary']));
    expect(sendButton.className).not.toContain('chq-btn-primary');

    const actions = document.querySelector('.chq-content-comment-actions');
    const caption = document.querySelector('.chq-content-comment-caption');
    expect(actions).toBeInTheDocument();
    expect(caption).toBeInTheDocument();
    const position = actions!.compareDocumentPosition(caption!);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // w52-d (DEC-678 amendment): a zero-comment thread renders through the
  // shared EmptyState 'fresh' block, never a bare `<li className="chq-
  // empty">` inside an otherwise-empty `<ul>`.
  it('renders the shared EmptyState fresh block for zero comments, with no empty <ul>', () => {
    render(<CommentThread comments={[]} onSend={noopSend} />);
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
    expect(document.querySelector('.chq-empty-block-fresh')).toBeInTheDocument();
    expect(document.querySelector('.chq-empty-actions')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-comment-list')).toBeNull();
  });

  // DEC-244 wave-58 amendment: the composer's own textarea declares the
  // MAX_COMMENT_BODY_LENGTH cap (4000, imported through lib/file-caps, the
  // named DEC-660 crossing into src/domain/files) and states it in a
  // caption, matching the portal's src/routes/portal/tasks/views.tsx caption
  // register.
  it('declares MAX_COMMENT_BODY_LENGTH as the textarea maxLength and states it in a caption', () => {
    render(<CommentThread comments={[]} onSend={noopSend} />);
    const textarea = screen.getByPlaceholderText(
      'Write a note — sent with the decision, and kept on the thread',
    ) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(MAX_COMMENT_BODY_LENGTH);
    expect(screen.getByText('Up to 4,000 characters.')).toBeInTheDocument();
  });

  // w30-a (DEC-317/DEC-720 wave-30 amendment): the note+status write is
  // durable even with zero mailable participants -- the summary line must
  // say so rather than falsely implying nobody-to-email failed.
  it('renders "Posted to the thread · nobody to email" when the send succeeded with zero recipients', async () => {
    async function zeroRecipientSend() {
      return { sent: 0, failed: [], recipients: 0 };
    }
    render(<CommentThread comments={[]} onSend={zeroRecipientSend} />);
    const textarea = screen.getByPlaceholderText('Write a note — sent with the decision, and kept on the thread');
    fireEvent.change(textarea, { target: { value: 'A note with nobody to mail.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send note only' }));
    await waitFor(() => {
      expect(screen.getByText('Posted to the thread · nobody to email')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Sent to \d/)).not.toBeInTheDocument();
  });

  it('renders "Sent to N recipients." when the send had at least one recipient', async () => {
    async function sendWithRecipients() {
      return { sent: 2, failed: [], recipients: 2 };
    }
    render(<CommentThread comments={[]} onSend={sendWithRecipients} />);
    const textarea = screen.getByPlaceholderText('Write a note — sent with the decision, and kept on the thread');
    fireEvent.change(textarea, { target: { value: 'A note with two recipients.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send note only' }));
    await waitFor(() => {
      expect(screen.getByText('Sent to 2 recipients.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Posted to the thread · nobody to email')).not.toBeInTheDocument();
  });
});
