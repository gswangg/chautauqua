// w1-e regression: browser-persona pass found VersionList's old
// flat-index labeling merged two unrelated previousFileId chains (same
// submission+kind) into one fake lineage — e.g. a speaker's task-upload
// replace chain got labeled "v1"/"v2" as if it were older versions of a
// completely separate organizer-uploaded chain's "v3"/"Latest". Version
// numbers must be computed per chain.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
    ...overrides,
  };
}

describe('VersionList', () => {
  it('labels a single chain Latest/v1', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1' });
    render(<VersionList versions={[v2, v1]} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Latest');
    expect(items[1]).toHaveTextContent('v1');
  });

  it('numbers two independent chains separately instead of merging them into one fake lineage', () => {
    // Newest chain (organizer upload): 2 versions, newest overall.
    const orgOld = file({ id: 'org-old', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    const orgNew = file({ id: 'org-new', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'org-old' });
    // Older, unrelated chain (a speaker task-upload replace): also 2 versions.
    const taskOld = file({ id: 'task-old', filename: 'slides.pdf', createdAt: 10, previousFileId: null });
    const taskNew = file({ id: 'task-new', filename: 'slides.pdf', createdAt: 20, previousFileId: 'task-old' });

    render(<VersionList versions={[orgNew, orgOld, taskNew, taskOld]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    // Only the single overall-newest file is "Latest".
    expect(items[0]).toHaveTextContent('Latest');
    expect(items[1]).toHaveTextContent('v1');
    // The unrelated older chain gets its OWN v2/v1 numbering, never v3/v4
    // (which would wrongly imply it's a continuation of the newer chain).
    expect(items[2]).toHaveTextContent('v2');
    expect(items[2]).not.toHaveTextContent('Latest');
    expect(items[3]).toHaveTextContent('v1');
  });

  it('renders nothing-uploaded-yet copy for an empty list', () => {
    render(<VersionList versions={[]} />);
    expect(screen.getByText('No versions uploaded yet.')).toBeInTheDocument();
  });

  // w1-h reskin: every version, including prior ones, must stay downloadable
  // and the current version must be marked distinctly (via type, DEC-367).
  it('keeps a Download link on every version and marks only the current one is-current', () => {
    const v1 = file({ id: 'v1', filename: 'slides-v1.pdf', createdAt: 100, previousFileId: null });
    const v2 = file({ id: 'v2', filename: 'slides-v2.pdf', createdAt: 200, previousFileId: 'v1' });
    render(<VersionList versions={[v2, v1]} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveClass('is-current');
    expect(items[1]).not.toHaveClass('is-current');

    const downloadLinks = screen.getAllByRole('link', { name: 'Download' });
    expect(downloadLinks).toHaveLength(2);
    expect(downloadLinks[0]).toHaveAttribute('href', '/files/v2');
    expect(downloadLinks[1]).toHaveAttribute('href', '/files/v1');
  });
});
