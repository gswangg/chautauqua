// v12m-w21-m (DEC-613 wave-21 ruling; Contacts audit `docs/design/audit/
// contacts-v12.md` Finding 4, parked "for whoever owns modal-frame.css"):
// at 390 the shared `.chq-modal-title` (ModalFrame, DEC-651 -- every
// dialog in the app shares this one header) must adopt the SAME phone
// drill register every other full-screen drill head already carries
// (`.chq-phone-head-drill .chq-page-title`, styles.css) -- not the frozen
// desktop 23px size.
//
// POPULATION (DEC-180 -- a universal needs a population): every
// `ModalFrame` call site under app/src, enumerated by grep, was checked
// against every `docs/design/*.dc.html` frame for a drawn 390-width
// (`width:390px; height:844px`) dialog. Only Contacts draws one, at four
// call sites, and all four agree on one register --
// `font-size:25px; font-weight:700; letter-spacing:-0.04em;
// line-height:1.05` -- verbatim-quoted below:
//   - ContactDrawer   -- Chautauqua Contacts.dc.html:410 "Priya Raman"
//   - PipelineBoard   -- Chautauqua Contacts.dc.html:450 "Pipeline"
//   - ImportWizard    -- Chautauqua Contacts.dc.html:490 "Match the columns"
//   - MergePage       -- Chautauqua Contacts.dc.html:525 "Merge two records"
// Every other ModalFrame call site (ConfirmDialog, EventSwitcher,
// pages/Agenda.tsx, agenda/BreaksPanel, comms/ComposeWizard,
// contacts/AddToEventModal, contacts/BulkEmailModal, contacts/NewContactModal,
// content/UploadRejectedModal, forms/FieldModal, settings/PeopleRolesPanel,
// settings/ResourcesPanel, speakers/RemindPreviewModal, speakers/ResponseModal,
// speakers/RosterPanel, speakers/TaskModal, speakers/TaskView,
// submissions/NewSubmissionModal, submissions/ViewTabs) has NO 390-width
// dialog frame drawn anywhere in docs/design/*.dc.html -- every occurrence
// of that dialog's title in the pack sits inside a 440-560px-wide desktop
// container, at the frozen 23px register the top-level `.chq-modal-title`
// rule already matches. So this is one register, not the two-register
// split a control floor would need (DEC-613): no drawn frame contradicts
// the phone-drill size, there is nothing to flatten.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments as stripComments } from '../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const MODAL_FRAME_CSS = readFileSync(join(HERE, './modal-frame.css'), 'utf-8');
const STYLES_CSS = readFileSync(join(HERE, '../styles.css'), 'utf-8');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched so a nested rule can never end the block early. Copied
 * from modal-frame-phone.test.ts's own helper, this file's sibling. */
function phoneLayer(css: string): string {
  const clean = stripComments(css);
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(clean)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth += 1;
      else if (clean[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(clean.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripComments(css).replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(withoutMedia);
  if (!m || m[1] === undefined) throw new Error(`no top-level rule for ${selector}`);
  return m[1];
}

function declValue(body: string, prop: string): string {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);?`).exec(body);
  if (!m) throw new Error(`no ${prop} declaration in: ${body}`);
  return m[1]!.trim();
}

/** DEC-967 shape: read the ACTUAL design-file line, assert it byte-for-byte
 * matches the literal this file claims. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

describe('v12m-w21-m: .chq-modal .chq-modal-title adopts the phone drill register at 390', () => {
  it('is 23px at top level (desktop, frozen -- DEC-385 single-direction)', () => {
    const body = topLevelRuleBody(MODAL_FRAME_CSS, '.chq-modal .chq-modal-title');
    expect(declValue(body, 'font-size')).toBe('23px');
    expect(() => declValue(body, 'letter-spacing')).toThrow();
  });

  it('is the phone-drill token pair inside the max-width phone block, never a literal figure', () => {
    const body = phoneRule(MODAL_FRAME_CSS, '.chq-modal .chq-modal-title');
    expect(declValue(body, 'font-size')).toBe('var(--chq-type-page-title-phone-drill)');
    expect(declValue(body, 'letter-spacing')).toBe('var(--chq-type-page-title-tracking)');
  });

  it('the two tokens resolve to the exact figures the frame draws (25px/700/-0.04em/1.05)', () => {
    expect(STYLES_CSS).toMatch(/--chq-type-page-title-phone-drill:\s*25px;/);
    expect(STYLES_CSS).toMatch(/--chq-type-page-title-tracking:\s*-0\.04em;/);
  });

  it('declares no min-width media query in modal-frame.css (DEC-385 single-direction)', () => {
    expect(stripComments(MODAL_FRAME_CSS)).not.toMatch(/@media[^{]*min-width/);
  });

  describe('population: all four Contacts 390 drill heads agree on one register', () => {
    it('ContactDrawer -- Chautauqua Contacts.dc.html:410 "Priya Raman"', () => {
      verbatimLine(
        410,
        '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Priya Raman</h1>',
      );
    });

    it('PipelineBoard -- Chautauqua Contacts.dc.html:450 "Pipeline"', () => {
      verbatimLine(
        450,
        '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Pipeline</h1>',
      );
    });

    it('ImportWizard -- Chautauqua Contacts.dc.html:490 "Match the columns"', () => {
      verbatimLine(
        490,
        '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Match the columns</h1>',
      );
    });

    it('MergePage -- Chautauqua Contacts.dc.html:525 "Merge two records"', () => {
      verbatimLine(
        525,
        '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Merge two records</h1>',
      );
    });
  });
});
