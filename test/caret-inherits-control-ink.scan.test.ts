// DEC-830 (wave-29 amendment): the render sweep found
// `span.chq-participation-menu-caret` at 1.02:1 contrast on
// `.chq-speakers-status-complete`'s olive fill (fg rgb(86,90,75) on bg
// rgb(78,92,49)) -- the caret hard-coded `color: var(--chq-muted)` while its
// trigger repaints its own ink/background on the `complete` modifier, so the
// caret's fixed muted colour stopped tracking the label it sits beside.
// `color: inherit` (or `currentColor`) makes a `-caret` element always track
// whatever ink colour its containing control declares, by construction --
// there is no fill state a caret can silently go invisible on ever again.
//
// This is a source scan (mirroring test/contrast-tokens.test.ts's rule-body
// parsing and the field guide's "RULING WITH NO SCAN DRIFTS BACK" /
// "REF LIST IS A SNAPSHOT"): every CSS class selector ending in `-caret` is
// found MECHANICALLY across app/src/**/*.css and src/**/*.css.ts (no
// hand-written class list), and its declaration block must set
// `color: inherit` or `color: currentColor` -- or carry an inline exemption
// comment (in the same file, immediately preceding the rule) that names this
// amendment ("DEC-830" and "wave-29") and the resting background the
// hard-coded colour was measured against, so an exemption is reviewable
// rather than a silent escape hatch.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const APP_SRC = join(REPO_ROOT, 'app', 'src');
const SRC = join(REPO_ROOT, 'src');

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, suffix));
    else if (entry.endsWith(suffix)) out.push(p);
  }
  return out;
}

const CSS_FILES = [...walk(APP_SRC, '.css'), ...walk(SRC, '.css.ts')];

type CaretRule = { file: string; rel: string; className: string; line: number; body: string; precedingComment: string };

/** Mechanically enumerate every `.some-class-caret { ... }` rule across the
 * given CSS-bearing files (plain .css files and .css.ts files whose content
 * is a template-literal string of raw CSS -- the same text scan works on
 * both, since we only ever look for `.foo-caret { ... }` text). Only rules
 * whose selector is EXACTLY a single class ending in `-caret` are captured
 * (a compound/pseudo selector like `.foo-caret:hover` is intentionally out
 * of scope: the resting-state declaration is what a render sweep measures). */
function findCaretRules(): CaretRule[] {
  const rules: CaretRule[] = [];
  // Matches: optional block comment, then `.word-caret {`, capturing the body
  // up to the matching `}` (bodies here never contain nested braces).
  const ruleRe = /(\/\*[\s\S]*?\*\/\s*)?\.([\w-]*-caret)\s*\{([^}]*)\}/g;
  for (const file of CSS_FILES) {
    const raw = readFileSync(file, 'utf-8');
    const isAppSrc = file.startsWith(APP_SRC + sep);
    const rel = relative(isAppSrc ? APP_SRC : SRC, file).split(sep).join('/');
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(raw)) !== null) {
      const precedingComment = (m[1] ?? '').trim();
      const className = m[2]!;
      const body = m[3]!;
      const line = raw.slice(0, m.index).split('\n').length;
      rules.push({ file, rel, className, line, body, precedingComment });
    }
  }
  return rules;
}

const CARET_RULES = findCaretRules();

function declValue(body: string, prop: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);?`);
  const m = body.match(re);
  return m ? m[1]!.trim() : null;
}

/** An exemption comment must reference both the amendment (DEC-830 / wave-29)
 * and a resting background (a `--chq-*` custom property or literal colour it
 * was measured against) -- a bare "exempt" comment doesn't count. */
function isReasonedExemption(comment: string): boolean {
  const namesAmendment = /DEC-830/.test(comment) && /wave-29/.test(comment);
  const namesBackground = /--chq-[a-z0-9-]+|#[0-9a-fA-F]{3,6}/.test(comment);
  return namesAmendment && namesBackground;
}

describe('caret elements inherit control ink (DEC-830 wave-29 amendment)', () => {
  it('the scan actually found caret rules (regex sanity floor)', () => {
    expect(CARET_RULES.length).toBeGreaterThanOrEqual(3);
  });

  for (const rule of CARET_RULES) {
    it(`${rule.rel}:${rule.line} .${rule.className} declares color: inherit/currentColor or a reasoned DEC-830 exemption`, () => {
      const color = declValue(rule.body, 'color');
      if (color === 'inherit' || color === 'currentColor') {
        return;
      }
      expect(
        isReasonedExemption(rule.precedingComment),
        `${rule.rel}:${rule.line} .${rule.className} declares color: ${color} ` +
          '(not inherit/currentColor) and its preceding comment does not name ' +
          'both the DEC-830 wave-29 amendment and a resting background it was ' +
          'measured against. Either change the declaration to `color: inherit` ' +
          '(or `currentColor`), or add an inline exemption comment immediately ' +
          'above the rule naming DEC-830, wave-29, and the resting background.',
      ).toBe(true);
    });
  }
});
