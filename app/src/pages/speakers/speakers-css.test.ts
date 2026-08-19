// DEC-880/DEC-940: .chq-participation-menu-trigger sits after
// .chq-speakers-status(-*) in source order and, because ParticipationMenu.tsx
// puts both `chq-speakers-status chq-speakers-status-<mod>` and
// `chq-participation-menu-trigger` on one <button>, any declaration the
// trigger rule shares with those selectors wins the cascade at equal
// specificity. This has collided three times: `border: none` erased three of
// the four DEC-730 outlines; `background`/`padding`/`font` then erased the
// Complete fill, the shared box metrics and the 11px/700 type entirely. The
// fix is that the trigger rule declares NONE of background/padding/font/
// border -- only appearance + cursor, which nothing else in this family
// touches. jsdom does not apply an external stylesheet (see
// page-measure.test.ts / shell-geometry.test.ts), so this reads the
// stylesheet's own text and asserts on the declarations directly rather than
// rendering + measuring computed style.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'speakers.css');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const STATUS_MODIFIERS = [
  'chq-speakers-status-complete',
  'chq-speakers-status-pending',
  'chq-speakers-status-overdue',
  'chq-speakers-status-invited',
  'chq-speakers-status-none',
];

// Design pack v12: the modifiers that still PAINT a box -- a fill or a rule.
// Everything else in the family is now bare text.
const BOXED_MODIFIERS = [
  'chq-speakers-status-overdue',
  'chq-speakers-status-invited',
  'chq-speakers-status-none',
  'chq-speakers-status-neutral',
];

// The two states v12 stripped to bare text: complete recedes and pending is
// bold ink, so neither may carry a fill, a border or a radius at ANY density.
const BARE_MODIFIERS = ['chq-speakers-status-complete', 'chq-speakers-status-pending'];

describe('speakers.css participation chip vs. trigger reset (DEC-880/DEC-940)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('the trigger rule declares neither background, padding, font, nor border', () => {
    const body = topLevelRuleBody(css, '.chq-participation-menu-trigger');
    expect(body).not.toMatch(/\bbackground:/);
    expect(body).not.toMatch(/\bpadding:/);
    expect(body).not.toMatch(/\bfont(-\w+)?:/);
    expect(body).not.toMatch(/\bborder(-\w+)?:/);
  });

  it('the trigger rule still resets button chrome the chip does not want (appearance/cursor)', () => {
    const body = topLevelRuleBody(css, '.chq-participation-menu-trigger');
    expect(body).toMatch(/appearance:\s*none/);
    expect(body).toMatch(/cursor:\s*pointer/);
  });

  // v12 moved padding and border-radius OFF the base rule and onto the two
  // density variants + the boxed modifiers, because the family now has two
  // independent axes. What the base must still own is the shared TYPE, which
  // is what the DEC-880/DEC-940 collisions kept erasing.
  it('the base chip declares the shared type every state needs, and no geometry of its own', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status');
    expect(body).toMatch(/font-size:\s*11px/);
    expect(body).toMatch(/font-family:/);
    expect(body).toMatch(/text-transform:\s*uppercase/);
    expect(body).not.toMatch(/\bpadding:/);
    expect(body).not.toMatch(/border-radius:/);
  });
});

// Design pack v12 -- STATUS WEIGHT INVERSION. "Weight goes to the exception,
// never to the resting state": complete is 30-odd of 42 cells in the seeded
// event, so a filled-olive complete made a wall of the one status nobody
// needs to act on and buried the three that mattered. Overdue takes the fill
// instead; pending is bold ink; complete recedes to muted 600.
describe('speakers.css status weight inversion (design pack v12)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('OVERDUE is the filled mark -- ink background, never an outline', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-overdue');
    expect(body).toMatch(/background:\s*var\(--chq-ink\)/);
    expect(body).toMatch(/color:\s*var\(--chq-on-ink\)/);
    expect(body).toMatch(/font-weight:\s*800/);
    expect(body).toMatch(/border:\s*none/);
  });

  it('PENDING is bold ink with no fill and no rule', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-pending');
    expect(body).toMatch(/color:\s*var\(--chq-ink\)/);
    expect(body).toMatch(/font-weight:\s*800/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/border:\s*none/);
  });

  it('COMPLETE recedes -- muted 600 text, no fill and no border', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-complete');
    expect(body).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(body).toMatch(/font-weight:\s*600/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/border:\s*none/);
  });

  // The token that must NOT reappear here: --chq-disabled fails the 4.5
  // floor at 3.06:1, and DESIGN-RULINGS names a "finished" value rendered in
  // it as one of the three escapes to distrust. Complete de-emphasises by
  // dropping 800 -> 600 and keeping a readable colour.
  it('no status modifier de-emphasises with the disabled token', () => {
    for (const modifier of [...STATUS_MODIFIERS, 'chq-speakers-status-neutral']) {
      expect(topLevelRuleBody(css, `.${modifier}`)).not.toMatch(/var\(--chq-disabled\)/);
    }
  });

  it.each(BARE_MODIFIERS)('%s carries no border-radius, at either density', (modifier) => {
    // A radius is only ever declared for the boxed modifiers, so a bare
    // state can never acquire one by sharing a selector list with them.
    const radiusSelectors = css.match(/^[^@{}]*\{[^}]*border-radius[^}]*\}/gm) ?? [];
    for (const rule of radiusSelectors) {
      const selector = rule.slice(0, rule.indexOf('{'));
      if (selector.includes(modifier)) throw new Error(`${modifier} takes a border-radius in: ${selector.trim()}`);
    }
  });

  it.each(BOXED_MODIFIERS)('%s keeps a radius, since it paints a box', (modifier) => {
    expect(css).toMatch(new RegExp(`\\.${modifier}[^{]*\\{[^}]*border-radius`));
  });
});

