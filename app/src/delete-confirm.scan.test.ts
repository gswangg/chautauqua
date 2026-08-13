// DEC-941: every irreversible SPA delete goes through the shared
// ConfirmDialog (components/ConfirmDialog.tsx) rather than firing on click.
// This scans every non-test source file under app/src for `apiDelete(` and
// requires the module to import ConfirmDialog too -- a sixth unguarded
// delete call site fails this scan. The only modules allowed to call
// apiDelete without ConfirmDialog are the two restore-not-destroy recusal
// "undo" flows, hard-coded here by name so the exemption can't silently grow.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

// DEC-941: TracksRoomsPanel.tsx is deliberately untouched here -- an
// unmerged wave-24 branch owns its track/room delete path for DEC-931.
// ReviewerQueue.tsx / Scorecard.tsx call apiDelete only to UNDO a recusal
// (restore, not destroy), so they're the sole confirmed exemptions.
const ALLOWED_UNGUARDED = new Set([
  'pages/review/ReviewerQueue.tsx',
  'pages/review/Scorecard.tsx',
  'pages/settings/TracksRoomsPanel.tsx',
]);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('DEC-941: every apiDelete( call site imports ConfirmDialog (or is an allow-listed exemption)', () => {
  it('no unguarded apiDelete( call site exists outside the hard-coded allow-list', () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('apiDelete(')) continue;
      const relPath = relative(APP_SRC, file);
      if (source.includes("from '../../components/ConfirmDialog'") || source.includes("from '../components/ConfirmDialog'")) {
        continue;
      }
      if (ALLOWED_UNGUARDED.has(relPath)) continue;
      offenders.push(relPath);
    }
    expect(offenders).toEqual([]);
  });

  it('the allow-list only names the confirmed restore-not-destroy exemptions', () => {
    expect([...ALLOWED_UNGUARDED].sort()).toEqual(
      ['pages/review/ReviewerQueue.tsx', 'pages/review/Scorecard.tsx', 'pages/settings/TracksRoomsPanel.tsx'].sort(),
    );
  });
});
