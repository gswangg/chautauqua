// v12 design pack — the five width:390 PHONE frames in
// docs/design/Chautauqua Contacts.dc.html:
//
//   "Contacts"        (line 175) — look someone up, call them
//   "Contact · 390"   (line 403) — the errand you actually run on a phone
//   "Pipeline · 390"  (line 443) — one column at a time
//   "Import CSV · 390"(line 483) — one column per screen
//   "Merge · 390"     (line 518) — pick a side, field by field
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/shell-geometry.test.ts and ContactsApp.newContact.render.test.tsx
// — these are source-scan pins on the CSS TEXT of the two contacts
// stylesheets, not computed style.
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY. A min-width query in either file would make the sheet
//     bidirectional and is a hard failure here.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px, and an interactive
//     element needs min-height PLUS centred flex PLUS horizontal padding —
//     padding alone does not reach the floor, and without padding the hit
//     box is only as wide as the text.
//
// Desktop is frozen: every assertion below reads only inside a max-width
// block, and the companion desktop pins in ContactsTable.render.test.tsx,
// ContactsApp.newContact.render.test.tsx and MergePage.render.test.tsx run
// unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments are stripped before any brace scanning: these sheets carry long
 * explanatory comments, and a literal `{`/`}` inside one (a `colSpan={5}`
 * reference, a `var(--x, #hex)` example) would desynchronise the depth
 * counter and silently truncate a block. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const CONTACTS_CSS = read('contacts.css');
