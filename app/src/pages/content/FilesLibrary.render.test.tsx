// DEC-161 render smoke for the DEC-159/DEC-160 central files library:
// mounts against real /api/v1/events/:eventId/files list-envelope shapes
// and asserts a marker element renders with zero console.error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-files-render-1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FilesLibrary render smoke', () => {
  it('renders the version-chain table with zero console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([
        {
          rootFileId: 'file-v1',
          latestFileId: 'file-v2',
          filename: 'slides.pdf',
          kind: 'presentation',
          submissionId: 'sub-1',
          submissionRef: 'SES-014',
          submissionTitle: 'Scaling Vector Search',
          speakerName: 'Priya Raman',
          uploadedAt: 1700000000000,
          versionCount: 2,
        },
      ]),
    });

    const onSelectSubmission = vi.fn();
    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={onSelectSubmission} />);

    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    expect(await screen.findByText('slides.pdf')).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download ZIP (0)' })).toBeInTheDocument();

    // Filename, session, and Versions cells must all be real focusable
    // buttons (not onClick divs) so keyboard users and automation can
    // discover and open the deliverable detail drill-in.
    const openButtons = screen.getAllByRole('button', { name: 'Open slides.pdf versions and comments' });
    expect(openButtons).toHaveLength(3);
    for (const button of openButtons) {
      expect(button.tagName).toBe('BUTTON');
    }
    fireEvent.click(openButtons[0]!);
    expect(onSelectSubmission).toHaveBeenCalledWith('sub-1');
    fireEvent.click(openButtons[2]!);
    expect(onSelectSubmission).toHaveBeenCalledWith('sub-1');

    consoleError.mockRestore();
  });

  it('renders a dash instead of a dead control for rows with no submissionId', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([
        {
          rootFileId: 'file-orphan',
          latestFileId: 'file-orphan',
          filename: 'orphan.pdf',
          kind: 'presentation',
          submissionId: '',
          submissionRef: '',
          submissionTitle: '',
          speakerName: 'Unknown',
          uploadedAt: 1700000000000,
          versionCount: 1,
        },
      ]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    expect(await screen.findByText('orphan.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open orphan\.pdf/ })).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('handles an empty library without erroring', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([]),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No deliverable files yet.')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });
});
