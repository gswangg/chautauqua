// v12 mobile campaign wave 7 (task w7-e, DEC-919 amendment). Claims the
// third and last residual frame: docs/design/Chautauqua Submissions.dc.html
// "Submissions" (390), line 137. jsdom applies no stylesheet and evaluates
// no @media rule -- mirroring app/src/pages/contacts/contacts-phone-frames.test.ts
// -- so the geometry assertions below are source-scan pins on the CSS TEXT
// of submissions.css, not computed style. The render assertion (bottom of
// file) is a separate DOM-level check that the head-actions markup and the
// sort control are never conditionally removed for phone.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsTable } from './SubmissionsTable';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

// This file is a plain .test.ts (not .render.test.tsx): the render section
// at the bottom uses createElement rather than JSX so no JSX transform is
// required for the extension.

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments stripped before any brace scanning -- a literal `{`/`}` inside a
 * long explanatory comment would desynchronise the depth counter. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const CSS = read('submissions.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched so a nested rule can never end the block early. */
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

/** A single rule's declaration body, by selector, inside the phone layer --
 * matched as a whole member of the rule's selector list. */
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

/** Every phone rule bank keyed to `selector` (a class can be re-declared in
 * more than one @media block in this file -- callers that need to prove an
 * ABSENCE of a declaration across every phone layer use this, not
 * `phoneRule`, which only returns the first match). */
function allPhoneRules(css: string, selector: string): string[] {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(m[2]!);
  }
  return bodies;
}

