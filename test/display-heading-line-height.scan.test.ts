// DEC-991 wave-27 amendment: LINE-HEIGHT 1 ON A DISPLAY FACE IS A CLIP.
// docs/verification-log.md:3569's task-w25-a truthful-probe sweep named the
// last surviving genuine clip offender
// (.chq-forms-header-titles h1, app/src/pages/forms/forms.css) plus two
// latent siblings sharing the same shape
// (.chq-comms-send-report-headline, app/src/pages/comms/comms.css and
// .chq-auth-wordmark, src/routes/auth.css.ts). All three declared the
// display face (var(--chq-font-display) or the literal 'Familjen Grotesk')
// together with a bare `line-height: 1`, which -- unlike the font's own
// `normal` line box -- is not guaranteed to contain the glyphs at any given
// size/weight. Per DEC-991's wave-27 amendment, the fix is to delete the
// declaration entirely (never substitute a tighter-but-legal number like
// 1.08, which the clip probe's own 2px tolerance cannot prove clear). This
// scan walks every stylesheet (CSS files and *.css.ts template literals,
// DEC-808: directory walk, never a hand-listed manifest) so the class of
// bug can't regress or reappear on a fourth selector unnoticed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

/** Directory walk (DEC-808) collecting every app/src/**\/*.css,
 * src/**\/*.css.ts, and src/views/theme.ts file. */
function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.css') || entry.endsWith('.css.ts')) {
      out.push(full);
    }
  }
}

function collectStylesheets(): string[] {
  const files: string[] = [];
  walk(join(REPO_ROOT, 'app', 'src'), files);
  walk(join(REPO_ROOT, 'src'), files);
  const themeTs = join(REPO_ROOT, 'src', 'views', 'theme.ts');
  if (!files.includes(themeTs)) files.push(themeTs);
  return files;
}

/** Parse `{selector, body}` rules out of a CSS(-ish) source string. Handles
 * both one-rule-per-line and multi-line rule bodies -- same shape as
 * test/contrast-tokens.test.ts's parseRules. */
function parseRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1]!.trim();
    if (selector.startsWith('@') || selector === '') continue;
    rules.push({ selector, body: m[2]! });
  }
  return rules;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

const DISPLAY_FACE_RE = /var\(--chq-font-display\)|'Familjen Grotesk'/;
const LINE_HEIGHT_RE = /(?:^|;)\s*line-height\s*:\s*([0-9.]+)\s*;/;

interface Offender {
  file: string;
  selector: string;
  lineHeight: number;
}

interface ScannedRule {
  file: string;
  selector: string;
}

function scan(): { offenders: Offender[]; scannedRules: ScannedRule[] } {
  const offenders: Offender[] = [];
  const scannedRules: ScannedRule[] = [];
  for (const file of collectStylesheets()) {
    const raw = readFileSync(file, 'utf-8');
    const src = stripComments(raw);
    const rel = relative(REPO_ROOT, file);
    for (const { selector, body } of parseRules(src)) {
      if (!DISPLAY_FACE_RE.test(body)) continue;
      scannedRules.push({ file: rel, selector });
      const lhMatch = body.match(LINE_HEIGHT_RE);
      if (!lhMatch) continue;
      const value = parseFloat(lhMatch[1]!);
      if (value <= 1.0) {
        offenders.push({ file: rel, selector, lineHeight: value });
      }
    }
  }
  return { offenders, scannedRules };
}

describe('display-face headings never declare line-height <= 1 (DEC-991 wave-27 amendment)', () => {
  it('scans a non-trivial rule population (tripwire: a dead regex must fail loudly, not go quiet)', () => {
    const { scannedRules } = scan();
    expect(scannedRules.length).toBeGreaterThanOrEqual(10);
  });

  it('no display-face rule declares line-height <= 1', () => {
    const { offenders } = scan();
    const report = offenders.map((o) => `${o.file}:${o.selector}: line-height ${o.lineHeight}`);
    expect(report, report.join('\n')).toEqual([]);
  });

  it('negative control: a synthetic display-face rule with line-height: 1 IS flagged', () => {
    const synthetic = `.chq-synthetic-offender { font-family: var(--chq-font-display); line-height: 1; }`;
    const rules = parseRules(synthetic);
    const hit = rules.find((r) => DISPLAY_FACE_RE.test(r.body));
    expect(hit).toBeDefined();
    const lhMatch = hit!.body.match(LINE_HEIGHT_RE);
    expect(lhMatch).toBeDefined();
    expect(parseFloat(lhMatch![1]!)).toBeLessThanOrEqual(1.0);
  });

  it('does not flag UI-font rules at line-height 1 (.chq-nav, theme.ts nav mirror, carets) -- they never declare the display face', () => {
    const stylesCss = stripComments(readFileSync(join(REPO_ROOT, 'app', 'src', 'styles.css'), 'utf-8'));
    const navRule = parseRules(stylesCss).find((r) => r.selector === '.chq-nav');
    expect(navRule).toBeDefined();
    expect(navRule!.body).toMatch(LINE_HEIGHT_RE);
    expect(DISPLAY_FACE_RE.test(navRule!.body)).toBe(false);

    const themeTs = stripComments(readFileSync(join(REPO_ROOT, 'src', 'views', 'theme.ts'), 'utf-8'));
    const themeNavRule = parseRules(themeTs).find((r) => r.selector === '.chq-nav');
    expect(themeNavRule).toBeDefined();
    expect(themeNavRule!.body).toMatch(LINE_HEIGHT_RE);
    expect(DISPLAY_FACE_RE.test(themeNavRule!.body)).toBe(false);
  });

  it('does not flag cfp.css.ts (lh 1.08) or the vendored Overview-headline exception (lh 1.04)', () => {
    const { offenders } = scan();
    expect(offenders.find((o) => o.file.includes('cfp.css.ts'))).toBeUndefined();
    expect(offenders.find((o) => o.lineHeight === 1.04)).toBeUndefined();
  });
});