// v12 ruling: "Status tokens pair by density, not by device." The dense
// variant fits a 178px matrix column twelve times over; the roomy variant is
// for anywhere a row is a real target. Colour and weight are identical in
// both -- ONLY geometry differs. The ruling also names the regression that
// follows from editing one half alone, so both halves are pinned together.
describe('speakers.css dense/roomy status pairing (design pack v12)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('the dense half is geometry only -- no colour, weight or fill', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-dense');
    expect(body).toMatch(/padding:\s*3px 0/);
    expect(body).not.toMatch(/\bcolor:/);
    expect(body).not.toMatch(/font-weight:/);
    expect(body).not.toMatch(/\bbackground:/);
  });

  it('the roomy half reaches the 44px floor with min-height AND horizontal padding', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-roomy');
    expect(body).toMatch(/min-height:\s*44px/);
    // Padding alone does not reach the floor, and without padding the hit box
    // is only as wide as the text -- the ruling requires both.
    expect(body).toMatch(/padding:\s*0 10px/);
    expect(body).not.toMatch(/\bcolor:/);
    expect(body).not.toMatch(/font-weight:/);
  });

  it('the roomy half never authors a min-height below the 44px floor', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-roomy');
    const declared = body.match(/min-height:\s*(\d+)px/);
    expect(declared).not.toBeNull();
    expect(Number(declared?.[1])).toBeGreaterThanOrEqual(44);
  });

  it('both halves exist -- neither may be edited away without the other', () => {
    expect(() => topLevelRuleBody(css, '.chq-speakers-status-dense')).not.toThrow();
    expect(() => topLevelRuleBody(css, '.chq-speakers-status-roomy')).not.toThrow();
  });
});

// DEC-730 amendment (wave 39, revised wave 19): matrix header inverts the
// frame's emphasis -- task TITLE gets sentence-case ink, the DUE/REQUIRED
// second line keeps the shared 11px uppercase-muted register, and the header
// row closes with a 2px ink rule (docs/design/README.md: "one 2px rule per
// section"). The wave-39 note read the title as "~15px"; DEC-730's wave-19
// amendment corrects that against the vendored frame -- Chautauqua
// Speakers.dc.html:80 is 12px/700/line-height:1.25, and "a header row whose
// titles run 25% larger than the pack eats vertical space in the one row
// whose job is labelling".
describe('speakers.css matrix header register (DEC-730 amendment, wave 39/19)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('the task title is sentence-case ink at the frame 12px, not uppercase-muted', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-task-title');
    expect(body).toMatch(/font-size:\s*12px/);
    expect(body).toMatch(/font-weight:\s*700/);
    expect(body).toMatch(/line-height:\s*1\.25/);
    expect(body).toMatch(/text-transform:\s*none/);
    expect(body).toMatch(/color:\s*var\(--chq-ink\)/);
  });

  it('the due/required line keeps the uppercase-muted micro-label register', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-task-due');
    expect(body).toMatch(/text-transform:\s*uppercase/);
    expect(body).toMatch(/color:\s*var\(--chq-muted\)/);
  });

  it('the header row closes with a 2px ink rule, not the shared 1px hairline', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-grid thead th');
    expect(body).toMatch(/border-bottom:\s*2px solid var\(--chq-ink\)/);
  });
});

