// DEC-183: DEV_MODE must never be set in the deployable wrangler.jsonc
// (production must never mount /dev/mailbox); it must instead live in
// .dev.vars, which `wrangler dev` auto-loads locally and which is
// committed so the repo stays zero-setup.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripJsonComments(text: string): string {
  // Strips // line comments outside of string literals. Mirrors the
  // stripper in test/admin-assets-config.test.ts.
  let result = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      result += ch;
      if (ch === '\\') {
        result += next;
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    result += ch;
  }
  return result;
}

describe('wrangler.jsonc DEV_MODE safety (DEC-183)', () => {
  it('does not set DEV_MODE in the deployable config', () => {
    const raw = readFileSync(resolve(__dirname, '../wrangler.jsonc'), 'utf-8');
    const config = JSON.parse(stripJsonComments(raw));
    if (config.vars !== undefined) {
      expect(config.vars.DEV_MODE).toBeUndefined();
    }
  });
});

describe('.dev.vars (DEC-183)', () => {
  it('sets DEV_MODE=1 for local wrangler dev', () => {
    const raw = readFileSync(resolve(__dirname, '../.dev.vars'), 'utf-8');
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    expect(lines).toContain('DEV_MODE=1');
  });
});
