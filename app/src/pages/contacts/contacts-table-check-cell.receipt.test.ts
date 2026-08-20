// DEC-393 w13-l (round-2 probe WAVE B: `.chq-check` 18px). The
// tap-floor-exempt reason above `input[type='checkbox'], input[type='radio'],
// .chq-check` in app/src/styles.css claims "the phone tap floor is met by
// padding on the label around it" -- a fact about markup. This is the
// DEC-991-shaped receipt that makes the claim falsifiable: a named
// component path (this file) plus a class literal (`chq-check-cell`) the
// scan re-greps, asserting every bare `<input className="chq-check">`
// inside a table cell is wrapped in a `<label className="chq-check-cell">`
// so the reason stays true rather than prose. Sibling receipt for
// SubmissionsTable lives in ../submissions/submissions-table-check-cell.
// receipt.test.ts (same shape, same rationale).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393 } from '../../../../src/decisions';

void DEC_393; // the exemption-reason-takes-a-receipt ruling this test backs

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'ContactsTable.tsx'), 'utf-8');

/** Every `<input ... className="chq-check" ... />` occurrence, with the
 * 200 characters immediately preceding it, so we can check the nearest
 * unclosed JSX ancestor tag is the `chq-check-cell` label wrapper. */
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

describe('ContactsTable.tsx: every bare .chq-check input is label-wrapped in chq-check-cell', () => {
  const prefixes = checkInputPrefixes(SOURCE);

  it('the source actually contains chq-check inputs to check (a population, not an empty match)', () => {
    expect(prefixes.length).toBeGreaterThanOrEqual(2); // select-all + row checkbox
  });

  it('every chq-check input is immediately preceded by an open <label className="chq-check-cell"> with no other input in between', () => {
    for (const prefix of prefixes) {
      // The nearest preceding `<label className="chq-check-cell">` in the
      // 200-char window, with no `</label>` closing it before we reach the
      // input -- i.e. the input is still INSIDE that label.
      const wrapOpenIdx = prefix.lastIndexOf('<label className="chq-check-cell">');
      expect(wrapOpenIdx, `no chq-check-cell label wrapper found before: …${prefix.slice(-80)}`).toBeGreaterThanOrEqual(0);
      const afterWrap = prefix.slice(wrapOpenIdx);
      expect(afterWrap, `a </label> closed before reaching the input: …${prefix.slice(-80)}`).not.toMatch(/<\/label>/);
    }
  });
});
