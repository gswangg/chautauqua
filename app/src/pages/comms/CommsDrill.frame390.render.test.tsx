// w31-d (DEC-976 wave-31): the frame's FIRST markup-level verdict for
// "Templates · 390" (docs/design/Chautauqua Comms.dc.html:286-326) and
// "Send history · 390" (:335-354). Until this file, both frames were cited
// only by comms-drill-390-counts.test.ts / comms-drill-phone-frames.test.ts
// (source-scan pins over TemplatesTab.tsx/HistoryTab.tsx/templates.css TEXT)
// and by the product source itself -- never by a real-mount verdict.
// "Send history · 390" is the second-worst unclaimed frame in the
// population (4 of 8 drawn literals asserted before this file).
//
// This file renders the REAL routes -- the exact mounts
// TemplatesTab.render.test.tsx and HistoryTab.render.test.tsx already use,
// never a second mock stack (DEC-663) -- and asserts every non-template
// drawn literal, in drawn order, either as a literal (structural copy) or
// by SHAPE (sample data, DEC-967 wave-27: "a staleness detector that reads
// ONE gap grammar certifies every other stale row as fresh" -- the frame's
// own sample strings, `{{ }}` rows and merge-field examples are graded by
// shape only, never pinned).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesTab } from './TemplatesTab';
import { HistoryTab } from './HistoryTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import { DEC_976, DEC_385, DEC_967, DEC_993 } from '../../../../src/decisions';
import type { EmailTemplate, EmailBatchRow } from './types';

void DEC_976;
void DEC_385;
void DEC_967;
void DEC_993;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Mirrors MergePage.frame390.render.test.tsx's
 * own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

afterEach(() => {
  cleanup();
});

const EVENT_ID = 'evt-comms-drill-390';

function template(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tpl-acceptance',
    eventId: EVENT_ID,
    name: 'Acceptance',
    subject: 'You are speaking at {event_name}!',
    bodyText: "Hi {speaker_name}, congratulations. Your session '{talk_title}' has been accepted.",
    lastUsedAt: 1700000000000,
    ...overrides,
  };
}

function batch(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'Your talk has been accepted',
    sentAt: 1700000000000,
    statusCounts: { sent: 12 },
    templateId: 'tpl-acceptance',
    ...overrides,
  };
}

