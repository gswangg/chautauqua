// task v12m-w16-ui-r3-b (DEC-383 amendment): B8 interaction states for the
// three phone-only chip controls in the rule strip
// (`.chq-contacts-filter-add-chip`, `.chq-contacts-filter-rule-chip-edit`,
// `.chq-contacts-filter-rule-chip-dismiss`). jsdom applies no stylesheet, so
// a computed-style assertion would pass regardless of what the file says;
// this is a source-text scan, not a render test -- modelled on
// contacts-head-band-face-390.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');
const STRIPPED = stripCssComments(CSS);

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

describe('contacts.css phone chip B8 interaction states (DEC-383 amendment, v12m-w16-ui-r3-b)', () => {
  it('the file has exactly one terminal @media (max-width: 700px) block', () => {
    expect(BLOCKS.length).toBe(1);
  });

  const TERMINAL = () => BLOCKS[0]!.body;

  describe('.chq-contacts-filter-add-chip (painted dashed face)', () => {
    it('declares cursor:pointer', () => {
      expect(TERMINAL()).toMatch(
        /\.chq-contacts-filter-add-chip\s*\{[^}]*cursor:\s*pointer;[^}]*\}/,
      );
    });

    it('declares cursor:default on the disabled state', () => {
      expect(TERMINAL()).toMatch(
        /\.chq-contacts-filter-add-chip:disabled,\s*\n\s*\.chq-contacts-filter-add-chip\[aria-disabled='true'\]\s*\{[^}]*cursor:\s*default;[^}]*\}/,
      );
    });

    it('has a hover rule that darkens color and border-color to the token pair, excludes disabled', () => {
      const hoverMatch = TERMINAL().match(
        /\.chq-contacts-filter-add-chip:hover:not\(:disabled\):not\(\[aria-disabled='true'\]\)\s*\{([^}]*)\}/,
      );
      expect(hoverMatch).not.toBeNull();
      const body = hoverMatch![1]!;
      expect(body).toMatch(/color:\s*var\(--chq-brand-hover\);/);
      expect(body).toMatch(/border-color:\s*var\(--chq-brand-hover\);/);
    });

    it('the hover rule is nested inside an @media (hover: hover) guard within the terminal block', () => {
      expect(TERMINAL()).toMatch(
        /@media \(hover: hover\)\s*\{\s*\.chq-contacts-filter-add-chip:hover:not\(:disabled\)/,
      );
    });

    it('has an active rule that darkens color and border-color to the active token pair', () => {
      const activeMatch = TERMINAL().match(
        /\.chq-contacts-filter-add-chip:active:not\(:disabled\):not\(\[aria-disabled='true'\]\)\s*\{([^}]*)\}/,
      );
      expect(activeMatch).not.toBeNull();
      const body = activeMatch![1]!;
      expect(body).toMatch(/color:\s*var\(--chq-brand-active\);/);
      expect(body).toMatch(/border-color:\s*var\(--chq-brand-active\);/);
    });
  });

  describe('.chq-contacts-filter-rule-chip-edit (faceless, cancelled-padding)', () => {
    it('declares cursor:pointer', () => {
      expect(TERMINAL()).toMatch(
        /\.chq-contacts-filter-rule-chip-edit\s*\{[^}]*cursor:\s*pointer;[^}]*\}/,
      );
    });

    it('has a hover rule (nested inside @media (hover: hover)) darkening color with underline, and declares NEITHER background NOR border', () => {
      const guardMatch = TERMINAL().match(
        /@media \(hover: hover\)\s*\{\s*\.chq-contacts-filter-rule-chip-edit:hover\s*\{([^}]*)\}\s*\}/,
      );
      expect(guardMatch).not.toBeNull();
      const body = guardMatch![1]!;
      expect(body).toMatch(/color:\s*var\(--chq-brand-hover\);/);
      expect(body).toMatch(/text-decoration:\s*underline;/);
      expect(body).not.toMatch(/background/);
      expect(body).not.toMatch(/border/);
    });

    it('has an active rule darkening color to the active token with underline', () => {
      const activeMatch = TERMINAL().match(
        /\.chq-contacts-filter-rule-chip-edit:active\s*\{([^}]*)\}/,
      );
      expect(activeMatch).not.toBeNull();
      const body = activeMatch![1]!;
      expect(body).toMatch(/color:\s*var\(--chq-brand-active\);/);
      expect(body).toMatch(/text-decoration:\s*underline;/);
    });
  });

  describe('.chq-contacts-filter-rule-chip-dismiss (faceless, cancelled-padding)', () => {
    it('declares cursor:pointer, folded into the earlier landed width-floor rule (not a third bare block, per contacts-rule-chip-dismiss-floor.test.ts\'s two-rule count)', () => {
      expect(TERMINAL()).toMatch(
        /\.chq-contacts-filter-rule-chip-dismiss\s*\{[^}]*cursor:\s*pointer;[^}]*\}/,
      );
      const bareBlocks = (
        TERMINAL().match(/\.chq-contacts-filter-rule-chip-dismiss\s*\{/g) ?? []
      ).length;
      expect(bareBlocks).toBe(2);
    });

    it('has a hover rule (nested inside @media (hover: hover)) darkening color to --chq-ink, and declares NEITHER background NOR border NOR underline', () => {
      const guardMatch = TERMINAL().match(
        /@media \(hover: hover\)\s*\{\s*\.chq-contacts-filter-rule-chip-dismiss:hover\s*\{([^}]*)\}\s*\}/,
      );
      expect(guardMatch).not.toBeNull();
      const body = guardMatch![1]!;
      expect(body).toMatch(/color:\s*var\(--chq-ink\);/);
      expect(body).not.toMatch(/background/);
      expect(body).not.toMatch(/border/);
      expect(body).not.toMatch(/text-decoration/);
    });

    it('has an active rule holding the same --chq-ink colour', () => {
      const activeMatch = TERMINAL().match(
        /\.chq-contacts-filter-rule-chip-dismiss:active\s*\{([^}]*)\}/,
      );
      expect(activeMatch).not.toBeNull();
      expect(activeMatch![1]).toMatch(/color:\s*var\(--chq-ink\);/);
    });
  });

  it('no new hex literal was minted -- only var(--chq-*) tokens appear in the new rules', () => {
    // Slice from the add-chip's cursor rule (the first of this task's
    // appended rules) to the end of the block body -- everything this task
    // added -- and assert no bare hex colour literal appears there.
    const body = TERMINAL();
    const startIdx = body.indexOf('.chq-contacts-filter-add-chip {\n    cursor: pointer;');
    expect(startIdx).toBeGreaterThan(-1);
    const appended = body.slice(startIdx);
    expect(appended).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('.chq-contacts-filter-builder-done { display: none; } now occurs exactly once in the file', () => {
    const matches = STRIPPED.match(/\.chq-contacts-filter-builder-done\s*\{\s*display:\s*none;\s*\}/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
});
