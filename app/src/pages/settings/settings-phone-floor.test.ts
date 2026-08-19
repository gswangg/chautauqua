// Settings cluster tap-floor + 390-overflow backlog (task w8-f, DEC-393 /
// DEC-989 wave-90 amendments). CSS-text checks, mirroring the house idiom
// of `app/src/phone-tap-target.scan.test.ts` /
// `app/src/phone-horizontal-overflow.scan.test.ts`: jsdom performs no
// layout, so these read settings.css's OWN declarations rather than
// computed style.
//
// Covers the 15-row backlog named in docs/design/audit/tap-floor-v12.md
// (.chq-settings-edit-row-actions, .chq-settings-inline-action,
// .chq-settings-people-actions, .chq-settings-saved-embed-actions,
// .chq-settings-tokens-col-actions) and docs/design/audit/
// overflow-390-v12.md's settings rows (nine nowrap columns + the
// room-edit-row fixed grid).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_989 } from '../../../../src/decisions';

void DEC_393; // this file's tap-floor half
void DEC_989; // this file's overflow half

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'settings.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every top-level `selector { body }` (outside any @media block). */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = stripMedia(css);
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    const selector = stripComments(m[1] ?? '').trim();
    if (!selector) continue;
    out.push({ selector, body: stripComments(m[2] ?? '') });
  }
  return out;
}

/** Brace-matched removal of every @media block (mirrors the two scans'
 * own idiom -- a linear scan, not a nested-quantifier regex). */
function stripMedia(css: string): string {
  const ranges: Array<[number, number]> = [];
  const openRe = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index, i]);
    openRe.lastIndex = i;
  }
  let out = '';
  let last = 0;
  for (const [start, end] of ranges) {
    out += css.slice(last, start);
    last = end;
  }
  out += css.slice(last);
  return out;
}

/** All `@media (max-width: <=700px) { ... }` block bodies, in source
 * order, each paired with its start offset in `css` (used to find the
 * TRUE LAST one). */
function phoneBlocks(css: string): Array<{ body: string; start: number; end: number }> {
  const out: Array<{ body: string; start: number; end: number }> = [];
  const openRe = /@media\s*\(\s*max-width:\s*(\d+)px\s*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    if (Number(m[1]) > 700) continue;
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push({ body: css.slice(bodyStart, i - 1), start: m.index, end: i });
  }
  return out;
}

/** Rules inside a single block body, in source order. */
function rulesIn(body: string): Array<{ selector: string; body: string }> {
  const stripped = stripComments(body);
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const selector = (m[1] ?? '').trim();
    if (!selector) continue;
    out.push({ selector, body: m[2] ?? '' });
  }
  return out;
}

function findRule(
  rules: Array<{ selector: string; body: string }>,
  selector: string,
): { selector: string; body: string } | undefined {
  return rules.find((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));
}

function hasFloorShape(body: string): boolean {
  const minHeightOk = /min-height\s*:\s*(\d+(?:\.\d+)?)px/.exec(body);
  const heightFloor = minHeightOk !== null && Number(minHeightOk[1]) >= 44;
  const flex = /display\s*:\s*flex/.test(body);
  const centered = /align-items\s*:\s*center/.test(body);
  const paddingInline =
    /padding-inline\s*:\s*(?!0\b)(?!0px)/.test(body) || /padding\s*:\s*[^;]*[1-9]/.test(body);
  return heightFloor && flex && centered && paddingInline;
}

function hasEscapeShape(body: string): boolean {
  return /overflow\s*:\s*(hidden|auto|scroll)/.test(body) && /text-overflow\s*:\s*ellipsis/.test(body);
}

const phoneBlockList = phoneBlocks(CSS);
const lastPhoneBlock = phoneBlockList[phoneBlockList.length - 1]!;
const lastPhoneRules = rulesIn(lastPhoneBlock.body);
// Every phone-scoped rule across ALL @media(<=700px) blocks -- some
// offenders (.chq-settings-saved-embed-actions/-caption) already conform
// via an EARLIER terminal block from a prior wave; this task's job is the
// still-open backlog, not re-deriving already-closed rows.
const allPhoneRules = phoneBlockList.flatMap((b) => rulesIn(b.body));

