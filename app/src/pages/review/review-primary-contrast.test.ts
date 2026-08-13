// DEC-939 amendment: the queue's ONLY route into a scorecard,
// `.chq-review-queue-score-action.chq-btn.chq-btn-primary` at
// ReviewerQueue.tsx:151, painted rgb(27,29,23) on olive rgb(78,92,49) --
// 2.40:1 -- because review.css restated `color: var(--chq-accent,
// var(--chq-ink))` on an element that already carries the .chq-btn-primary
// button face, and the undeclared --chq-accent token's ink fallback won the
// cascade over .chq-btn-primary's cream. This test parses the actual token
// values from styles.css and the actual rule bodies from review.css/
// styles.css (never hand-copied hex literals), computes real WCAG
// relative-luminance contrast ratios, and adds an enumerating guard so no
// future review.css rule can repeat the same "restate colour on a button
// face" defect for any class that shares an element with .chq-btn-primary
// or .chq-btn-secondary anywhere in the app.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..', '..');
const REVIEW_CSS = readFileSync(join(HERE, 'review.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const STYLES_CSS = readFileSync(join(APP_SRC, 'styles.css'), 'utf-8');
const STYLES_CSS_NO_COMMENTS = STYLES_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Parse every `--chq-*: #rrggbb;` custom property out of the :root block in
 * styles.css into a name -> hex map. */
function parseTokens(css: string): Record<string, string> {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) throw new Error('no :root block found in styles.css');
  const body = rootMatch[1]!;
  const tokens: Record<string, string> = {};
  const tokenRe = /(--chq-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body)) !== null) {
    tokens[m[1]!] = m[2]!.toLowerCase();
  }
  return tokens;
}

const TOKENS = parseTokens(STYLES_CSS);

function resolveVar(value: string): string {
  const m = value.match(/var\((--chq-[a-z0-9-]+)\)/);
  if (!m) throw new Error(`expected a var(--chq-*) reference, got: ${value}`);
  const token = TOKENS[m[1]!];
  if (!token) throw new Error(`token ${m[1]} not found in styles.css :root`);
  return token;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Extract every top-level rule (selector -> body) from a stylesheet with
 * comments already stripped. Ignores at-rules like @media by only matching
 * blocks whose "selector" doesn't start with '@' (nested blocks inside a
 * @media still match individually since the regex is non-greedy over a
 * brace-balanced-enough surface for this file's flat rule shapes). */
function parseRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1]!.trim();
    if (selector.startsWith('@')) continue;
    rules.push({ selector, body: m[2]! });
  }
  return rules;
}

function ruleBody(css: string, selector: string): string {
  const rules = parseRules(css);
  const hit = rules.find((r) => r.selector === selector);
  if (!hit) throw new Error(`selector not found: ${selector}`);
  return hit.body;
}

function declValue(body: string, prop: string): string {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`);
  const m = body.match(re);
  if (!m) throw new Error(`declaration ${prop} not found in rule body: ${body}`);
  return m[1]!.trim();
}

function hasDecl(body: string, prop: string): boolean {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:`);
  return re.test(body);
}

/** Recursively list every *.tsx file under a directory. */
function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsxFiles(full));
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Extract the set of class names that appear in the same `className="..."`
 * / `className={`...`}` value as `chq-btn-primary` or `chq-btn-secondary`,
 * across every .tsx file under app/src -- i.e. every class that shares an
 * element with a button-face class somewhere in the app. Dynamic
 * `${expr}` segments inside template literals are stripped before
 * tokenising so only literal class names are counted. */
function classesCoOccurringWithButtonFace(): Set<string> {
  const coOccurring = new Set<string>();
  const classNameValueRe = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g;
  for (const file of listTsxFiles(APP_SRC)) {
    const src = readFileSync(file, 'utf-8');
    let m: RegExpExecArray | null;
    while ((m = classNameValueRe.exec(src)) !== null) {
      const raw = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      const tokens = raw.split(/\s+/).filter(Boolean);
      if (tokens.includes('chq-btn-primary') || tokens.includes('chq-btn-secondary')) {
        for (const t of tokens) coOccurring.add(t);
      }
    }
  }
  return coOccurring;
}

const BUTTON_FACE_COMPANIONS = classesCoOccurringWithButtonFace();

/** Every class token named by a selector (handles compound selectors like
 * `.chq-btn.chq-review-queue-score-action` and comma-separated groups). */
function selectorClassTokens(selector: string): string[] {
  return selector
    .split(',')
    .flatMap((part) => part.match(/\.[a-zA-Z0-9-]+/g) ?? [])
    .map((t) => t.slice(1));
}

describe('review primary-action contrast (DEC-939 amendment)', () => {
  it('found at least one button-face companion class to guard (sanity check on the scan itself)', () => {
    expect(BUTTON_FACE_COMPANIONS.has('chq-review-queue-score-action')).toBe(true);
  });

  it('.chq-review-queue-score-action declares no color (DEC-939: never restate colour on a button face)', () => {
    const body = ruleBody(REVIEW_CSS, '.chq-review-queue-score-action');
    expect(hasDecl(body, 'color')).toBe(false);
  });

  it('.chq-btn-primary\'s own colour pair clears 4.5:1 AA for body text', () => {
    const body = ruleBody(STYLES_CSS_NO_COMMENTS, '.chq-btn-primary');
    const fill = resolveVar(declValue(body, 'background'));
    const text = resolveVar(declValue(body, 'color'));
    const ratio = contrastRatio(fill, text);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('no top-level review.css rule for a class sharing an element with .chq-btn-primary/.chq-btn-secondary declares color or background', () => {
    const offenders: string[] = [];
    for (const { selector, body } of parseRules(REVIEW_CSS)) {
      const classTokens = selectorClassTokens(selector);
      const namesCompanion = classTokens.some((c) => BUTTON_FACE_COMPANIONS.has(c));
      if (!namesCompanion) continue;
      if (hasDecl(body, 'color') || hasDecl(body, 'background')) {
        offenders.push(selector);
      }
    }
    expect(offenders).toEqual([]);
  });
});
