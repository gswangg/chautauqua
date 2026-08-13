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
});
