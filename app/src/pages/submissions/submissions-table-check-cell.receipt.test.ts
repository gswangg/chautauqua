// DEC-393 w13-l (round-2 probe WAVE B: `.chq-check` 18px). Sibling receipt
// for ../contacts/contacts-table-check-cell.receipt.test.ts -- same DEC-991
// shape (named component path + class literal the scan re-greps), same
// SubmissionsTable population the ruling names alongside ContactsTable.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393 } from '../../../../src/decisions';

void DEC_393; // the exemption-reason-takes-a-receipt ruling this test backs

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'SubmissionsTable.tsx'), 'utf-8');

function checkInputPrefixes(source: string): string[] {
  const out: string[] = [];
  const needle = 'className="chq-check"';
  let from = 0;
  while (true) {
    const at = source.indexOf(needle, from);
    if (at === -1) break;
    out.push(source.slice(Math.max(0, at - 200), at));
    from = at + needle.length;
  }
  return out;
}

describe('SubmissionsTable.tsx: every bare .chq-check input is label-wrapped in chq-check-cell', () => {
  const prefixes = checkInputPrefixes(SOURCE);

  it('the source actually contains chq-check inputs to check (a population, not an empty match)', () => {
    expect(prefixes.length).toBeGreaterThanOrEqual(2); // select-all + row checkbox
  });

  it('every chq-check input is immediately preceded by an open <label className="chq-check-cell"> with no other input in between', () => {
    for (const prefix of prefixes) {
      const wrapOpenIdx = prefix.lastIndexOf('<label className="chq-check-cell">');
      expect(wrapOpenIdx, `no chq-check-cell label wrapper found before: …${prefix.slice(-80)}`).toBeGreaterThanOrEqual(0);
      const afterWrap = prefix.slice(wrapOpenIdx);
      expect(afterWrap, `a </label> closed before reaching the input: …${prefix.slice(-80)}`).not.toMatch(/<\/label>/);
    }
  });
});
