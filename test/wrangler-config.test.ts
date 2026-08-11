// DEC-183: DEV_MODE must never be set in the deployable wrangler.jsonc
// (production must never mount /dev/mailbox); it must instead live in
// .dev.vars, which `wrangler dev` auto-loads locally and which is
// committed so the repo stays zero-setup.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { ensureDevVars } from '../scripts/ensure-dev-vars';

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

// DEC-187
describe('.dev.vars (DEC-183)', () => {
  it('sets DEV_MODE=1 for local wrangler dev', () => {
    const raw = readFileSync(resolve(__dirname, '../.dev.vars.example'), 'utf-8');
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    expect(lines).toContain('DEV_MODE=1');
  });
});

// DEC-187
describe('.gitignore excludes .dev.vars', () => {
  it('contains a literal .dev.vars line', () => {
    const raw = readFileSync(resolve(__dirname, '../.gitignore'), 'utf-8');
    const lines = raw.split('\n').map((l) => l.trim());
    expect(lines).toContain('.dev.vars');
  });
});

// DEC-187
describe('ensureDevVars', () => {
  function mkTmpRoot(): string {
    return mkdtempSync(join(tmpdir(), 'ensure-dev-vars-'));
  }

  it('creates .dev.vars from .dev.vars.example when absent', () => {
    const root = mkTmpRoot();
    try {
      writeFileSync(join(root, '.dev.vars.example'), 'DEV_MODE=1\n');
      const result = ensureDevVars(root);
      expect(result).toBe('created');
      expect(existsSync(join(root, '.dev.vars'))).toBe(true);
      expect(readFileSync(join(root, '.dev.vars'), 'utf-8')).toBe('DEV_MODE=1\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves an existing .dev.vars untouched and returns "exists"', () => {
    const root = mkTmpRoot();
    try {
      writeFileSync(join(root, '.dev.vars.example'), 'DEV_MODE=1\n');
      const existingContents = 'DEV_MODE=1\nSECRET=do-not-touch\n';
      writeFileSync(join(root, '.dev.vars'), existingContents);
      const result = ensureDevVars(root);
      expect(result).toBe('exists');
      expect(readFileSync(join(root, '.dev.vars'), 'utf-8')).toBe(existingContents);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when .dev.vars.example is missing', () => {
    const root = mkTmpRoot();
    try {
      expect(() => ensureDevVars(root)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
