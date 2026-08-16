// w1-e regression: browser-persona pass found VersionList's old
// flat-index labeling merged two unrelated previousFileId chains (same
// submission+kind) into one fake lineage — e.g. a speaker's task-upload
// replace chain got labeled "v1"/"v2" as if it were older versions of a
// completely separate organizer-uploaded chain's "v3"/"Latest". Version
// numbers must be computed per chain.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VersionList } from './VersionList';
import type { DeliverableFile } from './types';

afterEach(() => cleanup());

function file(overrides: Partial<DeliverableFile> = {}): DeliverableFile {
  return {
    id: 'f1',
    submissionId: 'sub1',
    kind: 'presentation',
    filename: 'deck.pdf',
    sizeBytes: 1000,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: 'c1',
    uploaderName: null,
    createdAt: 1000,
    versionNo: 1,
    ...overrides,
  };
}

describe('VersionList', () => {
  it('labels a single chain NEWEST/v1', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null, versionNo: 1 });
    const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1', versionNo: 2 });
    render(<VersionList versions={[v2, v1]} onDeleted={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('NEWEST');
    expect(items[1]).toHaveTextContent('v1');
  });

  // DEC-901/w5-i: the newest row must name its version NUMBER as well as
  // the marker (never the marker alone) -- the marker itself is now a
  // separate right-aligned "NEWEST" badge, not appended inline to the tag.
  // The version it replaced carries REPLACED.
  it('labels the newest row "v<N>" plus a right-aligned NEWEST badge, and the version it replaced REPLACED', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null, versionNo: 1 });
    const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1', versionNo: 2 });
    render(<VersionList versions={[v2, v1]} onDeleted={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('v2');
    expect(items[0]!.querySelector('.chq-content-version-newest')).toHaveTextContent('NEWEST');
    expect(items[0]).not.toHaveTextContent('REPLACED');
    expect(items[1]).toHaveTextContent('v1');
    expect(items[1]!.querySelector('.chq-content-version-newest')).toHaveTextContent('');
    expect(items[1]).toHaveTextContent('REPLACED');
  });

  // DEC-901: a version uploaded after the submission's most recent
  // changes-requested decision (statusChangedAt, DeliverableDetail's
  // header-band timestamp) is annotated, but only while the submission
  // still reads changes_requested and only for versions newer than that
  // instant.
  it('annotates a version uploaded after a changes-requested decision', () => {
    const beforeAsk = file({ id: 'before', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    const afterAsk = file({ id: 'after', filename: 'slides-v2.pdf', createdAt: 300, previousFileId: 'before' });
    render(
      <VersionList
        versions={[afterAsk, beforeAsk]}
        onDeleted={() => {}}
        contentStatus="changes_requested"
        statusChangedAt={200}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Uploaded after changes were requested');
    expect(items[1]).not.toHaveTextContent('Uploaded after changes were requested');
  });

  it('does not annotate any row when contentStatus/statusChangedAt are absent', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    render(<VersionList versions={[v1]} onDeleted={() => {}} />);
    expect(screen.queryByText('Uploaded after changes were requested')).not.toBeInTheDocument();
  });

  it('numbers two independent chains separately instead of merging them into one fake lineage', () => {
    // Newest chain (organizer upload): 2 versions, newest overall.
    const orgOld = file({ id: 'org-old', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    const orgNew = file({ id: 'org-new', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'org-old' });
    // Older, unrelated chain (a speaker task-upload replace): also 2 versions.
    const taskOld = file({ id: 'task-old', filename: 'slides.pdf', createdAt: 10, previousFileId: null });
    const taskNew = file({ id: 'task-new', filename: 'slides.pdf', createdAt: 20, previousFileId: 'task-old' });

    orgOld.versionNo = 1;
    orgNew.versionNo = 2;
    taskOld.versionNo = 1;
    taskNew.versionNo = 2;
    render(<VersionList versions={[orgNew, orgOld, taskNew, taskOld]} onDeleted={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    // Only the single overall-newest file carries the NEWEST badge.
    expect(items[0]!.querySelector('.chq-content-version-newest')).toHaveTextContent('NEWEST');
    expect(items[1]).toHaveTextContent('v1');
    // The unrelated older chain gets its OWN v2/v1 numbering, never v3/v4
    // (which would wrongly imply it's a continuation of the newer chain).
    expect(items[2]).toHaveTextContent('v2');
    expect(items[2]!.querySelector('.chq-content-version-newest')).toHaveTextContent('');
    expect(items[3]).toHaveTextContent('v1');
  });

  // DEC-965: a version number is the row's STORED identity, not a chain
  // position -- when a middle version is deleted the survivors keep their
  // own version_no rather than being renumbered to look contiguous.
  it('renders the stored version_no for a chain with a deleted middle version, never a re-derived position', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null, versionNo: 1 });
    const v3 = file({ id: 'v3', filename: 'slides-v3.pdf', createdAt: 300, previousFileId: 'v1', versionNo: 3 });
    render(<VersionList versions={[v3, v1]} onDeleted={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('v3');
    expect(items[0]!.querySelector('.chq-content-version-newest')).toHaveTextContent('NEWEST');
    expect(items[1]).toHaveTextContent('v1');
    expect(screen.queryByText('v2')).not.toBeInTheDocument();
  });

  // DEC-678 (w55-c): the zero-row state renders through EmptyState's fresh
  // variant (no filter axis on this list), not the bare `.chq-empty` line.
  it('renders nothing-uploaded-yet copy for an empty list, through EmptyState fresh anatomy', () => {
    render(<VersionList versions={[]} onDeleted={() => {}} />);
    expect(screen.getByText('No versions uploaded yet.')).toBeInTheDocument();
    const block = document.querySelector('.chq-empty-block');
    expect(block).toHaveClass('chq-empty-block-fresh');
    expect(block?.querySelector('.chq-empty-what')).toHaveTextContent('No versions uploaded yet.');
    // Fresh has no escape link (there is no filter to clear) and no
    // primary action was passed, so no actions row either.
    expect(block?.querySelector('.chq-empty-escape')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-empty')).not.toBeInTheDocument();
  });

  // w1-h reskin: every version, including prior ones, must stay downloadable
  // and the current version must be marked distinctly (via type, DEC-367).
  it('keeps a Download link on every version and marks only the current one is-current', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1' });
    render(<VersionList versions={[v2, v1]} onDeleted={() => {}} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveClass('is-current');
    expect(items[1]).not.toHaveClass('is-current');

    const downloadLinks = screen.getAllByRole('link', { name: 'Download' });
    expect(downloadLinks).toHaveLength(2);
    expect(downloadLinks[0]).toHaveAttribute('href', '/files/v2');
    expect(downloadLinks[1]).toHaveAttribute('href', '/files/v1');
  });

  // DEC-713: delete is a quiet tertiary, confirmed through ConfirmDialog
  // (never window.confirm), and refreshes the list on success.
  describe('delete (DEC-713)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('shows a Delete button per row and only opens the confirm dialog after clicking it', () => {
      const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
      render(<VersionList versions={[v1]} onDeleted={() => {}} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(deleteButtons).toHaveLength(1);
    });

    it('deletes via DELETE /api/v1/files/:id and calls onDeleted after confirming', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'v1', deleted: true }), { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const onDeleted = vi.fn();
      const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
      render(<VersionList versions={[v1]} onDeleted={onDeleted} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/slides-v1\.pdf/)).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete version' }));

      await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/files/v1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('cancelling the confirm dialog never calls DELETE', () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
      render(<VersionList versions={[v1]} onDeleted={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // w9-c / DESIGN-RULINGS A3: only a chain's own head asks before
    // deleting -- it's the live file the portal/public surfaces resolve
    // to. A superseded row (idxInChain > 0) is dead weight already, so it
    // deletes immediately on click, no dialog.
    it('a chain head still confirms, but a superseded row deletes immediately with no dialog', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 })));
      global.fetch = fetchMock as unknown as typeof fetch;

      const onDeleted = vi.fn();
      const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null, versionNo: 1 });
      const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1', versionNo: 2 });
      render(<VersionList versions={[v2, v1]} onDeleted={onDeleted} />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(deleteButtons).toHaveLength(2);

      // Superseded row (v1, idxInChain 1): fires immediately, no dialog.
      fireEvent.click(deleteButtons[1]!);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/files/v1'),
        expect.objectContaining({ method: 'DELETE' }),
      );

      // Chain head (v2, idxInChain 0): still asks first.
      fireEvent.click(deleteButtons[0]!);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete version' }));
      await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(2));
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/files/v2'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('a rejected delete on a superseded row (no dialog) still surfaces the error banner', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Cannot delete this version' } }), {
          status: 403,
        }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null, versionNo: 1 });
      const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1', versionNo: 2 });
      render(<VersionList versions={[v2, v1]} onDeleted={() => {}} />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(deleteButtons[1]!);

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete this version'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Both chain heads in a multi-chain list ask before deleting -- the
    // task-upload chain and the organizer chain are independent documents,
    // each with its own live file.
    it('both chain heads in a multi-chain fixture ask before deleting', () => {
      const orgOld = file({ id: 'org-old', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null, versionNo: 1 });
      const orgNew = file({ id: 'org-new', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'org-old', versionNo: 2 });
      const taskOld = file({ id: 'task-old', filename: 'slides.pdf', createdAt: 10, previousFileId: null, versionNo: 1 });
      const taskNew = file({ id: 'task-new', filename: 'slides.pdf', createdAt: 20, previousFileId: 'task-old', versionNo: 2 });

      const fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(<VersionList versions={[orgNew, orgOld, taskNew, taskOld]} onDeleted={() => {}} />);
      const items = screen.getAllByRole('listitem');

      // items[0] = orgNew (global newest, chain head), items[2] = taskNew
      // (this chain's own head, but not the global newest).
      fireEvent.click(within(items[0]!).getByRole('button', { name: 'Delete' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(within(items[2]!).getByRole('button', { name: 'Delete' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(within(screen.getByRole('dialog')).getByText(/slides\.pdf/)).toBeInTheDocument();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