describe('Settings cluster phone floor / overflow backlog (task w8-f)', () => {
  it('found the settings.css file and at least one phone-width block (vacuous-scan tripwire)', () => {
    expect(CSS.length).toBeGreaterThan(1000);
    expect(phoneBlockList.length).toBeGreaterThan(0);
  });

  it("the appended block is the LAST top-level construct in settings.css (never edit-into an earlier block)", () => {
    const trailing = CSS.slice(lastPhoneBlock.end).trim();
    expect(trailing).toBe('');
    // The former companion assertion here -- `phoneBlockList.length >= 5`,
    // i.e. "the appended block is a genuine, distinct block, not the
    // pre-existing :1863 one" -- is retired, not weakened. It was one of the
    // two contradictory hand-written pins named in the header of
    // test/phone-terminal-block.scan.test.ts (DEC-385 amendment wave 98):
    // this file demanded settings.css carry at LEAST five phone blocks while
    // test/portal-phone-frames.test.ts:220 demanded portal.css.ts carry
    // exactly ONE, two guesses at one shared rule pointing in opposite
    // directions. That derived scan now owns the rule for every sheet, and
    // it resolves the contradiction the other way: exactly one phone block
    // per sheet, textually terminal. settings.css has since been
    // consolidated to that shape, so a floor of five is now an assertion
    // that the sheet must VIOLATE the live contract. The retired pin's real
    // intent -- "the phone rules this file checks are not stranded behind a
    // later desktop rule" -- is exactly what the surviving `trailing === ''`
    // line above tests, and it is tested there for whatever number of
    // blocks the sheet actually has. Task w1-d retired the portal.css.ts
    // side of the contradiction and left this side open; this closes it.
  });

  describe('44px tap floor (DEC-393 wave-90 amendment)', () => {
    const floorCases: Array<{ label: string; selector: string }> = [
      { label: '.chq-settings-inline-action (itself the anchor)', selector: '.chq-settings-inline-action' },
      {
        label: '.chq-settings-edit-row-actions .chq-link-button',
        selector: '.chq-settings-edit-row-actions .chq-link-button',
      },
      {
        label: '.chq-settings-people-actions .chq-link-button',
        selector: '.chq-settings-people-actions .chq-link-button',
      },
      {
        label: '.chq-settings-tokens-table tbody td:last-child .chq-link-button',
        selector: '.chq-settings-tokens-table tbody td:last-child .chq-link-button',
      },
    ];

    for (const { label, selector } of floorCases) {
      it(`${label} declares the four-property floor shape (min-height>=44px, flex, centered, non-zero horizontal padding)`, () => {
        const rule = findRule(lastPhoneRules, selector);
        expect(rule, `no phone-scoped rule found for "${selector}"`).toBeDefined();
        expect(hasFloorShape(rule!.body), `rule body did not satisfy the floor shape:\n${rule!.body}`).toBe(true);
      });
    }

    it('.chq-settings-saved-embed-actions already conforms via .chq-link-button (no second rule needed, closed by a prior wave)', () => {
      const rule = findRule(allPhoneRules, '.chq-settings-saved-embed-actions .chq-link-button');
      expect(rule, 'expected the pre-existing saved-embed-actions anchor rule to still be present').toBeDefined();
      expect(hasFloorShape(rule!.body)).toBe(true);
    });

    it('declares no phone rule for .chq-pill (EXCLUDED BY RULING -- base rule lives in app/src/styles.css, shell lane\'s to fix once)', () => {
      const bareRule = allPhoneRules.find((r) => r.selector.split(',').map((s) => s.trim()).includes('.chq-pill'));
      expect(bareRule, 'settings.css must not declare a second phone rule for .chq-pill').toBeUndefined();
    });
  });

  describe('390 overflow (DEC-989 wave-90 amendment)', () => {
    const escapeCases = [
      '.chq-settings-edit-row-meta',
      '.chq-settings-edit-row-seats',
      '.chq-settings-exports-table .chq-settings-exports-col-csv',
      '.chq-settings-exports-table .chq-settings-exports-col-json',
      '.chq-settings-tokens-table .chq-settings-tokens-col-actions',
    ];

    for (const selector of escapeCases) {
      it(`${selector} declares the three-property overflow escape at phone width`, () => {
        const rule = findRule(lastPhoneRules, selector);
        expect(rule, `no phone-scoped rule found for "${selector}"`).toBeDefined();
        expect(hasEscapeShape(rule!.body), `rule body did not escape overflow:\n${rule!.body}`).toBe(true);
        expect(/min-width\s*:\s*0\b/.test(rule!.body)).toBe(true);
      });
    }

    it('.chq-settings-saved-embed-caption already conforms via white-space:normal (no second rule needed, closed by a prior wave)', () => {
      const rule = findRule(allPhoneRules, '.chq-settings-saved-embed-caption');
      expect(rule).toBeDefined();
      expect(/white-space\s*:\s*normal/.test(rule!.body) || hasEscapeShape(rule!.body)).toBe(true);
    });

    const exemptCases = [
      { selector: '.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-column' },
      { selector: '.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-sample' },
      { selector: '.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-arrow' },
    ];

    for (const { selector } of exemptCases) {
      it(`${selector} carries an overflow-exempt comment directly above its phone-scoped rule`, () => {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\/\\*\\s*overflow-exempt:[^*]*\\*\\/\\s*${escaped}\\s*\\{`);
        expect(re.test(lastPhoneBlock.body), `expected an overflow-exempt comment immediately above ${selector}`).toBe(
          true,
        );
      });
    }

    it("re-lines .chq-settings-room-edit-row's over-budget fixed grid at phone width (DEC-919: re-line, never remove a control)", () => {
      const desktopRule = findRule(topLevelRules(CSS), '.chq-settings-room-edit-row');
      expect(desktopRule).toBeDefined();
      // Falsifiability control: the desktop rule really is the 460px-over-budget
      // shape this fix responds to -- if a future edit changes it, this
      // assertion (not just the phone override) should fail loudly.
      expect(desktopRule!.body).toMatch(/110px/);
      expect(desktopRule!.body).toMatch(/150px/);
      expect(desktopRule!.body).toMatch(/200px/);

      const phoneRule = findRule(lastPhoneRules, '.chq-settings-room-edit-row');
      expect(phoneRule, 'no phone-scoped override for .chq-settings-room-edit-row').toBeDefined();
      const gtc = /grid-template-columns\s*:\s*([^;]+);/.exec(phoneRule!.body);
      expect(gtc, 'phone override must re-declare grid-template-columns').toBeDefined();
      const fixedTracks = gtc![1]!.match(/\d+(?:\.\d+)?px/g) ?? [];
      const total = fixedTracks.reduce((sum, t) => sum + Number(t.replace('px', '')), 0);
      expect(total, `re-lined fixed tracks still total ${total}px, over the 358px budget`).toBeLessThanOrEqual(358);
    });
  });

  // --- Falsifiability controls: synthetic positive/negative cases, mirroring
  // the two audit scans' own convention, so a change to the helpers above
  // can't silently make every real case pass vacuously. ---
  describe('falsifiability controls', () => {
    it('hasFloorShape rejects padding-only (positive control: padding alone never reaches the floor)', () => {
      expect(hasFloorShape('padding: 0 16px;')).toBe(false);
    });

    it('hasFloorShape accepts the full four-property shape (negative control)', () => {
      expect(
        hasFloorShape('min-height: 44px; display: flex; align-items: center; padding-inline: 10px;'),
      ).toBe(true);
    });

    it('hasEscapeShape rejects a bare nowrap declaration (positive control)', () => {
      expect(hasEscapeShape('white-space: nowrap;')).toBe(false);
    });

    it('hasEscapeShape accepts overflow:hidden + text-overflow:ellipsis (negative control)', () => {
      expect(hasEscapeShape('overflow: hidden; text-overflow: ellipsis; min-width: 0;')).toBe(true);
    });
  });
});
