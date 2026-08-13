// DEC-950: every dialog field is a FormRow, and the rule is a SCAN -- not a
// hand-listed set of "known good" modal files, which desyncs the moment a
// new ModalFrame consumer lands. This walks every .tsx under app/src that
// imports ModalFrame (the ONE dialog frame, per ModalFrame.tsx's own DEC-651
// note) and fails any whose source contains a bare `<label` with no
// className attribute -- the tell for the pre-DEC-685 "label wraps a plain
// input" pattern NewContactModal.tsx used before this decision landed.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith('.tsx') && !full.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

// A bare `<label` tag with no `className=` attribute before its closing `>`.
// (Multi-line label tags are matched via the `s` flag across the whole
// opening-tag span up to the next `>`.)
function findUnstyledLabels(source: string): number[] {
  const lines: number[] = [];
  const tagRe = /<label\b[^>]*>/gs;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(source)) !== null) {
    const tag = match[0];
    if (!tag.includes('className')) {
      const upTo = source.slice(0, match.index);
      const line = upTo.split('\n').length;
      lines.push(line);
    }
  }
  return lines;
}

describe('every dialog field is a FormRow (DEC-950): scan of ModalFrame consumers', () => {
  const allTsx = walk(APP_SRC);
  const modalFrameConsumers = allTsx.filter((file) => {
    const source = readFileSync(file, 'utf-8');
    return /from\s+['"][^'"]*\/ModalFrame['"]/.test(source) && !file.endsWith('/ModalFrame.tsx');
  });

  // Sanity: the enumeration itself must find consumers, or this test would
  // pass vacuously.
  it('finds at least one ModalFrame consumer to scan', () => {
    expect(modalFrameConsumers.length).toBeGreaterThan(0);
  });

  for (const file of modalFrameConsumers) {
    const rel = relative(APP_SRC, file);
    it(`${rel}: no bare <label> without className (DEC-685 FormRow / DEC-950)`, () => {
      const source = readFileSync(file, 'utf-8');
      const offenders = findUnstyledLabels(source);
      expect(offenders, `${rel} has <label> tag(s) with no className at line(s) ${offenders.join(', ')} -- every dialog field must be a FormRow (DEC-950)`).toEqual([]);
    });
  }
});