const PANELS_CSS = read('contacts-panels.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`.
 * Brace-matched rather than regex-bounded, so a nested rule can never end
 * the block early (the naive `\{[^}]*\}` form stops at the first inner
 * rule's closing brace and silently pins nothing). */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** A single rule's declaration body, by selector, inside the phone layer.
 * Selectors are compared as WHOLE members of the rule's selector list, not
 * by substring: `.chq-contacts-import-actions` must not silently resolve to
 * `.chq-contacts-duplicate-group .chq-contacts-import-actions`, which is a
 * different rule with a different body. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

/** The rule bodies of every phone rule whose selector list mentions
 * `selector`, joined — for tokens shared by a grouped selector. */
function phoneRuleGroup(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bodies: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    if (new RegExp(`(?:^|[,\\s])${escaped}(?:[,\\s{]|$)`).test(m[1]!)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`no phone rule mentioning ${selector}`);
  return bodies.join('\n');
}

const BOTH: [string, string][] = [
  ['contacts.css', CONTACTS_CSS],
  ['contacts-panels.css', PANELS_CSS],
];

describe('DEC-385: the contacts phone layer is single-direction', () => {
  for (const [name, css] of BOTH) {
    it(`${name} declares no min-width media query`, () => {
      expect(css).not.toMatch(/@media[^{]*min-width/);
    });

    it(`${name} has at least one max-width phone block`, () => {
      expect(phoneLayer(css).length).toBeGreaterThan(0);
    });
  }
});

describe('DESIGN-RULINGS: never author a min-height below 44px on a phone token', () => {
  for (const [name, css] of BOTH) {
    it(`${name}'s phone layer floors every authored min-height at 44px`, () => {
      const layer = phoneLayer(css);
      const heights = [...layer.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
      // The sweep that missed a hardcoded 32px matched only the literal
      // strings 36/38/40px; this one reads every value it finds.
      expect(heights.length).toBeGreaterThan(0);
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
    });
  }
});

describe('v12 phone frame "Contacts" (390)', () => {
  it('stacks the filter builder one control per line, so no rule control collapses under the 44px floor\'s width half', () => {
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-filter-rules-row')).toMatch(/flex-direction:\s*column/);
    const group = phoneRule(CONTACTS_CSS, '.chq-contacts-filter-rule-group');
    expect(group).toMatch(/flex-direction:\s*column/);
    expect(group).toMatch(/align-items:\s*stretch/);
    // The desktop row pushes the match count + Save to the end with
    // margin-left:auto; at 390 there is no end to push to.
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-filter-rules-end')).toMatch(/margin-left:\s*0/);
  });

  it('gives the view chips real horizontal padding, not just the shared 44px height', () => {
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-tabstrip-row .chq-chipstrip .chq-pill')).toMatch(
      /padding:\s*0 14px/,
    );
  });

  it('lays each directory row out as the frame draws it: identity stack in the middle, action right-flushed', () => {
    const row = phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody tr');
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
    // Explicit rows: `1 / -1` resolves against the EXPLICIT grid only, so
    // without these the two spanning cells collapse to one implicit row.
    expect(row).toMatch(/grid-template-rows:\s*auto auto auto/);

    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td:first-child')).toMatch(/grid-row:\s*1 \/ 4/);
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td:nth-child(2)')).toMatch(/grid-row:\s*1/);
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td:nth-child(3)')).toMatch(/grid-row:\s*2/);
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td:nth-child(4)')).toMatch(/grid-row:\s*3/);

    const action = phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td:nth-child(5)');
    expect(action).toMatch(/grid-column:\s*3/);
    expect(action).toMatch(/grid-row:\s*1 \/ 4/);
    // 44px height comes from styles.css's shared .chq-btn phone rule; the
    // padding is what widens the hit box past the word "Open".
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td:nth-child(5) .chq-btn')).toMatch(
      /padding:\s*0 14px/,
    );
  });

  it('spans the colSpan loading cell across all three tracks (the attribute is inert under display:grid)', () => {
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-table tbody td[colspan]')).toMatch(/grid-column:\s*1 \/ -1/);
  });

  it('keeps the DEC-937 attribute-sourced card label, never a positional one', () => {
    const layer = phoneLayer(CONTACTS_CSS);
    expect(layer).toMatch(/td\[data-label\]::before\s*\{\s*content:\s*attr\(data-label\)/);
    expect(layer).not.toMatch(
      /:(nth-child|nth-of-type|first-child|last-child)\([^)]*\)::(before|after)\s*\{[^}]*content:\s*'[^']*[A-Za-z]/,
    );
  });
});

describe('v12 phone frame "Contact · 390"', () => {
  it('collapses the record row\'s 130px label gutter so the value gets the full measure', () => {
    const row = phoneRule(CONTACTS_CSS, '.chq-contacts-record-row');
    expect(row).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(row).not.toMatch(/130px/);
  });

  it('collapses the "Across your events" row the same way and steps the event name to 14px', () => {
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-history-row')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-history-event')).toMatch(/font-size:\s*14px/);
  });

  it('turns the drawer action bar into the frame\'s footer: stacked, 48px targets with horizontal padding', () => {
    const bar = phoneRule(CONTACTS_CSS, '.chq-contacts-drawer-actions');
    expect(bar).toMatch(/flex-direction:\s*column/);
    expect(bar).toMatch(/align-items:\s*stretch/);

    const buttons = phoneRule(CONTACTS_CSS, '.chq-contacts-drawer-actions-right .chq-btn');
    expect(buttons).toMatch(/min-height:\s*48px/);
    expect(buttons).toMatch(/padding:\s*0 16px/);

    const del = phoneRule(CONTACTS_CSS, '.chq-contacts-delete-trigger');
    expect(del).toMatch(/min-height:\s*48px/);
    expect(del).toMatch(/padding:\s*0 16px/);
  });

  it('left-aligns the save-scope sentence once the bar\'s buttons are full width', () => {
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-save-scope-note')).toMatch(/text-align:\s*left/);
  });

  it('stacks the New-contact modal\'s two-up field rows', () => {
    expect(phoneRule(CONTACTS_CSS, '.chq-contacts-new-contact-row-2up')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });
});

describe('v12 phone frame "Pipeline · 390"', () => {
  it('hides the five-column board and shows the one-stage-at-a-time strip', () => {
    expect(phoneRule(PANELS_CSS, '.chq-contacts-pipeline-columns')).toMatch(/display:\s*none/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-stages')).toMatch(/display:\s*flex/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-list')).toMatch(/display:\s*flex/);
  });

  it('closes the stage scroller with the frame\'s hairline band and pads its pills', () => {
    const strip = phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-stages');
    expect(strip).toMatch(/border-bottom:\s*1px solid var\(--chq-hairline\)/);
    expect(strip).toMatch(/padding-bottom:\s*12px/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-stages .chq-pill')).toMatch(/padding:\s*0 14px/);
  });

  it('stacks the head and gives its one action the full width at 48px', () => {
    expect(phoneRule(PANELS_CSS, '.chq-contacts-pipeline-head')).toMatch(/flex-direction:\s*column/);
    const action = phoneRule(PANELS_CSS, '.chq-contacts-pipeline-head > .chq-btn');
    expect(action).toMatch(/width:\s*100%/);
    expect(action).toMatch(/min-height:\s*48px/);
  });

  it('draws the card as the frame does: identity left at 16px, "Move ›" right-flushed and never shrunk', () => {
    const card = phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-card');
    expect(card).toMatch(/display:\s*flex/);
    expect(card).toMatch(/align-items:\s*center/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-card .chq-contacts-pipeline-card-name')).toMatch(
      /font-size:\s*16px/,
    );
    const move = phoneRule(PANELS_CSS, '.chq-contacts-pipeline-phone-card-move');
    expect(move).toMatch(/flex-shrink:\s*0/);
    expect(move).toMatch(/padding:\s*0 13px/);
  });

  it('lets the duplicate row\'s action pair wrap instead of crushing below its own minimum', () => {
    expect(phoneRule(PANELS_CSS, '.chq-contacts-duplicate-group .chq-contacts-import-actions')).toMatch(
      /flex-wrap:\s*wrap/,
    );
  });
});