// DEC-385: the toolbar's 13px control shrink is single-direction -- it is the
// BASE rule and the phone block restores the 44px tap target. Because
// `.chq-speakers-toolbar .chq-input` outranks the bare `.chq-input` phone
// rule in styles.css, dropping the restore here would silently shrink every
// toolbar control to a sub-44px target at 390px.
describe('speakers.css toolbar control shrink is max-width-only (DEC-385)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('declares no min-width media query anywhere', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/min-width\s*:\s*[0-9.]+px\s*\)/);
  });

  it('shrinks the toolbar controls at the top level, not inside a media block', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-toolbar .chq-input,\n.chq-speakers-toolbar .chq-select');
    expect(body).toMatch(/font-size:\s*13px/);
    expect(body).toMatch(/min-height:\s*0/);
  });

  it('restores the 44px tap target for those same controls inside the 700px phone block', () => {
    const phone = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/)?.[1];
    if (phone === undefined) throw new Error('no @media (max-width: 700px) block found in speakers.css');
    const restore = phone.match(
      /\.chq-speakers-toolbar \.chq-input,\s*\.chq-speakers-toolbar \.chq-select\s*\{([^}]*)\}/,
    )?.[1];
    if (restore === undefined) throw new Error('the phone block does not restate the toolbar control rule');
    expect(restore).toMatch(/min-height:\s*44px/);
  });
});

// User-filed (screenshot of /admin/speakers/<id>): "the row of chips and
// buttons also looks inconsistent here", then USER RULING: the participation
// control moved up beside the name at its natural chip size, and the actions
// row is Email + Remind alone on the frame's one 46px box (docs/design/
// Chautauqua Speakers.dc.html:352-353). Pinned in CSS text (jsdom applies no
// external stylesheet); the roster grid's chips keep their table metrics.
describe('speaker-detail action row is one control height (user-filed)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('pins ONE min-height across the row’s two buttons', () => {
    const rule = css.match(/\.chq-speaker-detail-actions > \.chq-btn \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toMatch(/min-height:\s*46px/);
  });

  it('leaves the state chip at its natural size — no row-scoped trigger overrides remain', () => {
    // The inflated-chip cure was rejected by the user; the trigger must not
    // be box-grown or re-padded anywhere in this stylesheet.
    expect(css).not.toMatch(/\.chq-speaker-detail-actions[^{]*\.chq-participation-menu-trigger/);
    // v12: "natural size" is now the DENSE half of the token pair, which is
    // what ParticipationMenu asks for on every surface. The roomy half is
    // reserved for the task rows below, which are real targets.
    expect(topLevelRuleBody(css, '.chq-speakers-status-dense')).toMatch(/padding:\s*3px 0/);
  });

  it('keeps the row centred so the three controls share a baseline', () => {
    const body = topLevelRuleBody(css, '.chq-speaker-detail-actions');
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
  });
});

// User-filed (gate-5 cycle): the toolbar shrink's padding SHORTHAND wiped
// the select caret clearance — labels ran under the caret glyph.
describe('speakers toolbar selects keep caret clearance', () => {
  it('re-states padding-right after the shorthand shrink', () => {
    const css = readFileSync(CSS_PATH, 'utf-8');
    const rule = css.match(/\.chq-speakers-toolbar \.chq-select \{[^}]*padding-right: 36px[^}]*\}/);
    expect(rule).not.toBeNull();
  });
});

// Caught in the sandbox, not by a test: TaskView.tsx rendered every OVERDUE
// as plain text because it imported only its own task-view.css. jsdom applies
// no external stylesheet, so no render test can see this -- the classes were
// all correct, the rules simply were not on the page. The invariant is
// structural: any module that reaches for the shared .chq-speakers-status
// family must import the stylesheet that defines it.
describe('every user of the shared status family imports speakers.css', () => {
  const files = readdirSync(HERE)
    .filter((f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.'))
    .map((f) => ({ name: f, src: readFileSync(join(HERE, f), 'utf-8') }));

  // The entry points that MOUNT a surface -- the ones a route renders
  // directly. A leaf component (TaskCell, ParticipationMenu) is always
  // rendered inside one of these, so the import belongs on the page.
  const PAGE_ENTRY_POINTS = ['SpeakerDetailPage.tsx', 'TaskView.tsx'];

  it.each(PAGE_ENTRY_POINTS)('%s imports speakers.css', (name) => {
    const file = files.find((f) => f.name === name);
    if (!file) throw new Error(`no such module: ${name}`);
    expect(file.src).toMatch(/import '\.\/speakers\.css'/);
  });

  it('names every module that uses the family, so a new page cannot be missed', () => {
    // A module "uses the family" when it builds one of these class strings
    // itself or calls the helper that does. Leaf components are excluded by
    // name (they never own a route); everything else must be an entry point
    // above, or this test fails and the list gets updated deliberately.
    const LEAVES = ['TaskCell.tsx', 'ParticipationMenu.tsx'];
    const users = files
      .filter((f) => /statusCellClass\(|participationStatusClass\(|chq-speakers-status/.test(f.src))
      .map((f) => f.name)
      .filter((n) => !LEAVES.includes(n))
      .sort();
    expect(users).toEqual([...PAGE_ENTRY_POINTS].sort());
  });
});
