// Regression lock for the P0 redirect loop: wrangler.jsonc's `assets` block
// must run the Worker first for /admin routes AND disable static
// html_handling redirects, or /admin/* requests bounce between the SPA
// shell and the asset handler's trailing-slash/extensionless redirects.
// Parses the real wrangler.jsonc (jsonc allows `//` comments, which JSON.parse
// rejects) so this fails loudly if either setting regresses.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripJsonComments(text: string): string {
  // Strips // line comments outside of string literals. Good enough for
  // wrangler.jsonc's style (no /* */ block comments, no // inside strings
  // in this file), and fails loudly (JSON.parse throws) if it mis-strips.
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

describe('wrangler.jsonc admin assets config', () => {
  const raw = readFileSync(resolve(__dirname, '../wrangler.jsonc'), 'utf-8');
  const config = JSON.parse(stripJsonComments(raw));

  it('runs the Worker first for all /admin routes', () => {
    expect(config.assets.run_worker_first).toEqual(expect.arrayContaining(['/admin', '/admin/*']));
  });

  it('disables asset-handler html_handling redirects', () => {
    expect(config.assets.html_handling).toBe('none');
  });
});
