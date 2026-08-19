// v12m task w1-a (DEC-621 amendment, wave 98): closes the four gaps
// docs/design/audit/comms-drill-v12.md's "Held for a later wave" section
// named as unbuilt against docs/design/Chautauqua Comms.dc.html's
// "Templates · 390" (:288) and "Send history · 390" (:337) drill frames --
// the Templates head count line, the Templates editor dock, the History
// head count clause, and the History per-row recipients control's phone
// geometry. Every frame-derived assertion below carries a backtick-quoted
// verbatim literal from the cited line plus a real `expect(` within 6
// source lines (DEC-976).
//
// FAST tier (plain node, no jsdom/render): this file scans the .tsx/.css
// SOURCE TEXT directly, the same idiom comms-phone-floor.test.ts and
// settings-field-width.test.ts use for jsdom-less CSS/structure pins,
// rather than mounting the real components (which the sibling
// render.test.tsx suites for these same files already own). No import of
// react/testing-library/jsdom here on purpose, so this file classifies FAST
// under test/test-tiers.test.ts's derived predicate and the task's own run
// instruction (`--config vitest.fast.config.ts`) is honest about what it
// runs.
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { describe, expect, it } from 'vitest';
import { DEC_621, DEC_385 } from '../../../../src/decisions';

void DEC_621;
void DEC_385;

const FRAME_PATH = 'docs/design/Chautauqua Comms.dc.html';
const FRAME_LINES = readFileSync(FRAME_PATH, 'utf-8').split('\n');

const TEMPLATES_TAB_TSX = readFileSync(new URL('./TemplatesTab.tsx', import.meta.url), 'utf-8');
const HISTORY_TAB_TSX = readFileSync(new URL('./HistoryTab.tsx', import.meta.url), 'utf-8');
const RECENT_SENDS_TSX = readFileSync(new URL('./RecentSends.tsx', import.meta.url), 'utf-8');
const TEMPLATES_CSS = readFileSync(new URL('./templates.css', import.meta.url), 'utf-8');

