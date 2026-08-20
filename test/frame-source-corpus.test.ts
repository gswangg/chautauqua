// Proves test/frame-source-corpus.ts's primitives over FABRICATED fixtures
// only -- never a real product token or product count (DEC-967 wave-130
// amendment; task w5-n). This is the suite; frame-source-corpus.ts is the
// helper it imports.
import { describe, expect, it } from 'vitest';
import { labelIsMatched, normalizeSource, stripComments } from './frame-source-corpus';

describe('frame-source-corpus: stripComments', () => {
  it('removes a genuine block comment', () => {
    const src = 'const a = 1; /* this is a comment */ const b = 2;';
    const out = stripComments(src);
    expect(out).not.toContain('this is a comment');
    expect(out).toContain('const a = 1;');
    expect(out).toContain('const b = 2;');
  });

  it('removes a genuine line comment', () => {
    const src = ['const a = 1; // trailing line comment', 'const b = 2;'].join('\n');
    const out = stripComments(src);
    expect(out).not.toContain('trailing line comment');
    expect(out).toContain('const a = 1;');
    expect(out).toContain('const b = 2;');
  });

  it('a // comment containing /* does not open a phantom block comment that eats later code', () => {
    // This is the exact defect measured on main 9fa38009 in
    // test/frame-control-label.scan.test.ts's old two-regex stripper: a `/*`
    // token inside a `//` line comment opened a block-comment state that
    // survived past the line comment's own end and deleted real code up to
    // the next literal `*/` anywhere later in the file.
    const src = [
      '// note: /* not a real block comment opener */',
      "const zzySyntheticLabel = 'Zzy Synthetic Survives';",
    ].join('\n');
    const out = stripComments(src);
    expect(out).toContain('Zzy Synthetic Survives');
  });

  it('a string containing // survives intact (no truncation)', () => {
    const src = "const zzySyntheticUrl = 'https://example.test/zzy-synthetic-path';";
    const out = stripComments(src);
    expect(out).toContain('https://example.test/zzy-synthetic-path');
  });

  it('a string containing /* survives intact (no phantom block comment)', () => {
    const src = "const zzySyntheticLabel = 'zzy /* not a comment */ synthetic tail';";
    const out = stripComments(src);
    expect(out).toContain('zzy /* not a comment */ synthetic tail');
  });

  it('an escaped quote inside a string does not end the string early', () => {
    const src = "const zzySynthetic = 'zzy \\'inner\\' // still inside the string';";
    const out = stripComments(src);
    expect(out).toContain('zzy');
    expect(out).toContain('still inside the string');
  });
});

describe('frame-source-corpus: normalizeSource', () => {
  it('decodes the frame pack entity form of a leading chevron to match the frame literal', () => {
    const normalized = normalizeSource('const zzySyntheticBack = "&lsaquo; Zzy Synthetic";');
    expect(normalized).toContain('‹ Zzy Synthetic');
  });

  it('strips comments and collapses whitespace together', () => {
    const src = ['/* header */', 'const   zzy   =   "Zzy   Synthetic   Spaced";', '// trailer'].join('\n');
    const normalized = normalizeSource(src);
    expect(normalized).not.toContain('header');
    expect(normalized).not.toContain('trailer');
    expect(normalized).toContain('Zzy Synthetic Spaced');
    expect(normalized).not.toMatch(/ {2,}/);
  });
});

describe('frame-source-corpus: labelIsMatched (word-boundary anchored)', () => {
  it('a short label is NOT satisfied by a longer word that merely contains it', () => {
    const blobs = [normalizeSource('const x = "Waitlist";')];
    expect(labelIsMatched('Wait', blobs)).toBe(false);
  });

  it('the same label IS matched when the exact word is present', () => {
    const blobs = [normalizeSource('const x = "Wait";')];
    expect(labelIsMatched('Wait', blobs)).toBe(true);
  });

  it('a punctuation-led label matches even directly against other punctuation', () => {
    const blobs = [normalizeSource('const back = "&lsaquo;Zzy Synthetic Tight";')];
    expect(labelIsMatched('‹Zzy Synthetic Tight', blobs)).toBe(true);
  });

  it('an entity-encoded frame literal matches the frame pack literal form', () => {
    const blobs = [normalizeSource('const back = "&lsaquo; Zzy";')];
    expect(labelIsMatched('‹ Zzy', blobs)).toBe(true);
  });
});
