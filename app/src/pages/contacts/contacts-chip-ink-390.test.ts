// task v12m-w16-ui-r5-b (DEC-367 amendment, wave-16 r5): the rule chip's
// rest ink was spending a hover token, making its own label's B8 hover
// state a no-op. This is a source-text scan, not a render test -- modelled
// on contacts-chip-interaction-states-390.test.ts's terminal-block parser
// idiom.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');
const STRIPPED = stripCssComments(CSS);

const STYLES_PATH = join(HERE, '../../styles.css');
const STYLES = readFileSync(STYLES_PATH, 'utf-8');

/** Byte offsets of every `@media (max-width: 700px) {` opener in the
 * (comment-stripped) source, paired with the offset of its matching closing
 * brace -- so "the terminal block's body" is a real source range rather
 * than a naive indexOf. */
function maxWidth700Blocks(css: string): Array<{ start: number; end: number; body: string }> {
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const blocks: Array<{ start: number; end: number; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ start: m.index, end: i, body: css.slice(bodyStart, i - 1) });
  }
  return blocks;
}

const BLOCKS = maxWidth700Blocks(STRIPPED);
// Raw (comment-preserving) counterpart, for scans that need to read the
// receipt comments themselves rather than just the declarations.
const RAW_BLOCKS = maxWidth700Blocks(CSS);

/** Every top-level rule in the terminal block: `{ selector, body }` pairs,
 * ignoring nested @media guards (their rules are found by a direct regex
 * per-selector where needed, as the interaction-states test already does). */
function topLevelRules(body: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  let i = 0;
  while (i < body.length) {
    const openBrace = body.indexOf('{', i);
    if (openBrace === -1) break;
    const selector = body.slice(i, openBrace).trim();
    // Skip nested @media blocks entirely (their own bodies are not
    // top-level rules of the terminal block).
    if (selector.startsWith('@media')) {
      let depth = 1;
      let j = openBrace + 1;
      while (j < body.length && depth > 0) {
        if (body[j] === '{') depth += 1;
        else if (body[j] === '}') depth -= 1;
        j += 1;
      }
      i = j;
      continue;
    }
    let depth = 1;
    let j = openBrace + 1;
    const ruleBodyStart = j;
    while (j < body.length && depth > 0) {
      if (body[j] === '{') depth += 1;
      else if (body[j] === '}') depth -= 1;
      j += 1;
    }
    rules.push({ selector, body: body.slice(ruleBodyStart, j - 1) });
    i = j;
  }
  return rules;
}

describe('contacts.css phone rule-chip rest ink (DEC-367 amendment, wave-16 r5, v12m-w16-ui-r5-b)', () => {
  it('the file has exactly one terminal @media (max-width: 700px) block', () => {
    expect(BLOCKS.length).toBe(1);
  });

  const TERMINAL = () => BLOCKS[0]!.body;
  const RULES = () => topLevelRules(TERMINAL());

  it('no rest-ink rule in the chq-contacts-filter- / chq-contacts-segment-pills families spends a hover or active token as its color', () => {
    const offenders: string[] = [];
    for (const rule of RULES()) {
      const isTargetFamily =
        rule.selector.includes('chq-contacts-filter-') ||
        rule.selector.includes('chq-contacts-segment-pills');
      if (!isTargetFamily) continue;
      const hasStatePseudo = /:hover|:active|:focus/.test(rule.selector);
      if (hasStatePseudo) continue;
      const colorMatch = rule.body.match(/color:\s*([^;]+);/);
      if (!colorMatch) continue;
      const value = colorMatch[1]!.trim();
      if (value === 'var(--chq-brand-hover)' || value === 'var(--chq-brand-active)') {
        offenders.push(`${rule.selector} -> ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('.chq-contacts-filter-rule-chip rest colour, its label hover colour and its label active colour are three distinct tokens', () => {
    const restMatch = TERMINAL().match(
      /\.chq-contacts-filter-rule-chip\s*\{[^}]*color:\s*(var\(--[a-z0-9-]+\));[^}]*\}/,
    );
    expect(restMatch).not.toBeNull();
    const rest = restMatch![1]!;

    const hoverMatch = TERMINAL().match(
      /@media \(hover: hover\)\s*\{\s*\.chq-contacts-filter-rule-chip-edit:hover\s*\{([^}]*)\}\s*\}/,
    );
    expect(hoverMatch).not.toBeNull();
    const hoverColorMatch = hoverMatch![1]!.match(/color:\s*(var\(--[a-z0-9-]+\));/);
    expect(hoverColorMatch).not.toBeNull();
    const hover = hoverColorMatch![1]!;

    const activeMatch = TERMINAL().match(
      /\.chq-contacts-filter-rule-chip-edit:active\s*\{([^}]*)\}/,
    );
    expect(activeMatch).not.toBeNull();
    const activeColorMatch = activeMatch![1]!.match(/color:\s*(var\(--[a-z0-9-]+\));/);
    expect(activeColorMatch).not.toBeNull();
    const active = activeColorMatch![1]!;

    expect(rest).toBe('var(--chq-brand)');
    expect(hover).toBe('var(--chq-brand-hover)');
    expect(active).toBe('var(--chq-brand-active)');
    const set = new Set([rest, hover, active]);
    expect(set.size).toBe(3);
  });

  it('every "#RRGGBB -> --chq-token ... exactly" receipt claim in the terminal block is byte-equal (case-insensitive)', () => {
    const rootMatch = STYLES.match(/:root\s*\{([^}]*)\}/);
    expect(rootMatch).not.toBeNull();
    const rootBody = rootMatch![1]!;
    const tokenValues = new Map<string, string>();
    const tokenDeclRe = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenDeclRe.exec(rootBody)) !== null) {
      tokenValues.set(tokenMatch[1]!, tokenMatch[2]!.toLowerCase());
    }

    // Scan the RAW (comment-preserving) terminal block's own comment text
    // for "#RRGGBB -> --chq-token ... exactly" claims -- scoped to the
    // terminal block, not the whole file.
    expect(RAW_BLOCKS.length).toBe(1);
    const commentRe = /\/\*[\s\S]*?\*\//g;
    const commentsInFile = RAW_BLOCKS[0]!.body.match(commentRe) ?? [];
    const receiptRe = /#([0-9a-fA-F]{6})\s*->\s*--([a-z0-9-]+)(?:\s+(?:exactly|is)\b)?/g;
    let foundAnyExactly = false;
    for (const comment of commentsInFile) {
      let m: RegExpExecArray | null;
      while ((m = receiptRe.exec(comment)) !== null) {
        const claimedHex = m[1]!.toLowerCase();
        const tokenName = m[2]!;
        const fullClaim = m[0]!;
        if (!/exactly/.test(fullClaim)) continue;
        foundAnyExactly = true;
        const actual = tokenValues.get(tokenName);
        expect(actual).toBeDefined();
        expect(actual).toBe(`#${claimedHex}`);
      }
    }
    expect(foundAnyExactly).toBe(true);
  });
});
