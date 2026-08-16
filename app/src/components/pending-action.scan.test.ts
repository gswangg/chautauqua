// DEC-733 (V11 pending grammar, wave-63 amendment,
// docs/design/DESIGN-RULINGS.md:155-161): PendingAction.tsx's
// SLOW_OPERATIONS is the declared population of the four genuinely-slow
// operations that must render through `usePendingLabel` instead of a
// hand-rolled busy label. This scan enumerates SLOW_OPERATIONS and asserts
// each operation's named module actually imports the helper -- a
// declaration with no reader is a lie (DEC-851).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLOW_OPERATIONS } from './PendingAction';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, '..', 'pages');

/** Every module that must import usePendingLabel for a given slow
 *  operation. auto-schedule has two call sites (desktop + phone). */
const OPERATION_MODULES: Record<(typeof SLOW_OPERATIONS)[number], string[]> = {
  'bulk-send': [join(PAGES, 'comms', 'ComposeWizard.tsx')],
  'csv-import': [join(PAGES, 'contacts', 'ImportWizard.tsx')],
  'file-upload': [join(PAGES, 'content', 'UploadZone.tsx')],
  'auto-schedule': [join(PAGES, 'Agenda.tsx'), join(PAGES, 'agenda', 'PhoneAgenda.tsx')],
};

const IMPORT_RE = /usePendingLabel/;

describe('pending-action scan (DEC-733): every slow operation imports usePendingLabel', () => {
  it('declares exactly the four known slow operations', () => {
    expect([...SLOW_OPERATIONS].sort()).toEqual(
      ['auto-schedule', 'bulk-send', 'csv-import', 'file-upload'].sort(),
    );
  });

  it('every SLOW_OPERATIONS entry has a module list wired into the scan', () => {
    for (const op of SLOW_OPERATIONS) {
      expect(OPERATION_MODULES[op]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  for (const op of SLOW_OPERATIONS) {
    for (const modulePath of OPERATION_MODULES[op]) {
      it(`${op}: ${modulePath.split('/pages/')[1]} imports usePendingLabel`, () => {
        const source = readFileSync(modulePath, 'utf-8');
        expect(IMPORT_RE.test(source)).toBe(true);
      });
    }
  }

  it('negative control: the matcher does NOT see a module that never imports the helper', () => {
    const nonImporting = readFileSync(join(HERE, '..', 'lib', 'plural.ts'), 'utf-8');
    expect(IMPORT_RE.test(nonImporting)).toBe(false);
  });
});
