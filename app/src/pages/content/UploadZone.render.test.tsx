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

describe('UploadZone', () => {
  it('accepts a 12 MB .md file (server 25 MB text/document cap, not the old 8 MB SPA mirror)', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="handout" onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    const file = makeFile('notes.md', 12 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledWith(file, 'handout', undefined));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects a 30 MB .pdf with the server validateUpload message verbatim', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="presentation" onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload presentation') as HTMLInputElement;
    const file = makeFile('deck.pdf', 30 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('File exceeds the 25 MB limit for this type');
    expect(onUpload).not.toHaveBeenCalled();
  });

  // w28-c (DEC-653, DEC-124): the field-error standard -- refusal, format+why,
  // and survival clauses, plus the field register (chq-field-invalid on the
  // input, aria-invalid, chq-field-error on the message), clearing on a
  // subsequent valid pick.
  it('a wrong-extension upload states the refusal, the accepted-format reason, and what survived, and marks the input invalid', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="handout" onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    const file = makeFile('notes.exe', 1024);
    fireEvent.change(input, { target: { files: [file] } });
    const alert = await screen.findByRole('alert');
    // what was refused (pure core's own message)
    expect(alert).toHaveTextContent("File type '.exe' isn't allowed");
    // which formats are accepted and why -- derived from uploadHintText, not
    // a second hand-written list
    expect(alert).toHaveTextContent('Allowed types:');
    expect(alert).toHaveTextContent('.pdf');
    // what survived -- no replacesFileId, so nothing was uploaded
    expect(alert).toHaveTextContent('Nothing was uploaded.');
    expect(alert).toHaveClass('chq-field-error');
    expect(input).toHaveClass('chq-field-invalid');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('states the replace-scoped survival clause when replacesFileId is set', async () => {
    render(<UploadZone kind="handout" replacesFileId="file-1" onUpload={vi.fn()} />);
    const input = screen.getByLabelText('Replace handout') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('notes.exe', 1024)] } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The current file is unchanged. Nothing was replaced.');
  });

  it('clears the invalid state and message once a valid file is subsequently chosen', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<UploadZone kind="handout" onUpload={onUpload} />);
    const input = screen.getByLabelText('Upload handout') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('notes.exe', 1024)] } });
    await screen.findByRole('alert');
    expect(input).toHaveClass('chq-field-invalid');

    fireEvent.change(input, { target: { files: [makeFile('notes.md', 1024)] } });
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).not.toHaveClass('chq-field-invalid');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('carries a non-empty accept attribute agreeing with the server allowlist', () => {
    render(<UploadZone kind="poster" onUpload={vi.fn()} />);
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
    render(<UploadZone kind="handout" onUpload={vi.fn()} />);
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
    render(<UploadZone kind="recording" onUpload={vi.fn()} />);
    const input = screen.getByLabelText('Upload recording') as HTMLInputElement;
    const acceptExts = input.accept.split(',').map((e) => e.replace(/^\./, ''));
    expect(new Set(acceptExts)).toEqual(new Set(allowedUploadExtensions('recording')));
    expect(input.accept).toContain('.mp4');
    const caps = screen.getByText(/Allowed types/);
    expect(caps).toHaveTextContent('.mp4');
  });
});
