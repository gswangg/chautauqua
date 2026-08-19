// w9-f: one upload vocabulary. UploadZone must validate against the same
// pure-core rule the server enforces (src/domain/files.ts), not a hand-rolled
// mirror — locks in the bug that existed when the SPA had its own copy: a
// 12 MB .md was rejected client-side while the server (25 MB text/document
// cap) would have accepted it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UploadZone } from './UploadZone';
import { allowedUploadExtensions } from '../../../../src/domain/files';

afterEach(() => {
  cleanup();
});

function makeFile(name: string, sizeBytes: number, type = 'application/octet-stream'): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

const SESSION_TITLE = 'Taming 40-Minute CI';

describe('UploadZone', () => {
  it('accepts a 12 MB .md file (server 25 MB text/document cap, not the old 8 MB SPA mirror)', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    const file = makeFile('notes.md', 12 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledWith(file, 'handout', undefined));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // w28-c / DEC-653 findings-wave-5 amendment: a validateUpload refusal opens
  // the framed "Upload rejected" modal (not an inline .chq-field-error span)
  // with all four parts -- header naming the session + deliverable kind, the
  // error band's refusal + why-these-formats sentence, the "What was kept"
  // survival line, and the Choose another file / Cancel footer.
  it('a refused file opens the "Upload rejected" modal with all four parts', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    const file = makeFile('notes.exe', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    const dialog = await screen.findByRole('dialog');
    // header: title + session/kind subtitle
    expect(dialog).toHaveTextContent('That file was not uploaded');
    expect(dialog).toHaveTextContent(`${SESSION_TITLE} · handout`);
    // error band: filename + the pure core's own refusal message, plus the
    // why-these-formats sentence derived from uploadHintText -- never a
    // second hand-written format list.
    expect(dialog).toHaveTextContent("notes.exe File type '.exe' isn't allowed");
    expect(dialog).toHaveTextContent('Allowed types:');
    expect(dialog).toHaveTextContent('.pdf');
    // "What was kept" micro-label + the survival sentence (no
    // replacesFileId, so nothing was uploaded)
    expect(dialog).toHaveTextContent('What was kept');
    expect(dialog).toHaveTextContent('Nothing was uploaded.');
    // footer
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    expect(onUpload).not.toHaveBeenCalled();
  });

  it('states the replace-scoped survival clause when replacesFileId is set', async () => {
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} replacesFileId="file-1" onUpload={vi.fn()} />);
    const input = screen.getByLabelText('Replace handout') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('notes.exe', 1024)] } });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('The current file is unchanged. Nothing was replaced.');
  });

  it('Cancel closes the modal without calling onUpload; a subsequent valid pick still uploads', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('notes.exe', 1024)] } });
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { files: [makeFile('notes.md', 1024)] } });
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // A server/network failure on onUpload (as opposed to a validateUpload
  // field-level refusal) keeps its existing inline treatment -- it is a
  // retryable failure of the act, not a refusal of the file, so it must NOT
  // open the modal (DEC-653 findings-wave-5 amendment).
  it('an onUpload server failure renders inline, not the "Upload rejected" modal', async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    const file = makeFile('notes.md', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Network error');
    expect(alert).toHaveClass('chq-error');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('carries a non-empty accept attribute agreeing with the server allowlist', () => {
    render(<UploadZone kind="poster" sessionTitle={SESSION_TITLE} onUpload={vi.fn()} />);
    const input = screen.getByLabelText('Upload poster') as HTMLInputElement;
    expect(input.accept).not.toBe('');
    expect(input.accept).toContain('.pdf');
    expect(input.accept).toContain('.md');
  });

  // w41-a: single-line dashed strip -- "Drop a file..." prompt + the
  // accepted-type/size-cap text (CNT-06, verbatim, never a tooltip) on the
  // same line, the native input reachable but visually hidden behind a
  // <label>, still keyboard-focusable via that label's `for`.
  it('renders the drop prompt and the CNT-06 caps text in one line, with the input reachable via a label', () => {
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={vi.fn()} />);
    expect(screen.getByText('Drop a file to upload for the speaker')).toBeInTheDocument();
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'file');
    // the input is still findable by its own aria-label, and pointed at by
    // a <label for> — clicking the label's text still reaches the input.
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(label).not.toBeNull();
    expect(label).toHaveTextContent('Drop a file to upload for the speaker');
    expect(label).toHaveTextContent(/PDF/i);
  });

  // w10-e (DEC-879 amendment): the accept attribute and the printed caps
  // text must name the same per-kind extension set -- both derive from the
  // one src/domain/files.ts filter, never a hand-copied second list.
  it('the accept attribute and the caps text name the same extensions for kind:recording', () => {
    render(<UploadZone kind="recording" sessionTitle={SESSION_TITLE} onUpload={vi.fn()} />);
    const input = screen.getByLabelText('Upload recording') as HTMLInputElement;
    const acceptExts = input.accept.split(',').map((e) => e.replace(/^\./, ''));
    expect(new Set(acceptExts)).toEqual(new Set(allowedUploadExtensions('recording')));
    expect(input.accept).toContain('.mp4');
    const caps = screen.getByText(/Allowed types/);
    expect(caps).toHaveTextContent('.mp4');
  });

  // v12m-w2-g (DEC-976 wave-99 amendment, DEC-383): a pointer-independent
  // phone copy for the drop label. Both the desktop drag copy and the
  // frame's phone copy render at once (the swap is CSS-only, upload-zone
  // .css's @media block, never a JS width read); the phone span carries the
  // class upload-zone.css toggles, and the label still points at the same
  // visually-hidden file input.
  it('renders both the desktop drag copy and the frame phone copy, both inside the label pointing at the file input', () => {
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={vi.fn()} />);
    expect(screen.getByText('Drop a file to upload for the speaker')).toBeInTheDocument();
    // docs/design/Chautauqua Content.dc.html:417 draws `<a href="#" style="margin-top:14px; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#4E5C31">Upload a file for the speaker</a>`.
    const phoneCopy = screen.getByText('Upload a file for the speaker');
    expect(phoneCopy).toHaveClass('chq-content-upload-prompt-phone');
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(label).not.toBeNull();
    expect(label).toContainElement(phoneCopy);
    expect(label).toHaveTextContent('Drop a file to upload for the speaker');
    expect(label).toHaveTextContent('Upload a file for the speaker');
  });

  // The pending/uploading branch keeps its single unmoving line (DEC-733) --
  // no desktop/phone span pair mounts while an upload is in flight.
  it('the pending/uploading branch stays a single unmoving line, with no phone/desktop span pair mounted', async () => {
    let resolveUpload: () => void = () => {};
    const onUpload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    render(<UploadZone kind="handout" sessionTitle={SESSION_TITLE} onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('notes.md', 1024)] } });

    await screen.findByText('Uploading…');
    expect(screen.queryByText('Upload a file for the speaker')).not.toBeInTheDocument();
    expect(screen.queryByText('Drop a file to upload for the speaker')).not.toBeInTheDocument();

    resolveUpload();
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());
  });
});
