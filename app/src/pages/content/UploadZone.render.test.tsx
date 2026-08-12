// w9-f: one upload vocabulary. UploadZone must validate against the same
// pure-core rule the server enforces (src/domain/files.ts), not a hand-rolled
// mirror — locks in the bug that existed when the SPA had its own copy: a
// 12 MB .md was rejected client-side while the server (25 MB text/document
// cap) would have accepted it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UploadZone } from './UploadZone';

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

  it('carries a non-empty accept attribute agreeing with the server allowlist', () => {
    render(<UploadZone kind="poster" onUpload={vi.fn()} />);
    const input = screen.getByLabelText('Upload poster') as HTMLInputElement;
    expect(input.accept).not.toBe('');
    expect(input.accept).toContain('.pdf');
    expect(input.accept).toContain('.md');
  });
});
