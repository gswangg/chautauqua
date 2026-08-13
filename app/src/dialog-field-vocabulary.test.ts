// DEC-958: every dialog built on ModalFrame (app/src/components/ModalFrame)
// must lay its fields out with FormRow, not the pre-DEC-685 .chq-field
// label. This scans every module under app/src that imports ModalFrame and
// fails any whose source still carries a bare `chq-field` class token.
//
// Token-exact per DEC-958's note: `chq-field-error` (used by an in-flight
// sibling branch, w26/DEC-950) must NOT trip this -- the pattern requires
// a word boundary around `chq-field` so a longer class name sharing the
// prefix survives.
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

const IMPORTS_MODAL_FRAME = /from\s+['"](\.\.\/){1,2}components\/ModalFrame['"]/;
// Token-exact: `chq-field` inside a class/className string literal, bounded
// on both sides by neither a word character nor a hyphen (plain `\b` is
// insufficient -- `-` is a non-word character, so `\bchq-field\b` would
// still match inside `chq-field-error`). This keeps `chq-field-error` clean
// while still catching `chq-field` alone or alongside sibling classes.
const CHQ_FIELD_TOKEN = /class(Name)?="[^"]*(?<![\w-])chq-field(?![\w-])[^"]*"/;

describe('DEC-958: no ModalFrame-based dialog carries the retired .chq-field class', () => {
  it('every module importing ModalFrame is free of the chq-field class token', () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!IMPORTS_MODAL_FRAME.test(source)) continue;
      if (CHQ_FIELD_TOKEN.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('the token-exact pattern does not flag chq-field-error', () => {
    expect(CHQ_FIELD_TOKEN.test('<span className="chq-field-error">x</span>')).toBe(false);
    expect(CHQ_FIELD_TOKEN.test('<label className="chq-field">x</label>')).toBe(true);
    expect(CHQ_FIELD_TOKEN.test('<label className="chq-field chq-forms-rule-options">x</label>')).toBe(true);
  });
});