describe('v12 phone frame "Import CSV · 390"', () => {
  it('stacks each column block and drops the mid-row arrow that no longer points anywhere', () => {
    const row = phoneRule(PANELS_CSS, '.chq-contacts-import-column-row');
    expect(row).toMatch(/flex-direction:\s*column/);
    expect(row).toMatch(/align-items:\s*stretch/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-import-column-arrow')).toMatch(/display:\s*none/);
  });

  it('gives the column name the frame\'s display face and lets the sample values wrap', () => {
    const header = phoneRule(PANELS_CSS, '.chq-contacts-import-column-header');
    expect(header).toMatch(/font-family:\s*var\(--chq-font-display\)/);
    expect(header).toMatch(/font-size:\s*20px/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-import-column-sample')).toMatch(/white-space:\s*normal/);
  });

  it('takes the target select full width — the desktop 262px/max-width:48% pins it under the floor at 390', () => {
    const select = phoneRule(PANELS_CSS, '.chq-contacts-import-column-select');
    expect(select).toMatch(/width:\s*100%/);
    expect(select).toMatch(/max-width:\s*none/);
  });

  it('stacks the step actions as full-width 48px targets', () => {
    expect(phoneRule(PANELS_CSS, '.chq-contacts-import-actions')).toMatch(/flex-direction:\s*column/);
    const btn = phoneRule(PANELS_CSS, '.chq-contacts-import-actions .chq-btn');
    expect(btn).toMatch(/width:\s*100%/);
    expect(btn).toMatch(/min-height:\s*48px/);
    expect(btn).toMatch(/padding:\s*0 16px/);
  });

  it('floors the enroll dialog\'s bare-button result rows, which carry no .chq-btn class', () => {
    const result = phoneRule(PANELS_CSS, '.chq-contacts-pipeline-enroll-result');
    expect(result).toMatch(/min-height:\s*44px/);
    expect(result).toMatch(/align-items:\s*center/);
    expect(result).toMatch(/padding:\s*0 12px/);
  });
});

describe('v12 phone frame "Merge · 390"', () => {
  it('drops the compare head and stacks label / keep / drop into one column', () => {
    expect(phoneRule(PANELS_CSS, '.chq-contacts-merge-compare-head')).toMatch(/display:\s*none/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-merge-compare-row')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it('makes the row label the frame\'s uppercase micro-label now that no column head names it', () => {
    const label = phoneRule(PANELS_CSS, '.chq-contacts-merge-compare-label');
    expect(label).toMatch(/text-transform:\s*uppercase/);
    expect(label).toMatch(/font-size:\s*11px/);
    expect(label).toMatch(/color:\s*var\(--chq-muted\)/);
  });

  it('boxes the kept value in brand and the discarded one in the border token, both at 48px', () => {
    const keep = phoneRule(PANELS_CSS, '.chq-contacts-merge-compare-keep');
    expect(keep).toMatch(/border:\s*1px solid var\(--chq-brand\)/);
    expect(keep).toMatch(/min-height:\s*48px/);
    expect(keep).toMatch(/padding:\s*0 13px/);

    // The status-tokens-pair-by-density rule: all four discard renderings
    // take the SAME box, so a row never changes shape by outcome.
    for (const sel of [
      '.chq-contacts-merge-compare-drop',
      '.chq-contacts-merge-compare-combine',
      '.chq-contacts-merge-compare-blank',
      '.chq-contacts-merge-compare-empty',
    ]) {
      const body = phoneRuleGroup(PANELS_CSS, sel);
      expect(body).toMatch(/border:\s*1px solid var\(--chq-border\)/);
      expect(body).toMatch(/min-height:\s*48px/);
      expect(body).toMatch(/padding:\s*0 13px/);
    }
  });

  it('drops the merge page\'s 28px desktop inset to the frame\'s 16px and stacks the title band', () => {
    const page = phoneRule(PANELS_CSS, '.chq-contacts-merge-page');
    expect(page).toMatch(/padding-left:\s*16px/);
    expect(page).toMatch(/padding-right:\s*16px/);
    expect(phoneRule(PANELS_CSS, '.chq-contacts-merge-titleband')).toMatch(/flex-direction:\s*column/);
  });

  it('floors "Not a duplicate" — a bare <button> the shared .chq-btn phone rule cannot reach', () => {
    const escape = phoneRule(PANELS_CSS, '.chq-contacts-merge-not-duplicate');
    expect(escape).toMatch(/min-height:\s*48px/);
    expect(escape).toMatch(/display:\s*flex/);
    expect(escape).toMatch(/align-items:\s*center/);
    expect(escape).toMatch(/padding:\s*0 16px/);
  });

  it('stacks the merge footer\'s buttons at 48px with horizontal padding', () => {
    expect(phoneRule(PANELS_CSS, '.chq-contacts-merge-footer')).toMatch(/flex-direction:\s*column/);
    const btn = phoneRule(PANELS_CSS, '.chq-contacts-merge-footer .chq-btn');
    expect(btn).toMatch(/min-height:\s*48px/);
    expect(btn).toMatch(/padding:\s*0 16px/);
  });
});

describe('desktop is frozen: the phone geometry lives only inside max-width blocks', () => {
  function desktopLayer(css: string): string {
    let out = '';
    let i = 0;
    const opener = /@media[^{]*\{/g;
    let m: RegExpExecArray | null;
    while ((m = opener.exec(css)) !== null) {
      out += css.slice(i, m.index);
      let depth = 1;
      let j = m.index + m[0].length;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth += 1;
        else if (css[j] === '}') depth -= 1;
        j += 1;
      }
      i = j;
      opener.lastIndex = j;
    }
    return out + css.slice(i);
  }

  it('leaves the desktop record row on its 130px label gutter', () => {
    expect(desktopLayer(CONTACTS_CSS)).toMatch(
      /\.chq-contacts-record-row\s*\{[^}]*grid-template-columns:\s*130px minmax\(0, 1fr\)/,
    );
  });

  it('leaves the desktop history row on its 120px gutter', () => {
    expect(desktopLayer(CONTACTS_CSS)).toMatch(/\.chq-contacts-history-row\s*\{[^}]*grid-template-columns:\s*120px 1fr/);
  });

  it('leaves the desktop merge compare grid at 130px 1fr 1fr, head included', () => {
    const desktop = desktopLayer(PANELS_CSS);
    expect(desktop).toMatch(/\.chq-contacts-merge-compare-head\s*\{[^}]*grid-template-columns:\s*130px 1fr 1fr/);
    expect(desktop).toMatch(/\.chq-contacts-merge-compare-row\s*\{[^}]*grid-template-columns:\s*130px 1fr 1fr/);
  });

  it('leaves the desktop import target select at its 262px / 48% allocation', () => {
    expect(desktopLayer(PANELS_CSS)).toMatch(
      /\.chq-contacts-import-column-select\s*\{[^}]*width:\s*262px;[^}]*max-width:\s*48%/,
    );
  });

  it('leaves the desktop merge page on its 28px inset', () => {
    expect(desktopLayer(PANELS_CSS)).toMatch(/\.chq-contacts-merge-page\s*\{[^}]*padding-left:\s*28px/);
  });

  it('leaves the desktop pipeline board a five-column grid', () => {
    expect(desktopLayer(PANELS_CSS)).toMatch(
      /\.chq-contacts-pipeline-columns\s*\{[^}]*grid-template-columns:\s*repeat\(5, 1fr\)/,
    );
  });

  it('keeps the phone-only strip and list hidden at desktop', () => {
    const desktop = desktopLayer(PANELS_CSS);
    expect(desktop).toMatch(/\.chq-contacts-pipeline-phone-stages\s*\{[^}]*display:\s*none/);
    expect(desktop).toMatch(/\.chq-contacts-pipeline-phone-list\s*\{[^}]*display:\s*none/);
  });
});
