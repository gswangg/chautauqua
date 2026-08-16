// DEC-941 (wave 68 amendment): every destructive ConfirmDialog's PRIMARY
// (confirmLabel) names the object it destroys instead of a bare verb --
// 'Delete segment', 'Remove reviewer', not a lone 'Delete'/'Remove'. This
// scans every non-test source file under app/src for a literal
// `confirmLabel="..."` and fails, naming file:line, if the label is a bare
// member of the disallowed-verb set. Modelled on delete-confirm.scan.test.ts:
// same walk, same file-filtering idiom, same "record what the scan can't
// see" discipline for computed labels.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

// FieldModal/FormsPage delete affordance is owned by unmerged branch
// task-w66-i at wave 68 -- re-check when it lands.
const EXEMPT_DIRS = ['pages/forms/'];

// Matches a LITERAL confirmLabel string prop: `confirmLabel="..."`. A
// computed label (`confirmLabel={...}`) does not match this regex -- it is
// recorded separately, never silently skipped.
const CONFIRM_LABEL_LITERAL = /confirmLabel="([^"]*)"/g;
const CONFIRM_LABEL_COMPUTED = /confirmLabel=\{([^}]*)\}/g;

const BARE_VERBS = new Set(['Delete', 'Remove', 'Confirm', 'OK', 'Yes', 'Save', 'Continue']);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if (name.endsWith('.tsx') && !name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

function findLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

describe('DEC-941 (wave 68): every ConfirmDialog primary names its object, not a bare verb', () => {
  it('no literal confirmLabel is a bare member of the disallowed-verb set, outside the exempt dirs', () => {
    const offenders: string[] = [];
    const skipped: string[] = [];

    for (const file of walkSourceFiles(APP_SRC)) {
      const relPath = relative(APP_SRC, file);
      const exempt = EXEMPT_DIRS.some((dir) => relPath.startsWith(dir));
      const source = readFileSync(file, 'utf8');

      CONFIRM_LABEL_LITERAL.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = CONFIRM_LABEL_LITERAL.exec(source))) {
        const label = m[1] as string;
        if (exempt) continue;
        if (BARE_VERBS.has(label)) {
          offenders.push(`${relPath}:${findLineNumber(source, m.index)}`);
        }
      }

      // A computed confirmLabel can't be checked by this scan -- it is
      // RECORDED (never silently passed) with its exact source expression,
      // exactly as delete-confirm.scan.test.ts records what it cannot see.
      CONFIRM_LABEL_COMPUTED.lastIndex = 0;
      while ((m = CONFIRM_LABEL_COMPUTED.exec(source))) {
        skipped.push(`${relPath}:${findLineNumber(source, m.index)}:${(m[1] as string).trim()}`);
      }
    }

    expect(offenders).toEqual([]);
    // The one computed confirmLabel this scan knows about (TracksRoomsPanel
    // serves both a track and a room from one dialog) must still be
    // recorded, not silently skipped.
    expect(skipped).toContain(
      "pages/settings/TracksRoomsPanel.tsx:809:pendingDelete.kind === 'track' ? 'Remove track' : 'Remove room'",
    );
  });

  it('the exempt-dir list only names the forms directory, with its reason on record', () => {
    expect(EXEMPT_DIRS).toEqual(['pages/forms/']);
  });

  // Negative control: proves the regex and bare-verb set actually catch a
  // synthetic offender.
  it('flags a synthetic bare confirmLabel (negative control)', () => {
    const fixture = `<ConfirmDialog title="Delete this thing?" confirmLabel="Delete" onConfirm={x} onCancel={y} />`;
    CONFIRM_LABEL_LITERAL.lastIndex = 0;
    const m = CONFIRM_LABEL_LITERAL.exec(fixture);
    expect(m).not.toBeNull();
    expect(BARE_VERBS.has((m as RegExpExecArray)[1] as string)).toBe(true);
  });

  // Positive control: a compliant two-to-four-word label is never flagged.
  it('does not flag a compliant verb+object confirmLabel (positive control)', () => {
    const fixture = `<ConfirmDialog title="Delete this segment?" confirmLabel="Delete segment" onConfirm={x} onCancel={y} />`;
    CONFIRM_LABEL_LITERAL.lastIndex = 0;
    const m = CONFIRM_LABEL_LITERAL.exec(fixture);
    expect(m).not.toBeNull();
    expect(BARE_VERBS.has((m as RegExpExecArray)[1] as string)).toBe(false);
  });
});
