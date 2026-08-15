import { describe, expect, it } from 'vitest';
import {
  formatReceiptBlock,
  isProductPath,
  newestProductBearingSha,
  type RefAncestry,
} from '../scripts/ref-state';

describe('isProductPath', () => {
  it('matches directory prefixes', () => {
    expect(isProductPath('src/foo.ts')).toBe(true);
    expect(isProductPath('app/src/bar.tsx')).toBe(true);
    expect(isProductPath('migrations/0001_init.sql')).toBe(true);
  });

  it('matches package.json as an exact top-level file, not a prefix', () => {
    expect(isProductPath('package.json')).toBe(true);
    expect(isProductPath('packages/x')).toBe(false);
    expect(isProductPath('packages/x/package.json')).toBe(false);
  });

  it('does not match allow-listed non-product paths', () => {
    expect(isProductPath('scripts/ref-state.ts')).toBe(false);
    expect(isProductPath('test/ref-state.test.ts')).toBe(false);
    expect(isProductPath('docs/verification-log.md')).toBe(false);
    expect(isProductPath('decisions/DEC-644.md')).toBe(false);
    expect(isProductPath('field-guide/index.md')).toBe(false);
  });
});

describe('newestProductBearingSha', () => {
  it('skips past a docs-only newest commit to find the newest product-bearing one', () => {
    const log = [
      'f578347900000000000000000000000000000000',
      '',
      'docs/verification-log/index/0190-x.md',
      'field-guide/index.md',
      '',
      '3a04150700000000000000000000000000000000',
      '',
      'src/lib/foo.ts',
      'test/foo.test.ts',
      '',
      '1111111111111111111111111111111111111111',
      '',
      'src/lib/bar.ts',
      '',
    ].join('\n');
    expect(newestProductBearingSha(log)).toBe('3a04150700000000000000000000000000000000');
  });

  it('returns null when no commit in the log touches a product path', () => {
    const log = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '',
      'docs/notes.md',
      '',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '',
      'scripts/tool.ts',
      'test/tool.test.ts',
      '',
    ].join('\n');
    expect(newestProductBearingSha(log)).toBeNull();
  });

  it('treats the newest commit itself as product-bearing when it touches package.json', () => {
    const log = ['cccccccccccccccccccccccccccccccccccccccc', '', 'package.json', ''].join('\n');
    expect(newestProductBearingSha(log)).toBe('cccccccccccccccccccccccccccccccccccccccc');
  });

  it('returns null on an empty log', () => {
    expect(newestProductBearingSha('')).toBeNull();
  });
});

describe('formatReceiptBlock', () => {
  it('lists a non-ancestor ref explicitly rather than omitting it', () => {
    const refs: RefAncestry[] = [
      { ref: 'task-w36-a', sha: 'deadbeef', isAncestor: true },
      { ref: 'task-w37-c', sha: 'baadf00d', isAncestor: false },
    ];
    const block = formatReceiptBlock({ head: 'f5783479', productSha: '3a041507', refs });

    expect(block).toContain('HEAD `f5783479`');
    expect(block).toContain('`3a041507`');
    expect(block).toContain('`task-w36-a`');
    expect(block).toContain('NON-ancestor refs');
    expect(block).toContain('`task-w37-c`');
  });

  it('reports no live refs and no product sha distinctly', () => {
    const block = formatReceiptBlock({ head: 'abc123', productSha: null, refs: [] });
    expect(block).toContain('none found in first-parent history');
    expect(block).toContain('no live refs confirmed');
    expect(block).toContain('NON-ancestor refs: none.');
  });

  it('emits "NON-ancestor refs: none." when every ref is an ancestor', () => {
    const refs: RefAncestry[] = [{ ref: 'task-w36-b', sha: 'feedface', isAncestor: true }];
    const block = formatReceiptBlock({ head: 'f5783479', productSha: '3a041507', refs });
    expect(block).toContain('NON-ancestor refs: none.');
    expect(block).not.toContain('`task-w37-c`');
  });
});
