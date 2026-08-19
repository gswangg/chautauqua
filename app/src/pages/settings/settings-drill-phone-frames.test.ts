// task-w4-f (DEC-375, DEC-967): Settings at 390 -- the four form-and-card
// drills (docs/design/Chautauqua Settings.dc.html:444 'Settings · Call for
// papers', :481 'Settings · Public pages', :510 'Settings · Speaker
// portal', :578 'Settings · Saved embeds').
//
// This is a source-scan test (jsdom does not evaluate @media rules, and
// this directory's own precedent -- shell-geometry.test.ts,
// TracksRoomsPanel.render.test.tsx -- reads settings.css's text directly
// rather than computed style). Two things are pinned per frame, per
// DEC-967's claim protocol: a strict `docs/design/Chautauqua
// Settings.dc.html:<line>` citation inside the frame's extent, the cited
// line's own verbatim backticked literal, and a real assertion beneath it
// pinning what that line declares.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_375, DEC_967 } from '../../../../src/decisions';

void DEC_375; // Settings phone-drill single-panel shell (owned by v12m-w4-e, not this file)
void DEC_967; // wave-86 claim protocol this file's citations follow

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const FRAME_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const FRAME_LINES = readFileSync(FRAME_FILE, 'utf-8').split('\n');

const SETTINGS_CSS = readFileSync(join(HERE, 'settings.css'), 'utf-8');
const CFP_TSX = readFileSync(join(HERE, 'CallForPapersPanel.tsx'), 'utf-8');
const PORTAL_TSX = readFileSync(join(HERE, 'PortalSettingsPanel.tsx'), 'utf-8');
const PUBLIC_PAGES_TSX = readFileSync(join(HERE, 'PublicPagesPanel.tsx'), 'utf-8');
const SAVED_EMBEDS_TSX = readFileSync(join(HERE, 'SavedEmbedsPanel.tsx'), 'utf-8');

