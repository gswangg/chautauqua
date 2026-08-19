// DEC-393 wave-90 amendment (task w8-c): closes the Comms cluster's share
// of the tier-2 tap-floor audit (docs/design/audit/tap-floor-v12.md) and
// the 358px-overflow offenders it shares. Every fix lands in ONE new
// @media (max-width: 700px) block appended at the TRUE END of comms.css,
// never inside the file's existing 700px block (which sits earlier, per
// the wave-90 amendment's rule (b): a fix dropped into an existing block
// that a top-level rule later shadows is a no-op). This is a text scan,
// not a render test: it pins the CSS source directly so a future edit
// that quietly drops a declaration, reorders the block, or appends a new
// top-level rule after it fails loudly.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert';
import { describe, expect, it } from 'vitest';

const COMMS_CSS = readFileSync(join(__dirname, 'comms.css'), 'utf8');

// Extract every `@media (max-width: 700px) { ... }` block (one nesting
// level, which is all this file uses), matching braces so a `{{ }}` mock
// template string inside a comment can't truncate a block early.
function phoneBlocks(css: string): string[] {
  const blocks: string[] = [];
  const re = /@media \(max-width: 700px\) \{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    blocks.push(css.slice(m.index + m[0].length, i - 1));
  }
  expect(blocks.length, 'expected at least one phone block').toBeGreaterThan(0);
  return blocks;
}

function lastPhoneBlock(css: string): string {
  const blocks = phoneBlocks(css);
  const last = blocks[blocks.length - 1];
  assert(last !== undefined);
  return last;
}

// Pull the declaration body for a given selector out of a block of CSS
// text (selector must appear in a comma-separated selector list terminated
// by `{`, and the body runs to the next `}`).
function ruleBodyFor(rawCss: string, selector: string): string {
  // Strip block comments first -- a doc comment sitting between one rule's
  // closing brace and the next selector (e.g. the 358px-budget note above
  // the overflow rules) would otherwise sit between the required anchor
  // char and the selector text.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[{,}])\\s*${escaped}\\s*(?=[,{])[\\s\\S]*?\\{([^}]*)\\}`);
  const m = css.match(re);
  expect(m, `expected to find a rule for ${selector} in the phone block`).not.toBeNull();
  const body = m?.[1];
  assert(body !== undefined);
  return body;
}

function expectFloorDeclarations(body: string, label: string) {
  expect(body, `${label}: min-height:44px`).toMatch(/min-height:\s*44px/);
  expect(body, `${label}: display:flex`).toMatch(/display:\s*flex/);
  expect(body, `${label}: align-items:center`).toMatch(/align-items:\s*center/);

  const paddingMatch = body.match(/padding-inline:\s*(-?\d+)px/);
  expect(paddingMatch, `${label}: padding-inline present`).not.toBeNull();
  const marginMatch = body.match(/margin-inline:\s*(-?\d+)px/);
  expect(marginMatch, `${label}: margin-inline present`).not.toBeNull();

  const padding = Number(paddingMatch![1]);
  const margin = Number(marginMatch![1]);
  expect(padding, `${label}: padding-inline is positive`).toBeGreaterThan(0);
  expect(margin, `${label}: margin-inline equal and opposite to padding-inline`).toBe(-padding);
}

function expectOverflowEscape(body: string, label: string) {
  expect(body, `${label}: overflow:hidden`).toMatch(/overflow:\s*hidden/);
  expect(body, `${label}: text-overflow:ellipsis`).toMatch(/text-overflow:\s*ellipsis/);
  expect(body, `${label}: min-width:0`).toMatch(/min-width:\s*0/);
}

const COMMS_PHONE_BLOCK = lastPhoneBlock(COMMS_CSS);