// Pull a declaration body for a selector out of CSS text, comments
// stripped first (mirrors comms-phone-floor.test.ts's ruleBodyFor).
function ruleBodyFor(rawCss: string, selector: string): string {
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[{,}])\\s*${escaped}\\s*(?=[,{])[\\s\\S]*?\\{([^}]*)\\}`);
  const m = css.match(re);
  expect(m, `expected to find a rule for ${selector}`).not.toBeNull();
  const body = m?.[1];
  assert(body !== undefined);
  return body;
}

// True if the LAST top-level `@media (max-width: 700px) { ... }` block is
// also the last top-level construct in the file (brace-matched, mirrors
// comms-phone-floor.test.ts's isTerminalPhoneBlock).
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

describe('gap 1: Templates drill head count line', () => {
  // docs/design/Chautauqua Comms.dc.html:290 `<span style="font-size:13px; color:#565A4B">5 saved</span>`
  it("line 290 is the frame's literal count-line span", () => {
    const line = FRAME_LINES[290 - 1];
    expect(line).toMatch(/font-size:13px; color:#565A4B">5 saved<\/span>/);
  });

  it('mounts a phone-only count line inside .chq-phone-head-drill\'s titles wrapper, after the H1, sourced from templates.length -- and .chq-section-head\'s own "Saved · N" line is untouched', () => {
    const titlesBlockMatch = TEMPLATES_TAB_TSX.match(
      /<div className="chq-comms-templates-titles">([\s\S]*?)<\/div>\s*<button type="button" className="chq-btn chq-btn-primary" onClick={startNew}>/,
    );
    expect(titlesBlockMatch, 'expected to find the drill titles wrapper').not.toBeNull();
    const titlesBlock = titlesBlockMatch![1]!;

    const h1Index = titlesBlock.indexOf('<h1 className="chq-page-title">Templates</h1>');
    const countIndex = titlesBlock.indexOf('<span className="chq-comms-templates-head-count">{templates.length} saved</span>');
    expect(h1Index, 'expected the H1 inside the titles wrapper').toBeGreaterThanOrEqual(0);
    expect(countIndex, 'expected the count line inside the titles wrapper, sourced from templates.length').toBeGreaterThanOrEqual(0);
    expect(countIndex, 'the count line sits directly under the H1').toBeGreaterThan(h1Index);

    // The existing `.chq-section-head`'s own "Saved · N" line stays put --
    // still exactly one occurrence, unchanged.
    const savedSectionOccurrences = (TEMPLATES_TAB_TSX.match(/Saved &middot; \{templates\.length\}/g) ?? []).length;
    expect(savedSectionOccurrences).toBe(1);
  });

  it("the count line is hidden by default and shown only inside templates.css's terminal max-width:700px block (DEC-385)", () => {
    expect(isTerminalPhoneBlock(TEMPLATES_CSS)).toBe(true);

    const outerBody = ruleBodyFor(TEMPLATES_CSS, '.chq-comms-templates-head-count');
    expect(outerBody).toMatch(/display:\s*none/);

    const phoneBlockStart = TEMPLATES_CSS.indexOf('@media (max-width: 700px)');
    const phoneCss = TEMPLATES_CSS.slice(phoneBlockStart);
    const phoneBody = ruleBodyFor(phoneCss, '.chq-comms-templates-head-count');
    expect(phoneBody).toMatch(/display:\s*block/);
    expect(phoneBody).toMatch(/font-size:\s*13px/);
  });
});

describe('gap 2: Templates editor dock', () => {
  // docs/design/Chautauqua Comms.dc.html:323 `flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700`
  it("line 323 is the frame's literal primary Save control", () => {
    const line = FRAME_LINES[323 - 1];
    expect(line).toMatch(/flex:1; background:#4E5C31;.*min-height:48px/);
  });

  // docs/design/Chautauqua Comms.dc.html:324 `border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600`
  it("line 324 is the frame's literal secondary Cancel control", () => {
    const line = FRAME_LINES[324 - 1];
    expect(line).toMatch(/border:1px solid #BAB6A6; border-radius:6px;.*min-height:48px/);
  });

  it('composes .chq-phone-dock onto the EXISTING Save/Cancel wrapper -- never a second Save button, never a second save() call (DEC-547)', () => {
    expect(TEMPLATES_TAB_TSX).toMatch(/<div className="chq-comms-editor-actions chq-phone-dock">/);

    // Exactly one Save control, calling the one save() function.
    const saveButtonOccurrences = (TEMPLATES_TAB_TSX.match(/onClick={save}/g) ?? []).length;
    expect(saveButtonOccurrences).toBe(1);
    const saveLabelOccurrences = (TEMPLATES_TAB_TSX.match(/>\s*Save\s*<\/button>/g) ?? []).length;
    expect(saveLabelOccurrences).toBe(1);
  });

  it('sets data-chq-phone-dock on the page root while (and only while) the editor is open, per DEC-576 (styles.css:430 suppresses the tab bar)', () => {
    const rootMatch = TEMPLATES_TAB_TSX.match(
      /<div className="chq-comms-templates-tab" \{\.\.\.\(editingId \? \{ 'data-chq-phone-dock': true \} : \{\}\)\}>/,
    );
    expect(rootMatch, 'expected the page root to conditionally carry data-chq-phone-dock keyed on editingId').not.toBeNull();
  });
});

describe('gap 3: History drill head count clause', () => {
  // docs/design/Chautauqua Comms.dc.html:339 `<span style="font-size:13px; color:#565A4B">57 sends · 4 in the last 7 days</span>`
  it("line 339 is the frame's literal count-clause span", () => {
    const line = FRAME_LINES[339 - 1];
    expect(line).toMatch(/57 sends · 4 in the last 7 days<\/span>/);
  });

  it('extends countLine to "{total sends} · {sentLast7Days} in the last 7 days", reusing the rhythm prop already handed down -- no second fetch, and omits the clause when rhythm has not settled (DEC-678)', () => {
    expect(HISTORY_TAB_TSX).toMatch(
      /rhythm != null \? `\$\{countOf\(total, 'send'\)\} · \$\{rhythm\.sentLast7Days\} in the last 7 days` : countOf\(total, 'send'\)/,
    );

    // No new fetch was introduced: the effect's dependency array (the only
    // place a request fires) is unchanged, and `rhythm` is never one of
    // its dependencies (it is a prop, not state this component loads).
    const effectDepsMatch = HISTORY_TAB_TSX.match(/}, \[eventId, q, page, templateId\]\);/);
    expect(effectDepsMatch, 'expected the fetch effect\'s dependency array to be unchanged (no rhythm-triggered refetch)').not.toBeNull();
  });
});

describe('gap 4: History per-row recipients control', () => {
  // docs/design/Chautauqua Comms.dc.html:350 `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">See the recipients</span>`
  it("line 350 is the frame's literal full-width bordered recipients control", () => {
    const line = FRAME_LINES[350 - 1];
    expect(line).toMatch(/border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px/);
  });

  it('marks the toggle with the recipients class only on the History mount (columnHeads=true) -- the Compose mount\'s 390 frame draws no per-row control at all, so it keeps the plain class', () => {
    expect(RECENT_SENDS_TSX).toMatch(
      /columnHeads\s*\n\s*\?\s*'chq-btn chq-btn-secondary chq-comms-batch-toggle chq-comms-batch-toggle-recipients'\s*\n\s*: 'chq-btn chq-btn-secondary chq-comms-batch-toggle'/,
    );
  });

  it(".chq-comms-batch-toggle-recipients gets the frame's border colour (--chq-border, #BAB6A6) and radius (--chq-r-ctl-phone, 6px) inside templates.css's terminal phone block, without touching comms.css", () => {
    expect(isTerminalPhoneBlock(TEMPLATES_CSS)).toBe(true);

    const phoneBlockStart = TEMPLATES_CSS.indexOf('@media (max-width: 700px)');
    const phoneCss = TEMPLATES_CSS.slice(phoneBlockStart);
    const body = ruleBodyFor(phoneCss, '.chq-comms-batch-toggle-recipients');
    expect(body).toMatch(/border-color:\s*var\(--chq-border\)/);
    expect(body).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
  });
});