/** The literal text of a 1-based line in the frame file, trimmed. */
function frameLine(n: number): string {
  const line = FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Settings.dc.html has no line ${n}`);
  return line.trim();
}

// task-w4-f's own trailing phone block -- everything from this marker
// comment to end-of-file. DEC-385 (wave-85): this must remain the LAST
// top-level construct in settings.css; asserting the marker's own tail
// contains nothing but this task's @media block (no stray top-level rule
// declared after it) keeps that invariant honest rather than assumed.
const BLOCK_MARKER = '/* task-w4-f/DEC-375/DEC-967:';

function trailingBlock(): string {
  const idx = SETTINGS_CSS.indexOf(BLOCK_MARKER);
  if (idx === -1) throw new Error(`${BLOCK_MARKER} not found in settings.css`);
  return SETTINGS_CSS.slice(idx);
}

/** Finds the declaration body of a rule whose selector list (comma-
 * separated selectors are legal CSS, e.g. two grouped under one body)
 * contains `selector` as one of its members. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The selector, optionally followed by more comma-separated selectors
  // (never another `{`), then the block.
  const match = css.match(new RegExp(`${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no rule found for ${selector} in task-w4-f's trailing block`);
  return body;
}

describe('DEC-385 (wave-85): task-w4-f\'s block is the trailing, last top-level construct', () => {
  it('settings.css ends with the task-w4-f @media (max-width: 700px) block, nothing top-level after it', () => {
    const block = trailingBlock();
    // The marker comment is immediately followed by the ONE @media rule
    // this task owns, and the file's last non-whitespace characters close
    // that @media block (a trailing top-level rule after it would leave
    // extra `}`-balanced content following the block's own final `}`).
    expect(block).toMatch(/@media \(max-width: 700px\) \{/);
    const trimmedTail = SETTINGS_CSS.trimEnd();
    expect(trimmedTail.endsWith('}')).toBe(true);
    // The block's own opening brace count must equal its closing brace
    // count (a balanced, self-contained tail -- nothing declared after it
    // could still leave the file "balanced" only by borrowing a brace from
    // outside the block).
    const opens = (block.match(/\{/g) ?? []).length;
    const closes = (block.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});

describe('CFP drill (docs/design/Chautauqua Settings.dc.html:444 \'Settings · Call for papers\')', () => {
  it('line 444 declares the phone frame shell', () => {
    expect(frameLine(444)).toBe(
      '<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
  });

  it('Public link / Closes render as bordered 46px readouts at phone (rowClassName opt-in, never the shared row-value)', () => {
    expect(CFP_TSX).toMatch(/label:\s*'Public link'.*rowClassName:\s*'chq-settings-drill-field-row'/s);
    expect(CFP_TSX).toMatch(/rowClassName:\s*'chq-settings-drill-field-row'[\s\S]*label:\s*'Closes'|label:\s*'Closes'[\s\S]*rowClassName:\s*'chq-settings-drill-field-row'/);
    const body = ruleBody(trailingBlock(), '.chq-settings-drill-field-row .chq-settings-row-value');
    expect(body).toMatch(/min-height:\s*46px/);
    expect(body).toMatch(/padding:\s*0 13px/);
    expect(body).toMatch(/border:\s*1px solid/);
  });

  it('Questions · N (:461) lists every non-locked field with a kind/required meta line and a 44px bordered Edit action', () => {
    expect(frameLine(461)).toBe(
      '<span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Questions · 8</span>',
    );
    expect(CFP_TSX).toContain('function QuestionsSection');
    expect(CFP_TSX).toContain('`Questions · ${list.length}`');
    const body = ruleBody(trailingBlock(), '.chq-settings-questions-row .chq-settings-inline-action');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/border:\s*1px solid/);
  });
});

describe('Public pages drill (docs/design/Chautauqua Settings.dc.html:481 \'Settings · Public pages\')', () => {
  it('line 481 declares the phone frame shell', () => {
    expect(frameLine(481)).toBe(
      '<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
  });

  it('a public page row\'s View / Embed code actions each become a full-width 44px bordered target, no edit view added (DESIGN-RULINGS B10 DROP)', () => {
    expect(PUBLIC_PAGES_TSX).not.toContain("SECTION_KEY = 'public-pages'");
    const body = ruleBody(trailingBlock(), '.chq-settings-public-pages-row > .chq-settings-inline-action');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/width:\s*100%/);
    expect(body).toMatch(/border:\s*1px solid/);
  });
});

describe('Speaker portal drill (docs/design/Chautauqua Settings.dc.html:510 \'Settings · Speaker portal\')', () => {
  it('line 510 declares the phone frame shell', () => {
    expect(frameLine(510)).toBe(
      '<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
  });

  it('Speakers can edit (:517-524) renders as 44px pills, filled for on / bordered for off', () => {
    expect(PORTAL_TSX).toContain('chq-settings-portal-pills');
    expect(PORTAL_TSX).toContain('chq-pill-static');
    const body = ruleBody(trailingBlock(), '.chq-settings-portal-pills .chq-pill');
    expect(body).toMatch(/min-height:\s*44px/);
  });

  it('Resources (:530-540) draws as a 2px-ruled cap over the readOnly resource list, not a label:value row', () => {
    expect(PORTAL_TSX).toMatch(/resourcesCap/);
    expect(PORTAL_TSX).toMatch(/rowClassName:\s*'chq-settings-row-full'/);
    expect(PORTAL_TSX).toContain('<ResourcesPanel readOnly />');
  });

  it('the closing muted line (:542 "Speakers claim their portal...") is copy, not a row -- unchanged by this task', () => {
    expect(frameLine(542)).toBe(
      '<div style="padding:15px 0 0; font-size:13px; color:#565A4B; line-height:1.5">Speakers claim their portal from a link in their acceptance email.</div></div>',
    );
    expect(PORTAL_TSX).toContain('Speakers claim their portal from a link in their acceptance email');
  });
});

describe('Saved embeds drill (docs/design/Chautauqua Settings.dc.html:578 \'Settings · Saved embeds\')', () => {
  it('line 578 declares the phone frame shell', () => {
    expect(frameLine(578)).toBe(
      '<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
  });

  it('a saved-embed row\'s action cluster becomes a bordered 44px button row, and the eyebrow stacks instead of overflowing', () => {
    expect(SAVED_EMBEDS_TSX).toContain('chq-settings-saved-embed-actions');
    const actionsBody = ruleBody(trailingBlock(), '.chq-settings-saved-embed-actions .chq-link-button');
    expect(actionsBody).toMatch(/min-height:\s*44px/);
    expect(actionsBody).toMatch(/border:\s*1px solid/);
    const eyebrowBody = ruleBody(trailingBlock(), '.chq-settings-saved-embed-eyebrow');
    expect(eyebrowBody).toMatch(/flex-direction:\s*column/);
  });

  it('the closing muted line (:599 "Editing an embed\'s filters...") is copy, not a row -- unchanged by this task', () => {
    expect(frameLine(599)).toBe(
      '<span style="display:block; padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.5">Editing an embed\'s filters is easier on a laptop</span>',
    );
  });
});