const TAP_FLOOR_SELECTORS = [
  '.chq-comms-editor-actions > .chq-btn',
  '.chq-comms-editor-actions > .chq-link-button',
  '.chq-comms-head-actions > .chq-pill',
  '.chq-comms-history-head-actions > .chq-btn',
  '.chq-comms-preview-actions > .chq-btn',
  '.chq-comms-refusal-actions > .chq-btn',
  '.chq-comms-select-actions > .chq-btn',
  '.chq-comms-send-report-all-history',
  '.chq-comms-send-report-footer-actions > .chq-btn',
  '.chq-comms-template-actions > .chq-btn',
  '.chq-comms-send-detail > .chq-link-button',
  '.chq-comms-recent-sends .chq-section-head .chq-link-button',
  '.chq-comms-blocked-list li .chq-link-button',
];

const OVERFLOW_SELECTORS = [
  '.chq-comms-compose-col-slot',
  '.chq-comms-compose-table td:last-child',
  '.chq-comms-send-report-skipped-retry',
];

describe('Comms phone tap-floor + overflow fixes (DEC-393 wave-90 amendment, task w8-c)', () => {
  it.each(TAP_FLOOR_SELECTORS)('%s reaches the 44px floor with centred flex and cancelling padding', (selector) => {
    const body = ruleBodyFor(COMMS_PHONE_BLOCK, selector);
    expectFloorDeclarations(body, selector);
  });

  it.each(OVERFLOW_SELECTORS)('%s gets the hidden/ellipsis/min-width:0 escape at phone width', (selector) => {
    const body = ruleBodyFor(COMMS_PHONE_BLOCK, selector);
    expectOverflowEscape(body, selector);
  });

  it('does NOT truncate the merge-field token -- it carries an overflow-exempt comment instead', () => {
    expect(COMMS_CSS).toMatch(
      /\/\*\s*overflow-exempt:[^*]*\*\/\s*\.chq-insert-field-menu-item-token\s*\{/,
    );
    // And the phone block never re-declares it with the ellipsis escape.
    expect(() => ruleBodyFor(COMMS_PHONE_BLOCK, '.chq-insert-field-menu-item-token')).toThrow();
  });

  it('.chq-bulkbar-actions is left alone -- its base rule is the shell lane\'s (styles.css), never re-declared here', () => {
    expect(() => ruleBodyFor(COMMS_PHONE_BLOCK, '.chq-bulkbar-actions')).toThrow();
  });

  it('the appended block is the LAST top-level construct in the file: no top-level rule follows it', () => {
    expect(isTerminalPhoneBlock(COMMS_CSS)).toBe(true);
  });

  it('falsifiability control: a fabricated sheet with a rule AFTER its phone block is NOT terminal', () => {
    const fake = `
.chq-x-fake-container {
  display: flex;
}

@media (max-width: 700px) {
  .chq-x-fake-container > .chq-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding-inline: 10px;
    margin-inline: -10px;
  }
}

.chq-x-fake-trailing-rule {
  color: red;
}
`;
    expect(isTerminalPhoneBlock(fake)).toBe(false);
  });

  it('falsifiability control: a fabricated sheet whose phone block genuinely IS last passes', () => {
    const fake = `
.chq-x-fake-container {
  display: flex;
}

@media (max-width: 700px) {
  .chq-x-fake-container > .chq-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding-inline: 10px;
    margin-inline: -10px;
  }
}
`;
    expect(isTerminalPhoneBlock(fake)).toBe(true);
  });
});

/** True if the LAST `@media (max-width: 700px) { ... }` block in `css`
 * (brace-matched) is also the last top-level construct in the file --
 * i.e. nothing but whitespace follows its closing brace. */
function isTerminalPhoneBlock(css: string): boolean {
  const re = /@media \(max-width: 700px\) \{/g;
  let m: RegExpExecArray | null;
  let lastCloseIndex = -1;
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    lastCloseIndex = i;
  }
  assert(lastCloseIndex !== -1, 'expected at least one 700px phone block');
  return css.slice(lastCloseIndex).trim() === '';
}