describe('v12 phone frame "Submissions" (390) — docs/design/Chautauqua Submissions.dc.html', () => {
  it('draws the title row on one baseline, H1 first (:143 `<h1 ...>Submissions</h1><span ...>12 awaiting triage</span>`)', () => {
    // docs/design/Chautauqua Submissions.dc.html:143
    // `<div style="display:flex; align-items:baseline; gap:10px">`
    const head = phoneRule(CSS, '.chq-submissions-head');
    expect(head).toMatch(/flex-direction:\s*column/);
  });

  it('gives the search box the frame\'s 44px bordered field with 13px side padding (:147)', () => {
    // docs/design/Chautauqua Submissions.dc.html:147
    // `border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2`
    // Two rule banks touch this selector -- merge both.
    const search = allPhoneRules(CSS, '.chq-submissions-filterbar-search').join('\n');
    expect(search).toMatch(/min-height:\s*44px/);
    expect(search).toMatch(/padding:\s*0 13px/);
  });

  it('scrolls the status chip strip instead of wrapping it (:148 `display:flex; gap:7px; overflow-x:auto`)', () => {
    // docs/design/Chautauqua Submissions.dc.html:148
    // `<div style="display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch">`
    const strip = allPhoneRules(CSS, '.chq-submissions-filterbar .chq-status-pills').join('\n');
    expect(strip).toMatch(/gap:\s*7px/);
    const scroller = allPhoneRules(CSS, '.chq-submissions-filterbar').join('\n');
    expect(scroller).toMatch(/overflow-x:\s*auto/);
  });

  describe('DEC-919 amendment (wave 7): the head-actions band re-lines, it never disappears', () => {
    it('stacks the head into titles-then-actions, never side by side', () => {
      const head = phoneRule(CSS, '.chq-submissions-head');
      expect(head).toMatch(/flex-direction:\s*column/);
      expect(head).not.toMatch(/display:\s*none/);
    });

    it('gives the actions row its own full-width line, not display:none', () => {
      const actions = phoneRule(CSS, '.chq-submissions-head-actions');
      expect(actions).not.toMatch(/display:\s*none/);
      expect(actions).toMatch(/width:\s*100%/);
    });

    it('mirrors the frame\'s own card action triple (:164-167 flex:1 / flex:1 / auto): the two secondary actions share the row, the primary keeps its own width', () => {
      const secondary = phoneRule(CSS, '.chq-submissions-head-actions .chq-btn-secondary');
      expect(secondary).toMatch(/flex:\s*1/);
      // .chq-btn-primary (New submission) carries no rule here -- it is left
      // at its intrinsic content width, same as the frame's third slot.
      expect(CSS).not.toMatch(/\.chq-submissions-head-actions\s+\.chq-btn-primary\s*\{[^}]*flex:\s*1/);
    });

    it('never authors a sub-44px min-height in this rule bank (the 44px floor comes from the shared .chq-btn phone rule, restated nowhere here)', () => {
      const actions = phoneRule(CSS, '.chq-submissions-head-actions');
      const heights = [...actions.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
    });

    // DEC-919 wave-110 amendment (task v12m-w6-d) reverses this reading for
    // THIS screen: there is no line left for a sort control, so it is stood
    // down (receipted) rather than re-lined.
    const SORT_SELECT_HIDDEN = new RegExp(
      `[^{}]*chq-submissions-filterbar-sort-select[^{}]*\\{[^{}]*display:\\s*none`,
    );
    // docs/design/Chautauqua Submissions.dc.html:147 `min-height:44px; display:flex; align-items:center` -- exactly ONE 44px search box on row 1, "Nothing else".
    it('hides the sort select -- the frame\'s row 1 (:147) is the search box alone', () => {
      expect(phoneLayer(CSS)).toMatch(SORT_SELECT_HIDDEN);
    });

    it('keeps the track select hidden -- the frame draws no track control in the phone head (:148-151), unchanged by the wave-110 amendment', () => {
      expect(phoneRule(CSS, '.chq-submissions-filterbar .chq-submissions-filterbar-select')).toMatch(
        /display:\s*none/,
      );
    });

    // DEC-919 wave-110 amendment: the saved-views strip (ViewTabs.tsx) has
    // no line in the frame either (:137-152) -- stood down in full.
    it('hides the saved-views strip -- the frame draws no saved-views row', () => {
      const banks = allPhoneRules(CSS, '.chq-submissions-viewtabs');
      expect(banks.some((body) => /display:\s*none/.test(body))).toBe(true);
    });

    // The app's real status vocabulary is narrowed to its two closest
    // literals (`pending` / `accepted`) via data-status, CSS-only.
    // docs/design/Chautauqua Submissions.dc.html:148-151 `display:flex; gap:7px; overflow-x:auto` names exactly three chips ('Needs triage' filled / 'Accepted' / 'All 47').
    it('narrows the phone chip strip to the pending/accepted status literals', () => {
      const layer = phoneLayer(CSS);
      expect(layer).toMatch(
        /\.chq-status-pills \[data-status\]:not\(\[data-status='pending'\]\):not\(\[data-status='accepted'\]\)[^{]*\{[^}]*display:\s*none/,
      );
    });

    // docs/design/Chautauqua Submissions.dc.html:148-151
    // `display:flex; gap:7px; overflow-x:auto` -- DEC-919 wave-92/102 STANDS.
    it('hides the column picker at phone width -- nothing left to govern once the table stacks into cards', () => {
      const layer = phoneLayer(CSS);
      // Root selector only, never `> summary::-webkit-details-marker` chrome.
      expect(layer).toMatch(/\.chq-submissions-columnpicker(?![\w-])(?!\s*>)[,\s{][\s\S]{0,200}display:\s*none/);
    });
  });
});

describe('DEC-385: the submissions phone layer is single-direction', () => {
  it('declares no min-width media query', () => {
    expect(CSS).not.toMatch(/@media[^{]*min-width/);
  });
});

const EVENT_ID = 'evt-submissions-phone-1';

function baseRoutes(overrides: Record<string, unknown> = {}) {
  return {
    'GET /api/v1/me': {
      userId: 'user-1',
      email: 'organizer@example.com',
      name: 'Organizer',
      role: 'organizer',
      orgId: 'org-1',
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    ...overrides,
  };
}

describe('SubmissionsTable renders the head-actions band and the sort control unconditionally', () => {
  beforeEach(() => {
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('mounts .chq-submissions-head-actions with all three actions, not conditionally omitted for phone', async () => {
    mockApi(baseRoutes());
    render(createElement(MemoryRouter, null, createElement(SubmissionsTable)));
    expect(await screen.findByRole('link', { name: 'Forms' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New submission' })).toBeInTheDocument();
  });

  it('mounts the Sort combobox -- there is no JS-level phone branch that unmounts it', async () => {
    mockApi(baseRoutes());
    render(createElement(MemoryRouter, null, createElement(SubmissionsTable)));
    const sortSelect = await screen.findByRole('combobox', { name: 'Sort' });
    expect(sortSelect).toHaveClass('chq-submissions-filterbar-sort-select');
  });
});
