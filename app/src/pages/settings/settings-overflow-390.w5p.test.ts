// DEC-781 wave-109 amendment (task v12m-w5-p): Settings edit views overflow
// the 390 viewport and the People grid's Person column collapses to zero.
// Tier 0 S1 "reach/read" break from docs/probes/metafid-phoneA-2026-08-19.md.
//
// VERIFIED CAUSE 1 -- .chq-settings-people-table's --chq-people-grid
// (settings.css:287, minmax(0,1fr) 170px 190px 200px) is 560px of fixed
// tracks plus gaps against a ~358px phone content box, consumed by both the
// header row (:304) and every person row (:720). Redefined inside the
// terminal phone block to a single track, with the header row hidden (it
// carries PERSON/ROLE/SCOPE column labels that have no meaning once every
// row is a stacked card).
//
// VERIFIED CAUSE 2 -- the six .chq-settings-field-* selectors (:827-853)
// pin desktop widths from the --chq-field-w-* tokens, and
// .chq-settings-field-pair (:887) is a two-column `auto auto` grid: Event-
// edit overflows 390 by 86px, CFP-edit by 46px. Every field goes full width
// and the pair collapses to one column inside the phone block.
//
// This file asserts the new rules live INSIDE the existing terminal 700px
// media block only -- no desktop pixel moves (mirrors
// app/src/pages/submissions/submissions-phone-card.test.ts's shape).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_781 } from '../../../../src/decisions';

void DEC_781; // Settings' fixed grid tracks and field-width tokens are desktop geometry and collapse at 390

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'settings.css');
const css = readFileSync(CSS_PATH, 'utf-8');

/** Strips one level of @media { ... } blocks out of a stylesheet's text. */
function withoutMediaBlocks(source: string): string {
  return source.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** Extracts the body text of the (single) terminal 700px media block. */
function mediaBlockBody(source: string): string {
  const match = source.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

describe('settings.css only declares ONE terminal @media (max-width: 700px) block', () => {
  it('the 700px media block appears exactly once', () => {
    const matches = css.match(/@media \(max-width: 700px\)/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe('DEC-781 wave-109: People grid collapses to a single stacked column at 390', () => {
  const mediaBody = mediaBlockBody(css);
  const outside = withoutMediaBlocks(css);

  it('redefines --chq-people-grid to a single track inside the phone block', () => {
    const rule = mediaBody.match(/\.chq-settings-people-table\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-people-table rule not found inside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/--chq-people-grid:\s*1fr\s*;/);
  });

  it('the header row (PERSON/ROLE/SCOPE labels) is hidden once rows stack', () => {
    const rule = mediaBody.match(/\.chq-settings-people-header-row\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-people-header-row rule not found inside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/display:\s*none\s*;/);
  });

  it('each person row already stacks its cells in a column (pre-existing rule, unaltered by this task)', () => {
    const rule = mediaBody.match(/\.chq-settings-people-row\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-people-row rule not found inside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/flex-direction:\s*column\s*;/);
  });

  it('the desktop --chq-people-grid declaration (outside media) still declares its original four tracks', () => {
    const rule = outside.match(/\.chq-settings-people-table\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-people-table desktop rule not found outside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/--chq-people-grid:\s*minmax\(0,\s*1fr\)\s*170px\s*190px\s*200px\s*;/);
  });
});

describe('DEC-781 wave-109: edit-view fields go full width and pairs collapse to one column at 390', () => {
  const mediaBody = mediaBlockBody(css);
  const outside = withoutMediaBlocks(css);

  const fieldSelectors = [
    '.chq-settings-field-date',
    '.chq-settings-field-seats',
    '.chq-settings-field-name',
    '.chq-settings-field-slug',
    '.chq-settings-field-venue',
    '.chq-settings-field-timezone',
  ];

  it.each(fieldSelectors)('%s carries a width: 100% rule inside the phone block', (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Selectors are declared as one comma-separated group sharing a single
    // body -- match the selector followed (possibly after siblings/comments)
    // by the shared `{ ... }` body, and assert width:100% lives in it.
    const groupMatch = mediaBody.match(
      new RegExp(`${escaped}[\\s,{][\\s\\S]*?\\{([^}]*)\\}`),
    );
    expect(groupMatch, `${selector} rule not found inside the phone block`).not.toBeNull();
    expect(groupMatch![1]).toMatch(/width:\s*100%\s*;/);
  });

  it('.chq-settings-field-pair collapses to a single column inside the phone block', () => {
    const rule = mediaBody.match(/\.chq-settings-field-pair\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-field-pair rule not found inside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/grid-template-columns:\s*1fr\s*;/);
    expect(rule![1]).not.toMatch(/auto\s+auto/);
  });

  it('the desktop .chq-settings-field-pair rule (outside media) is unchanged: auto auto, no width/fr/percent track', () => {
    const rule = outside.match(/\.chq-settings-field-pair\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-field-pair desktop rule not found outside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/grid-template-columns:\s*auto\s+auto\s*;/);
  });

  it('each field selector still declares its desktop width token (outside media), unchanged', () => {
    for (const selector of fieldSelectors) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rule = outside.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
      expect(rule, `${selector} desktop rule not found outside the phone block`).not.toBeNull();
      expect(rule![1]).toMatch(/width:\s*var\(--chq-field-w-/);
    }
  });
});

describe('leaves the top-level (outside-media) rule set unchanged from before this task', () => {
  const outside = withoutMediaBlocks(css);

  it('every top-level selector this task touched still resolves outside the phone block', () => {
    const topLevelSelectors = [
      '.chq-settings-people-table',
      '.chq-settings-people-header-row',
      '.chq-settings-people-row',
      '.chq-settings-field-date',
      '.chq-settings-field-seats',
      '.chq-settings-field-name',
      '.chq-settings-field-slug',
      '.chq-settings-field-venue',
      '.chq-settings-field-timezone',
      '.chq-settings-field-pair',
    ];
    for (const selector of topLevelSelectors) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(outside).toMatch(new RegExp(`${escaped}[\\s,{]`));
    }
  });

  it('the desktop --chq-people-grid and field-pair grid tracks are not overridden outside media', () => {
    // Only ONE occurrence of each desktop declaration should exist outside
    // any media block -- proving the phone-only redefinitions above stayed
    // inside the terminal @media block.
    const peopleGridMatches = outside.match(/--chq-people-grid:\s*minmax/g) ?? [];
    expect(peopleGridMatches).toHaveLength(1);
    const pairAutoMatches = outside.match(/grid-template-columns:\s*auto\s+auto/g) ?? [];
    expect(pairAutoMatches.length).toBeGreaterThanOrEqual(1);
  });
});
