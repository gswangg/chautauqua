import { describe, expect, it } from 'vitest';
import { DOCUMENT_MAX_BYTES, MEDIA_MAX_BYTES, formatAcceptedTypesMessage, validateUploadFile } from './upload-validation';

describe('formatAcceptedTypesMessage', () => {
  it('states the accepted extensions and caps verbatim from DEC-020', () => {
    const msg = formatAcceptedTypesMessage();
    for (const ext of ['pdf', 'ppt', 'pptx', 'key', 'odp', 'zip', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md']) {
      expect(msg).toContain(ext);
    }
    expect(msg).toContain('25 MB');
    expect(msg).toContain('8 MB');
  });
});

describe('validateUploadFile', () => {
  it('accepts a pdf under the 25 MB document cap', () => {
    expect(validateUploadFile({ name: 'deck.pdf', size: 1024 })).toEqual({ valid: true });
  });

  it('rejects a document over the 25 MB cap', () => {
    const result = validateUploadFile({ name: 'deck.pdf', size: DOCUMENT_MAX_BYTES + 1 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/25 MB/);
  });

  it('accepts a png under the 8 MB media cap', () => {
    expect(validateUploadFile({ name: 'poster.png', size: 1024 })).toEqual({ valid: true });
  });

  it('rejects a media file over the 8 MB cap', () => {
    const result = validateUploadFile({ name: 'poster.png', size: MEDIA_MAX_BYTES + 1 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/8 MB/);
  });

  it('accepts txt/md under the media cap', () => {
    expect(validateUploadFile({ name: 'notes.txt', size: 1024 }).valid).toBe(true);
    expect(validateUploadFile({ name: 'notes.md', size: 1024 }).valid).toBe(true);
  });

  it('rejects an unlisted extension as invalid', () => {
    const result = validateUploadFile({ name: 'macro.exe', size: 10 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/not an accepted file type/);
  });

  it('rejects a file with no extension', () => {
    const result = validateUploadFile({ name: 'noextension', size: 10 });
    expect(result.valid).toBe(false);
  });
});
