// w29-a (DEC-976 wave-29): the frame's FIRST markup-level verdict for
// "Merge · 390" (docs/design/Chautauqua Contacts.dc.html:522-546). Until
// this file, the frame was cited only by MergePage.phoneFrame.test.ts
// (source-scan pins over MergePage.tsx's JSX text and contacts-panels.css's
// CSS text) and Contacts.frame-verdicts.render.test.tsx's single shallow
// `it()` (structure only, no dock-scoped control-order or 44px-floor
// receipt). This file renders the REAL route -- the exact mount copied
// verbatim from MergePage.render.test.tsx, never a second mock stack
// (DEC-663) -- and asserts DOM structure/order (jsdom applies no @media, so
// every claim here is about markup, never computed geometry) plus a static
// CSS-floor receipt for the dock controls.
//
// DEC-967 wave-29: structural copy graded by literal, sample data graded by
// SHAPE -- the pair counter and per-record names below are never pinned to
// the frame's own sample strings ("6 pairs", "Marcus Okafor").
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MergePage } from './MergePage';
import { mockApi } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Mirrors Contacts.frame-verdicts.render.test.tsx's
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contacts/merge" element={<MergePage />} />
        <Route path="/contacts" element={<div>Contacts landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// A 3+ record duplicate group: this sidesteps DEC-992's "Swap which is
// kept" control (it only renders for a two-record pair, DEC-802/DEC-992),
// so the dock renders EXACTLY the frame's own two controls -- "Merge them"
// and "Not a duplicate" -- with no third, frame-silent button in between.
const GROUP_OF_THREE = {
  contactIds: ['ct-keep', 'ct-b', 'ct-c'],
  contacts: [
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme', title: 'Principal Engineer', createdAt: Date.UTC(2024, 0, 1, 12) },
    { id: 'ct-b', firstName: 'Jan', lastName: 'Doerson', email: 'jan@example.com', company: 'Acme', createdAt: Date.UTC(2024, 5, 15, 12) },
    { id: 'ct-c', firstName: 'J', lastName: 'D', email: 'jd@example.com', company: 'Acme', createdAt: Date.UTC(2024, 5, 15, 12) },
  ],
};

const PREVIEW_FIELDS = [
  { key: 'company', label: 'Company', kept: 'Acme', discarded: ['Acme Corp'], outcome: 'keep' },
  { key: 'notes', label: 'Notes', kept: 'Met at PlatformCon.', discarded: [], outcome: 'append' },
];

describe('v12 frame render verdict "Merge · 390" (docs/design/Chautauqua Contacts.dc.html:522-546, task w29-a, DEC-976 wave-29)', () => {
  it('renders every drawn body element from the real /contacts/merge route', async () => {
    // docs/design/Chautauqua Contacts.dc.html:524 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Duplicates</a>`
    verbatimLine(
      524,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Duplicates</a>',
    );
    // docs/design/Chautauqua Contacts.dc.html:525 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Merge two records</h1>`
    verbatimLine(
      525,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Merge two records</h1>',
    );
    // docs/design/Chautauqua Contacts.dc.html:526 `<span style="font-size:13px; color:#565A4B">1 of 6 pairs · Marcus Okafor</span>`
    verbatimLine(526, '        <span style="font-size:13px; color:#565A4B">1 of 6 pairs · Marcus Okafor</span>');
    // docs/design/Chautauqua Contacts.dc.html:535 `<div style="padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.5">Labels combine, notes are appended · 3 submissions and 1 task move to the record you keep</div>`
    verbatimLine(
      535,
      '        <div style="padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.5">Labels combine, notes are appended · 3 submissions and 1 task move to the record you keep</div></div>',
    );
    // docs/design/Chautauqua Contacts.dc.html:537 `...>Merge them</span>`
    verbatimLine(
      537,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Merge them</span>',
    );
    // docs/design/Chautauqua Contacts.dc.html:538 `<span style="border:1px solid #BAB6A6; border-radius:6px; ...">Not a duplicate</span>`
    verbatimLine(
      538,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Not a duplicate</span>',
    );

    mockApi({
      'GET /api/v1/contacts/duplicates': { items: [GROUP_OF_THREE], total: 6, page: 1, perPage: 20, position: 1 },
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS, impact: { submissions: 3, tasks: 1 } },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-b,ct-c&keep=ct-keep');

    // :525 -- exactly one <h1> reading the frame's literal title.
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Merge two records' })).toBeInTheDocument();

    // :524 -- exactly one back anchor; the phone rule blanks the
    // "Contacts · " prefix span via CSS only (DEC-385), so jsdom still
    // renders it in the DOM. Assert on the anchor's OWN trailing text
    // (its accessible name, which ends in "Duplicates"), never innerText
    // equality against the frame's phone-collapsed string.
    const backLinks = screen.getAllByRole('link', { name: /Duplicates$/ });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]!.textContent).toMatch(/Duplicates$/);

    // :526 -- the pair counter, shape-matched (never the frame's literal
    // "1 of 6 pairs · Marcus Okafor" sample), landing in ONE element.
    await waitFor(() => {
      const counter = document.querySelector('.chq-contacts-merge-pair-count');
      expect(counter).not.toBeNull();
      expect(counter!.textContent).toMatch(/^\d+ of \d+ pairs · /);
    });

    // .chq-contacts-merge-picks: present, and recorded below as the
    // DEC-663 wave-17 blessed frame-silent addition -- never a divergence.
    const picks = document.querySelector('.chq-contacts-merge-picks');
    expect(picks).not.toBeNull();

    // :530-:532 -- at least one compare row rendering a label plus a keep
    // side and a drop side.
    await waitFor(() => {
      expect(document.querySelector('.chq-contacts-merge-compare-row')).not.toBeNull();
    });
    const rows = document.querySelectorAll('.chq-contacts-merge-compare-row');
    expect(rows.length).toBeGreaterThan(0);
    const rowWithAllThree = Array.from(rows).find(
      (row) =>
        row.querySelector('.chq-contacts-merge-compare-label') &&
        row.querySelector('.chq-contacts-merge-compare-keep') &&
        (row.querySelector('.chq-contacts-merge-compare-drop') ||
          row.querySelector('.chq-contacts-merge-compare-blank') ||
          row.querySelector('.chq-contacts-merge-compare-combine')),
    );
    expect(rowWithAllThree).toBeDefined();

    // :535 -- the consequence line as ONE element.
    await waitFor(() => {
      const rules = document.querySelectorAll('.chq-contacts-merge-rule-box-rule');
      expect(rules).toHaveLength(1);
      expect(rules[0]!.textContent).toContain('Labels combine, notes are appended');
    });

    // :536-:538 -- the dock's two controls, in DOM order, scoped to the
    // phone dock container (DEC-874 wave-29: never getByRole on name
    // alone, since the primary button's accessible name is
    // "Merge into <name>" -- its phone-visible LABEL text is what the
    // frame draws, carried in a dedicated child span). GROUP_OF_THREE
    // above has no sole discard, so DEC-992's "Swap which is kept" control
    // never mounts -- the dock is exactly the frame's two controls, no
    // third frame-silent button in between.
    const dock = document.querySelector('.chq-contacts-merge-footer') as HTMLElement;
    expect(dock).not.toBeNull();
    const dockButtons = within(dock).getAllByRole('button');
    expect(dockButtons).toHaveLength(2);
    expect(dockButtons[0]!.querySelector('.chq-contacts-merge-primary-phone-label')?.textContent).toBe('Merge them');
    expect(dockButtons[1]!.textContent).toBe('Not a duplicate');
  });

  it('renders an honest empty state with no ids -- the render sweep must not crash', () => {
    renderAt('/contacts/merge');
    expect(screen.getByText('Pick two or more duplicate records from the Duplicates tab.')).toBeInTheDocument();
  });

  // :536 `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px`
  // 44px floor (DEC-393): jsdom evaluates no @media, so this is a static
  // CSS-text receipt over contacts-panels.css's single terminal
  // `@media (max-width: 700px)` block, comment-stripped first (a literal
  // `{`/`}` inside a comment would desynchronise brace-matching).
  it('44px floor: both dock controls floor at >=44px inside the terminal phone block', () => {
    const cssPath = join(HERE, 'contacts-panels.css');
    const css = stripCssComments(readFileSync(cssPath, 'utf-8'));

    const mediaOpener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
    const openMatch = mediaOpener.exec(css);
    expect(openMatch).not.toBeNull();
    let depth = 1;
    let i = openMatch!.index + openMatch![0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    expect(depth).toBe(0);
    const phoneLayer = css.slice(start, i - 1);

    function ruleBody(selector: string): string {
      const rule = /([^{}]+)\{([^{}]*)\}/g;
      const bodies: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = rule.exec(phoneLayer)) !== null) {
        const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]!);
      }
      expect(bodies.length).toBeGreaterThan(0);
      return bodies.join('\n');
    }

    // The primary/desktop-default footer button (.chq-btn), floored 48px
    // in the phone block.
    const primaryFloor = ruleBody('.chq-contacts-merge-footer .chq-btn').match(/min-height:\s*(\d+)px/);
    expect(primaryFloor).not.toBeNull();
    expect(Number(primaryFloor![1])).toBeGreaterThanOrEqual(44);

    // "Not a duplicate" is a bare <button> (no .chq-btn class), floored
    // separately in the phone block.
    const notDuplicateFloor = ruleBody('.chq-contacts-merge-not-duplicate').match(/min-height:\s*(\d+)px/);
    expect(notDuplicateFloor).not.toBeNull();
    expect(Number(notDuplicateFloor![1])).toBeGreaterThanOrEqual(44);
  });
});
