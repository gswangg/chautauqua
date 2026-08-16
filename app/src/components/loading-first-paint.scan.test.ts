// DEC-678 (wave-58 amendment), DESIGN-RULINGS.md:325-333 "Loading -- the
// first paint": always six rows, never a caller-supplied guess; no
// shimmer/pulse; 250ms delay for the bare-text DelayedLoading path. This
// scan enumerates every `<PageSkeleton` call site under app/src and proves
// none of them can pass a row count -- the component has no `rows` prop at
// all, so this is really a population-completeness check (the matcher must
// see every call site) plus a negative control (the matcher must actually
// catch a `rows=` occurrence when one exists).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('loading-first-paint: PageSkeleton row-count population', () => {
  const files = walk(APP_SRC);
  // <PageSkeleton ... /> possibly spanning multiple attributes/lines, up to
  // its closing `/>` or `>`.
  const CALL_RE = /<PageSkeleton\b[^>]*\/?>/gs;

  it('finds a non-empty population of PageSkeleton call sites', () => {
    let count = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const matches = src.match(CALL_RE);
      if (matches) count += matches.length;
    }
    expect(count).toBeGreaterThan(0);
  });

  it('no call site passes a row count -- the component has no such prop', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const matches = src.match(CALL_RE);
      if (!matches) continue;
      for (const m of matches) {
        // A bare `rows=` attribute on the JSX element itself. Deliberately
        // NOT matching `<textarea rows={n}>` -- the regex above only
        // matches `<PageSkeleton ...>` spans, so a sibling `<textarea>`
        // element's `rows` attribute is never in scope here.
        if (/\brows\s*=/.test(m)) {
          offenders.push(`${file}: ${m}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('negative control: the matcher catches a fixture `<PageSkeleton rows={4} />`', () => {
    const fixture = `
      function Example() {
        return (
          <div>
            <textarea rows={3} />
            <PageSkeleton variant="table" rows={4} />
          </div>
        );
      }
    `;
    const matches = fixture.match(CALL_RE);
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(1);
    expect(/\brows\s*=/.test(matches![0])).toBe(true);
  });
});

describe('loading-first-paint: no shimmer/pulse, flat placeholder fill', () => {
  const cssPath = join(HERE, 'page-skeleton.css');
  const css = readFileSync(cssPath, 'utf8');

  it('declares no animation/keyframes/transition on any skeleton rule', () => {
    expect(css).not.toMatch(/@keyframes/);
    expect(css).not.toMatch(/\banimation\b\s*:/);
    expect(css).not.toMatch(/\btransition\b\s*:/);
  });

  it('fills placeholder bars with the flat sunk-surface token, not a gradient', () => {
    const barRule = css.match(/\.chq-skeleton-bar\s*\{[^}]*\}/);
    expect(barRule).not.toBeNull();
    expect(barRule![0]).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(barRule![0]).not.toMatch(/gradient/);
  });
});
