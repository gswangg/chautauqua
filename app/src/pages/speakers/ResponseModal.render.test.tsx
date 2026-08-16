// DEC-248 amendment (wave 10) coverage: a file-kind field's answer renders
// as a download link to /files/{id} labelled with the filename; every other
// field keeps today's plain-value (or em-dash fallback) rendering.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ResponseModal } from './ResponseModal';
import type { AssignmentResponseDetail } from './types';

afterEach(() => cleanup());

function makeDetail(overrides: Partial<AssignmentResponseDetail> = {}): AssignmentResponseDetail {
  return {
    assignmentId: 'as1',
    taskTitle: 'Flight reimbursement form',
    contact: { id: 'c1', name: 'Ada Lovelace', email: 'ada@example.com' },
    status: 'complete',
    completedAt: 1700000000000,
    fields: [],
    ...overrides,
  };
}

describe('ResponseModal', () => {
  it('renders a download link for a file-kind field', () => {
    render(
      <ResponseModal
        contactName="Ada Lovelace"
        loading={false}
        error={null}
        detail={makeDetail({
          fields: [{ label: 'Receipt', value: 'file-1', file: { id: 'file-1', filename: 'receipt.pdf' } }],
        })}
        onStatusChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'Download receipt.pdf' });
    expect(link).toHaveAttribute('href', '/files/file-1');
    expect(link).toHaveTextContent('receipt.pdf');
  });

  it('falls back to the plain value (or em-dash) when no file is present', () => {
    render(
      <ResponseModal
        contactName="Ada Lovelace"
        loading={false}
        error={null}
        detail={makeDetail({
          fields: [
            { label: 'Notes', value: 'some notes' },
            { label: 'Unanswered', value: '' },
          ],
        })}
        onStatusChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('some notes')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
