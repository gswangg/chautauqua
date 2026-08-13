// DEC-917: one optionality grammar across every dialog and form row in the
// SPA -- required rows carry no marker, optional rows append the shared
// ' · optional' suffix, and no surface in the product marks a field with an
// asterisk (Scorecard.tsx used to print a bare ' *' on required text
// criteria). This scans every non-test source file under app/src for that
// dead literal so it can't come back.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

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

describe('DEC-917: no required-marker asterisk literal survives in app/src', () => {
  it('no source file (outside tests) renders a bare " *" required marker', () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      const source = readFileSync(file, 'utf8');
      if (source.includes("' *'") || source.includes('" *"')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
