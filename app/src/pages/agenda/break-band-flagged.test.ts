// DEC-021 amendment (wave 66): `.chq-agenda-break-band-flagged` used to set
// `background: #efebdf` and (for its label) `color: #565a4b` -- both
// byte-identical to what the base `.chq-agenda-break-band` already computes
// from `--chq-surface-sunk` / `--chq-muted` (see app/src/styles.css), so the
// "flagged" modifier changed zero pixels: a no-op with a name (same family
// as DEC-941's dead confirm dialog and DEC-851's unread motion token). This
// asserts the REPLACEMENT differential (a dashed border, from the B8
// provisional vocabulary already used at `.chq-day-grid-origin-well`) is a
// real, resolved-value difference from the base rule -- not merely that the
// modifier class exists in the stylesheet, which a naive scan would pass
// forever even while doing nothing.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENDA_CSS = readFileSync(join(HERE, 'agenda.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const SHELL_CSS = readFileSync(join(HERE, '..', '..', 'styles.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Extract the body of a single top-level rule by exact selector match
 * (mirrors agenda-overlay-zindex.test.ts / agenda-armed-contrast.test.ts). */
function ruleBody(css: string, selector: string): string {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    if (m[1]!.trim() === selector) return m[2]!;
  }
  throw new Error(`selector not found: ${selector}`);
}

function declValue(body: string, prop: string): string | undefined {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`);
  const m = body.match(re);
  return m ? m[1]!.trim() : undefined;
}

/** Resolves a single `var(--token)` reference against the shell's `:root`
 * block -- the two tokens this rule cares about (--chq-surface-sunk,
 * --chq-rule) are both plain colour literals there, so a one-level lookup
 * is sufficient (no nested var() chains to walk). */
function resolveVar(value: string): string {
  const m = /^var\((--[a-z0-9-]+)\)$/.exec(value);
  if (!m) return value;
  const rootBody = ruleBody(SHELL_CSS, ':root');
  const resolved = declValue(rootBody, m[1]!);
  if (!resolved) throw new Error(`token ${m[1]} not found in :root`);
  return resolved;
}

describe('DEC-021 amendment (wave 66): the flagged break band differs from the base band', () => {
  const baseBody = ruleBody(AGENDA_CSS, '.chq-agenda-break-band');
  const flaggedBody = ruleBody(AGENDA_CSS, '.chq-agenda-break-band-flagged');

  it('declares at least one property whose resolved value differs from the base rule for the same property', () => {
    // Every declaration on the flagged rule.
    const declRe = /([a-z-]+)\s*:\s*([^;]+);/g;
    const flaggedDecls: Array<[string, string]> = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(flaggedBody)) !== null) {
      flaggedDecls.push([m[1]!, m[2]!.trim()]);
    }
    expect(flaggedDecls.length).toBeGreaterThan(0);

    const differing = flaggedDecls.filter(([prop, value]) => {
      const baseValue = declValue(baseBody, prop);
      // A property the base rule never sets at all is trivially a real
      // difference (nothing to restate).
      if (baseValue === undefined) return true;
      return resolveVar(value) !== resolveVar(baseValue);
    });

    expect(differing.length).toBeGreaterThan(0);
  });

  // Negative control: prove the assertion above is capable of failing. A
  // modifier that merely restates its base's resolved value (the exact
  // defect this amendment closes) must NOT pass the "differs" check.
  it('negative control: a rule that restates the base resolved value does not count as differing', () => {
    const restated: Array<[string, string]> = [['background', 'var(--chq-surface-sunk)']];
    const differing = restated.filter(([prop, value]) => {
      const baseValue = declValue(baseBody, prop);
      if (baseValue === undefined) return true;
      return resolveVar(value) !== resolveVar(baseValue);
    });
    expect(differing.length).toBe(0);
  });

  it('the old byte-identical fill/ink pair is gone: no background or label color left on the flagged rule', () => {
    expect(declValue(flaggedBody, 'background')).toBeUndefined();
    expect(() => ruleBody(AGENDA_CSS, '.chq-agenda-break-band-flagged .chq-agenda-break-band-label')).toThrow();
  });

  it('the differential is the B8 provisional dashed border, matching .chq-day-grid-origin-well\'s literal', () => {
    expect(declValue(flaggedBody, 'border-top')).toBe('1px dashed #bab6a6');
    expect(declValue(flaggedBody, 'border-bottom')).toBe('1px dashed #bab6a6');
    const wellBody = ruleBody(AGENDA_CSS, '.chq-day-grid-origin-well');
    expect(declValue(wellBody, 'border')).toContain('#bab6a6');
  });
});