describe('v12 frame render verdict "Templates · 390" (docs/design/Chautauqua Comms.dc.html:286-326, task w31-d, DEC-976 wave-31)', () => {
  it('renders every drawn body element from the real Templates tab', async () => {
    // :288 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Comms</a>`
    verbatimLine(
      288,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Comms</a>',
    );
    // :289 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Templates</h1>`
    verbatimLine(
      289,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Templates</h1>',
    );
    // :290 `<span style="font-size:13px; color:#565A4B">5 saved</span>` -- SHAPE-graded (DEC-967), never the literal "5".
    verbatimLine(290, '        <span style="font-size:13px; color:#565A4B">5 saved</span>');
    // :299 the per-row bordered 44px Open chip.
    verbatimLine(
      299,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Open</span>',
    );
    // :302 the "Insert a field · open" reference block header.
    verbatimLine(
      302,
      '        <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; overflow:hidden; margin-bottom:4px">',
    );
    // :311 the section header carrying the frame's "Acceptance · subject" sample -- SAMPLE DATA (DEC-967), no literal pin.
    verbatimLine(
      311,
      '        <div style="padding:18px 0 8px; border-bottom:2px solid #1B1D17">',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        template(),
        template({ id: 'tpl-decline', name: 'Decline', subject: 'An update on your submission', lastUsedAt: null }),
      ]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    // :288 -- exactly one 44px-floored back link, real accessible name.
    const back = await screen.findByRole('button', { name: '‹ Comms' });
    expect(back).toHaveClass('chq-comms-templates-breadcrumb');

    // :289 -- exactly one <h1> reading the frame's literal title.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Templates' })).toBeInTheDocument();

    // :290 -- the phone-only count line, SHAPE-matched ("<n> saved"),
    // never the frame's own "5" (this fixture seeds 2 templates).
    const countLine = document.querySelector('.chq-comms-templates-head-count');
    expect(countLine).not.toBeNull();
    expect(countLine!.textContent).toMatch(/^\d+ saved$/);
    expect(countLine!.textContent).toBe('2 saved');

    // :292-:300 -- per-row name/detail/used-eyebrow stack with a bordered
    // 44px Open chip at the row's right, all inside the SAME row.
    await waitFor(() => {
      expect(screen.getByText('Acceptance', { selector: '.chq-comms-template-name' })).toBeInTheDocument();
    });
    const acceptanceRow = screen
      .getByText('Acceptance', { selector: '.chq-comms-template-name' })
      .closest('tr') as HTMLElement;
    expect(within(acceptanceRow).getByText(/^Used for accepted submissions · /)).toHaveClass(
      'chq-comms-template-detail',
    );
    expect(within(acceptanceRow).getByText(/^Last used /)).toHaveClass('chq-comms-template-last-used');
    const declineRow = screen
      .getByText('Decline', { selector: '.chq-comms-template-name' })
      .closest('tr') as HTMLElement;
    expect(within(declineRow).getByText('Not used yet')).toHaveClass('chq-comms-template-last-used');
    const openChip = within(acceptanceRow).getByText('Open', { selector: '.chq-comms-template-open' });
    expect(openChip).toHaveAttribute('aria-hidden', 'true');

    // :292-:300 opened editor -- opening Templates auto-selects the first
    // template (DEC-890 amendment wave 4), so the editor is already open.
    await waitFor(() => {
      expect(document.querySelector('.chq-comms-editor')).not.toBeNull();
    });

    // The eyebrow IS the template's own name -- never the frame's compound
    // "Acceptance · subject" string, which does not exist as one DOM node
    // anywhere in this tree (see docs/design/audit/comms-drill-390-v12.md,
    // DIVERGES row 1).
    expect(screen.getByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' })).toBeInTheDocument();
    expect(screen.queryByText(/Acceptance · subject/)).toBeNull();
    expect(screen.queryByText('Acceptance · subject')).toBeNull();

    // Subject/Body fields carry the SELECTED template's own stored text,
    // shape-matched against the merge-field grammar (`{field}`), never the
    // frame's own literal sample strings.
    const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
    expect(subjectInput.value).toMatch(/\{[a-z_]+\}/);
    expect(subjectInput.value).not.toBe('Your talk has been accepted to {event_name}');
    const bodyTextarea = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(bodyTextarea.value).toMatch(/\{[a-z_]+\}/);

    // :302-:307 -- DEC-993 governs the frame's static "Insert a field ·
    // open" reference list: the product renders ONE 'Insert a field'
    // trigger (a closed dropdown, not an always-open row list), the same
    // merge-field vocabulary. Real shape asserted, never the frame's
    // literal header text (which the product does not print) or its
    // sample tag/example rows (SAMPLE DATA, DEC-967).
    const trigger = screen.getByRole('button', { name: 'Insert a field' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByText('Insert a field · open')).toBeNull();

    fireEvent.click(trigger);
    const panel = screen.getByRole('menu', { name: 'Insert a field' });
    const items = within(panel).getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const token = item.querySelector('.chq-insert-field-menu-item-token');
      const sample = item.querySelector('.chq-insert-field-menu-item-sample');
      expect(token, 'each row carries a {tag} token').not.toBeNull();
      expect(token!.textContent).toMatch(/^\{[a-z_]+\}$/);
      expect(sample, 'each row carries a sample value beside its tag').not.toBeNull();
      expect(sample!.textContent).not.toBe('');
    }
  });

  it('44px floor: the back link and per-row Open chip floor at >=44px inside templates.css\'s terminal phone block', () => {
    const cssPath = join(HERE, 'templates.css');
    const css = readFileSync(cssPath, 'utf-8');

    // DEC-385 single-direction: the file's LAST top-level construct must be
    // the terminal @media (max-width: 700px) block.
    const lastMediaOpen = css.lastIndexOf('@media (max-width: 700px)');
    expect(lastMediaOpen).toBeGreaterThan(-1);
    const openBrace = css.indexOf('{', lastMediaOpen);
    let depth = 1;
    let i = openBrace + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    expect(depth).toBe(0);
    expect(css.slice(i).trim()).toBe('');
    const phoneLayer = stripCssComments(css.slice(openBrace + 1, i - 1));

    function ruleBody(selector: string): string {
      const rule = /([^{}]+)\{([^{}]*)\}/g;
      const bodies: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = rule.exec(phoneLayer)) !== null) {
        const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]!);
      }
      expect(bodies.length, `expected a rule for ${selector}`).toBeGreaterThan(0);
      return bodies.join('\n');
    }

    const backFloor = ruleBody('.chq-comms-templates-breadcrumb').match(/min-height:\s*(\d+)px/);
    expect(backFloor).not.toBeNull();
    expect(Number(backFloor![1])).toBeGreaterThanOrEqual(44);

    const nameFloor = ruleBody('.chq-comms-template-name').match(/min-height:\s*(\d+)px/);
    expect(nameFloor).not.toBeNull();
    expect(Number(nameFloor![1])).toBeGreaterThanOrEqual(44);
  });

  it("comms.css's Open chip and Cancel/Delete phone geometry floor at >=44px -- read-only receipt, comms.css is a sibling lane's file (HARD BAN)", () => {
    const cssPath = join(HERE, 'comms.css');
    const css = stripCssComments(readFileSync(cssPath, 'utf-8'));

    function ruleBody(selector: string): string {
      const rule = /([^{}]+)\{([^{}]*)\}/g;
      const bodies: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = rule.exec(css)) !== null) {
        const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]!);
      }
      expect(bodies.length, `expected a rule for ${selector}`).toBeGreaterThan(0);
      return bodies.join('\n');
    }

    const openChipFloor = ruleBody('.chq-comms-template-open').match(/min-height:\s*(\d+)px/);
    expect(openChipFloor).not.toBeNull();
    expect(Number(openChipFloor![1])).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 frame render verdict "Send history · 390" (docs/design/Chautauqua Comms.dc.html:335-354, task w31-d, DEC-976 wave-31)', () => {
  it('renders every drawn body element from the real History tab', async () => {
    // :337 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Comms</a>`
    verbatimLine(
      337,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Comms</a>',
    );
    // :338 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">History</h1>`
    verbatimLine(
      338,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">History</h1>',
    );
    // :339 `<span style="font-size:13px; color:#565A4B">57 sends · 4 in the last 7 days</span>` -- SHAPE-graded (DEC-967).
    verbatimLine(339, '        <span style="font-size:13px; color:#565A4B">57 sends · 4 in the last 7 days</span>');
    // :350 the per-row full-width bordered 44px "See the recipients" control.
    verbatimLine(
      350,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">See the recipients</span>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope(
        [
          batch({ batchKey: 'batch-1', subject: 'Your talk has been accepted', templateId: 'tpl-acceptance' }),
          batch({ batchKey: 'batch-2', subject: 'A quick reminder', sentAt: 1700100000000, templateId: null }),
        ],
        { total: 57 },
      ),
    });

    render(
      <MemoryRouter>
        <HistoryTab
          eventId={EVENT_ID}
          templatesById={{ 'tpl-acceptance': 'Acceptance' }}
          rhythm={{ sentLast7Days: 4, failedLast7Days: 0, lastSentAt: 1700000000000 }}
        />
      </MemoryRouter>,
    );

    // :337 -- exactly one 44px-floored back link.
    const back = await screen.findByRole('button', { name: '‹ Comms' });
    expect(back).toHaveClass('chq-comms-history-breadcrumb');

    // :338 -- exactly one <h1> reading the frame's literal title.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument();

    // :339 -- the count clause, SHAPE-matched ("<n> sends · <n> in the last
    // <n> days"), never the frame's own literal "57 sends · 4 in the last
    // 7 days" pinned as a value (this fixture's own total happens to be 57
    // to exercise the real code path, but the assertion is the shape).
    await screen.findByText('Your talk has been accepted');
    const countClause = document.querySelector('.chq-comms-history-titles .chq-comms-head-subtitle')!;
    expect(countClause.textContent).toMatch(/^\d+ sends · \d+ in the last \d+ days$/);

    // :343-:351 -- per-row when/count/subject/template stack, one row per
    // batch, plus the full-width bordered 44px recipients control on EVERY
    // row (not just the first).
    const rows = document.querySelectorAll('.chq-comms-batch-row:not(.chq-comms-batch-col-heads-row)');
    expect(rows.length).toBe(2);
    for (const row of Array.from(rows)) {
      expect(row.querySelector('.chq-comms-history-when'), 'when').not.toBeNull();
      expect(row.querySelector('.chq-comms-batch-count'), 'count').not.toBeNull();
      expect(row.querySelector('.chq-comms-history-subject'), 'subject').not.toBeNull();
      expect(row.querySelector('.chq-comms-batch-template'), 'template').not.toBeNull();
      const toggle = row.querySelector('.chq-comms-batch-toggle-recipients');
      expect(toggle, 'recipients toggle').not.toBeNull();
      const phoneLabel = toggle!.querySelector('.chq-comms-batch-toggle-label-phone');
      expect(phoneLabel, ':350 phone label').not.toBeNull();
      expect(phoneLabel!.textContent).toBe('See the recipients');
    }

    // The batch with no template resolves the template column to an em
    // dash, never a blank cell or a fabricated name.
    const secondRow = screen.getByText('A quick reminder').closest('.chq-comms-batch-row') as HTMLElement;
    expect(within(secondRow).getByText('—')).toHaveClass('chq-comms-batch-template');
  });

  it("44px floor: comms.css's phone geometry floors every row's recipients control at >=44px, and templates.css's terminal block only tightens its border colour/radius -- both read-only receipts (comms.css is a sibling lane's file, HARD BAN)", () => {
    const commsCssPath = join(HERE, 'comms.css');
    const commsCss = stripCssComments(readFileSync(commsCssPath, 'utf-8'));

    // The shared .chq-btn base class carries the 44px floor at phone widths
    // (app/src/styles.css) -- comms.css's own phone block only stretches
    // the control full-width and swaps in the phone-only label.
    expect(commsCss).toMatch(/\.chq-comms-batch-row\s*>\s*\.chq-comms-batch-toggle,?\s*\n?\s*\.chq-comms-batch-row\s*>\s*\.chq-comms-batch-open\s*\{[^}]*width:\s*100%/);
    expect(commsCss).toMatch(/\.chq-comms-batch-toggle-label-phone\s*\{[\s\S]*?display:\s*none/);

    const templatesCssPath = join(HERE, 'templates.css');
    const templatesCss = stripCssComments(readFileSync(templatesCssPath, 'utf-8'));
    const bodyMatch = templatesCss.match(/\.chq-comms-batch-toggle-recipients\s*\{([^}]*)\}/);
    expect(bodyMatch, 'expected the border-colour/radius correction in templates.css').not.toBeNull();
    expect(bodyMatch![1]).toMatch(/border-color:\s*var\(--chq-border\)/);
    expect(bodyMatch![1]).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    // The correction narrowly touches colour/radius only -- it must not
    // also declare min-height (that floor stays owned by the shared
    // .chq-btn rule in styles.css, never duplicated here).
    expect(bodyMatch![1]).not.toMatch(/min-height/);
  });
});
