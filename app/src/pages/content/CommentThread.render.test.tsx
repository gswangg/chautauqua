// w15-e (DEC-872, GATE-1): a portal speaker note has authorRole null (no
// linked user) and must render without the '(unknown)' role leak; a
// comment authored by the signed-in organizer reads 'You' (identity by
// useMe().userId, never a display-string comparison).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommentThread } from './CommentThread';
import type { FileComment } from './types';

vi.mock('../../lib/useMe', () => ({
  useMe: () => ({ me: { userId: 'user-organizer', email: 'org@example.com', name: 'Pat Organizer', role: 'organizer', orgId: 'org-1' }, loading: false }),
}));

afterEach(() => {
  cleanup();
});

async function noopSend() {
  return { sent: 0, failed: [] };
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
});
