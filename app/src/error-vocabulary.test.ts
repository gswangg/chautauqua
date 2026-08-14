// DEC-124/DEC-958: the admin-SPA error vocabulary is ONE module --
// app/src/components/error-states.css. This scan, modelled on
// app/src/dialog-field-vocabulary.test.ts, asserts (i) the four core
// tokens are declared there and NOWHERE else under app/src/**/*.css, and
// (ii) the module itself carries no colour literal (tokens only).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src
const ERROR_STATES_PATH = join(APP_SRC, 'components', 'error-states.css');

function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CSS_FILES = allCssFiles(APP_SRC);
const ERROR_STATES_CSS = readFileSync(ERROR_STATES_PATH, 'utf-8');

const VOCAB_TOKENS = ['chq-field-invalid', 'chq-error-summary', 'chq-field-error', 'chq-form-row-error'];

/** Strips /* ... *\/ block comments so a decision note quoting a class
 * name (e.g. ".chq-field-error is owned by...") is never mistaken for a
 * real declaration site. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function declaresSelector(css: string, token: string): boolean {
  // A declaration site: the token appears as a class selector (`.token`),
  // bounded so `chq-error-summary` doesn't also match
  // `chq-error-summary-link`, followed (ignoring whitespace/commas) by a
  // `{` or another selector -- i.e. it is actually the target of a rule,
  // not prose.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(stripComments(css));
}

describe('DEC-124/DEC-958: the admin-SPA error vocabulary lives in ONE module', () => {
  it('found more than one CSS file to scan', () => {
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it('each vocabulary token is declared in error-states.css', () => {
    for (const token of VOCAB_TOKENS) {
      expect(declaresSelector(ERROR_STATES_CSS, token), `expected .${token} declared in error-states.css`).toBe(
        true,
      );
    }
  });

  it('each vocabulary token is declared in NO other app/src/**/*.css file', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      if (path === ERROR_STATES_PATH) continue;
      const css = readFileSync(path, 'utf-8');
      const label = relative(APP_SRC, path);
      for (const token of VOCAB_TOKENS) {
        if (declaresSelector(css, token)) offenders.push(`${label}: .${token}`);
      }
    }
    expect(offenders, `vocabulary token re-declared outside error-states.css:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('error-states.css contains no colour literal', () => {
    expect(ERROR_STATES_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(ERROR_STATES_CSS).not.toMatch(/rgb\(/i);
  });
});
