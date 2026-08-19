// The file-level "Import CSV · the file will not do" refusal draws THREE
// actions, not two: alongside the primary and secondary the frame adds a
// tertiary download of the rejected rows. DEC-745 (wave-108 amendment):
// BUILT, not deferred -- ImportWizard.tsx already holds header, allDataRows
// and badRows (each carrying its 1-based `line`), which is exactly the
// rejected set the frame offers to download. See decisions/DEC-745.md's
// wave-108 amendment and docs/design/audit/desktop-frame-ledger-v12.md's
// "Divergences found while claiming" entry (now resolved). The frame
// citation itself is receipted at the assertion that proves it, below,
// rather than here -- a claim about the pack belongs next to its expect().
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';

afterEach(() => {
  cleanup();
});

// Header row (line 1), John (line 2, has email), Jane/Bob/Amy (lines 3-5:
// blank email, placeholder "n/a", missing-@), Sam (line 6, has email). 3 of
// 5 data rows have no usable email -- the rejected set the third action
// must download.
const CSV_WITH_MISSING_EMAILS = [
  'First Name,Last Name,Email,Company',
  'John,Doe,john@example.com,Acme',
  'Jane,Smith,,Beta',
  'Bob,Lee,n/a,Gamma',
  'Amy,Wu,priya.example.com,Delta',
  'Sam,Fox,sam@example.com,Zeta',
].join('\n');

describe('ImportWizard: DEC-745 third action on the file-level refusal (Contacts.dc.html:800)', () => {
  it('renders "Download the 3 rows" as a tertiary control alongside the primary and secondary', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV_WITH_MISSING_EMAILS } });

    await screen.findByText('3 of 5 rows have no email address');

    // The frame's other two actions still render (this task adds a third,
    // it never replaces the two the claim lane already built).
    expect(screen.getByRole('button', { name: 'Import the 2 good rows' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload a different file' })).toBeInTheDocument();

    // docs/design/Chautauqua Contacts.dc.html:800 draws the third action as
    // `Download the 9 rows` -- a tertiary link beside the two buttons above,
    // its count naming the REJECTED rows (9 of the pack's 205-row file, 3 of
    // this fixture's 5).
    const download = screen.getByRole('button', { name: 'Download the 3 rows' });
    expect(download).toBeInTheDocument();
    // Reads app source, not the pack: the app's existing tertiary-link
    // vocabulary (chq-btn-tertiary), not a hand-rolled class.
    expect(download).toHaveClass('chq-btn');
    expect(download).toHaveClass('chq-btn-tertiary');
  });

  describe('the download itself', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      createObjectURLSpy = vi.fn(() => 'blob:mock-url');
      revokeObjectURLSpy = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });
      // Tag every Blob with the raw parts it was constructed from so the
      // test can read the serialized CSV without depending on jsdom's
      // Blob#text() support (same idiom as YourDataPanel.render.test.tsx).
      class TaggedBlob extends Blob {
        __parts: BlobPart[];
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          this.__parts = parts;
        }
      }
      vi.stubGlobal('Blob', TaggedBlob);
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    afterEach(() => {
      clickSpy.mockRestore();
    });

    it('serializes the header plus EXACTLY the rejected rows, verbatim and in file order -- not the good rows', async () => {
      render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
      fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV_WITH_MISSING_EMAILS } });

      const download = await screen.findByRole('button', { name: 'Download the 3 rows' });
      fireEvent.click(download);

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalled();
      });

      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArg = createObjectURLSpy.mock.calls[0]![0] as unknown as { __parts: string[] };
      const text = blobArg.__parts.join('');
      const lines = text.split('\r\n');

      expect(lines).toEqual([
        'First Name,Last Name,Email,Company',
        'Jane,Smith,,Beta',
        'Bob,Lee,n/a,Gamma',
        'Amy,Wu,priya.example.com,Delta',
      ]);
      // Neither of the two good rows (John, Sam) appears anywhere in the
      // downloaded file.
      expect(text).not.toContain('John');
      expect(text).not.toContain('Sam');
      URL.revokeObjectURL('blob:mock-url');
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it("derives the download filename from the uploaded file's name", async () => {
      render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
      const file = new File([CSV_WITH_MISSING_EMAILS], 'attendees-2026.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText('Upload a CSV file') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      const download = await screen.findByRole('button', { name: 'Download the 3 rows' });
      fireEvent.click(download);

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalled();
      });

      const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(anchor.download).toBe('attendees-2026-rejected-rows.csv');
    });
  });
});
