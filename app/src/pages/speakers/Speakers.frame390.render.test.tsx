// w31-a (DEC-976 wave-31): the Speakers cluster's two 390 frames --
// docs/design/Chautauqua Speakers.dc.html:133-181 "Speakers" (matrix
// becomes one card per speaker) and :260-282 "Roster · 390" -- were cited
// only by product source and Speakers.frame-verdicts.render.test.tsx's
// shallow verdict (structure only, entered through SpeakersPage, no
// dock-scoped control-order receipt, no 44px-floor CSS receipt). This file
// mounts the REAL screens directly -- OnboardingGrid for :133 and
// RosterPanel's exported RosterDrillIn for :260 -- the exact same
// standalone-mount shape OnboardingGrid.render.test.tsx / a direct
// RosterPanel mount already use, never a second mock stack (DEC-663) and
// never a sub-component standing in for the screen.
//
// SCOPE NOTE (flagged per this task's own instructions): frame :133 draws a
// wordmark row (:136 `chautauqua` + event name) and a five-item bottom tab
// band (:174-178) above/below OnboardingGrid's own content. Both are shared
// App-shell chrome rendered by app/src/App.tsx (the wordmark header, the
// `.chq-tabbar` nav) -- OUTSIDE this task's owned files (App.tsx is not in
// its MAY FIX list, and mounting App.tsx would be a second, page-spanning
// mock stack this task was not asked to build). OnboardingGrid.tsx itself
// draws neither; they cannot be asserted from this file without violating
// file scope. Both are cross-cutting chrome identical across every 390
// landing frame in the pack (DEC-381/DEC-576 govern the tab band globally)
// and are exercised by App.render.test.tsx / shell-geometry.test.ts /
// phone-dock-declares.scan.test.ts, not per-cluster files -- recorded as a
// DIVERGES(not-owned) row in docs/design/audit/speakers-390-v12.md, not a
// gap in this receipt.
//
// DEC-967 wave-31: structural copy graded by literal, sample data graded by
// SHAPE -- the accepted/overdue and accepted/not-claimed counters below are
// never pinned to the frame's own sample numbers ("12 accepted", "3
// overdue", "2 not claimed").
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { RosterDrillIn } from './RosterPanel';
import { mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import type { OnboardingGridResponse, OnboardingRow } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Speakers.dc.html');
const CSS_PATH = join(HERE, 'speakers.css');

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * MergePage.frame390.render.test.tsx / Speakers.frame-verdicts.render.test.tsx's
 * own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-speakers-frame390';
const DUE_DATE_MS = Date.UTC(2026, 0, 15);

function grid(): OnboardingGridResponse {
  return {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: DUE_DATE_MS, required: true }],
    rows: [
      {
        contact: {
          id: 'ct1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          company: 'Acme',
          hasAccount: true,
          participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        contact: {
          id: 'ct2',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          company: 'Navy',
          hasAccount: false,
          participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Compilers', inviteStatus: 'none' }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
      },
    ],
    total: 2,
    page: 1,
    perPage: 50,
    counts: { speakers: 2, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
    timezone: 'UTC',
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetApiCacheForTests();
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('v12 frame render verdict "Speakers" (docs/design/Chautauqua Speakers.dc.html:133-181, task w31-a, DEC-976 wave-31)', () => {
  it('renders every OnboardingGrid-owned drawn element from a real /speakers mount, in drawn order', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid(),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [{ id: 'form-1', title: 'Speaker agreement form', isDefault: true }] },
    });

    render(
      <MemoryRouter>
        <OnboardingGrid onAddSpeaker={vi.fn()} />
      </MemoryRouter>,
    );

    // :139 -- exactly one <h1> reading the frame's literal title (DEC-662:
    // the same H1 serves both desktop and phone).
    verbatimLine(
      139,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Speakers</h1>',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Speakers' });

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

    // :140 -- the summary, shape-matched (never the frame's own "12
    // accepted · 3 overdue" sample numbers), landing after the H1.
    verbatimLine(
      140,
      '        <span style="font-size:13px; color:#565A4B; line-height:1.5">12 accepted · <strong style="color:#1B1D17">3 overdue</strong></span>',
    );
    const summary = document.querySelector('.chq-speakers-head-titles .chq-summary')!;
    expect(summary.textContent).toMatch(/^\d+ accepted · \d+ overdue$/);
    expect(h1.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :142/:143 -- the phone-only action pair, filled "Remind outstanding"
    // then bordered "Filter", after the summary.
    verbatimLine(
      142,
      '          <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Remind outstanding</span>',
    );
    verbatimLine(
      143,
      '          <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Filter</span>',
    );
    const phoneActions = document.querySelector('.chq-speakers-phone-head-actions') as HTMLElement;
    expect(phoneActions).not.toBeNull();
    const remindOutstanding = within(phoneActions).getByRole('button', { name: 'Remind outstanding' });
    const filterBtn = within(phoneActions).getByRole('button', { name: 'Filter' });
    expect(remindOutstanding.compareDocumentPosition(filterBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.compareDocumentPosition(phoneActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(remindOutstanding.className).toMatch(/chq-btn-primary/);
    expect(filterBtn.className).toMatch(/chq-btn-secondary/);

    // :149-168 -- the per-speaker card stack, scoped to .chq-speakers-cards
    // (the phone half of the DEC-385 single-direction pair; the pinned
    // .chq-speakers-grid-wrap table also renders in jsdom -- no @media
    // applies -- but is CSS-hidden at phone width and is not this frame's
    // concern).
    const cards = document.querySelectorAll('.chq-speakers-cards .chq-speakers-card');
    expect(cards.length).toBeGreaterThan(0);
    const card = Array.from(cards).find((c) => c.textContent?.includes('Ada Lovelace')) as HTMLElement;
    expect(card).toBeDefined();

    // :151 name, :152 meta -- in drawn order.
    verbatimLine(
      151,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:17px; font-weight:600; letter-spacing:-0.02em">{{ row.name }}</span>',
    );
    verbatimLine(152, '              <span style="font-size:12px; color:#565A4B">{{ row.meta }}</span>');
    const nameLink = within(card).getByRole('link', { name: 'Ada Lovelace' });
    const meta = card.querySelector('.chq-meta')!;
    expect(nameLink.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :153 -- the invite chip carrying the ▾ affordance, after the meta.
    verbatimLine(
      153,
      '              <span style="{{ row.inviteStyleM }}">{{ row.invite }}<span style="color:#565A4B; padding-left:6px">▾</span></span>',
    );
    const inviteTrigger = within(card).getByRole('button', { name: /Participation status for Ada Lovelace/ });
    expect(inviteTrigger.textContent).toContain('▾');
    expect(meta.compareDocumentPosition(inviteTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :158/:160 -- per-task label rows (task title + status label), after
    // the invite chip.
    const taskRow = within(card).getByText('Sign speaker agreement').closest('.chq-speakers-card-task')!;
    expect(inviteTrigger.compareDocumentPosition(taskRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(taskRow.querySelector('.chq-speakers-status')).not.toBeNull();

    // :166/:167 -- the trailing Remind/Open profile pair, after the task
    // rows, both 44px-floored .chq-btn controls.
    verbatimLine(
      166,
      '              <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Remind</span>',
    );
    verbatimLine(
      167,
      '              <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Open profile</span>',
    );
    const cardActions = card.querySelector('.chq-speakers-card-actions') as HTMLElement;
    expect(cardActions).not.toBeNull();
    const openProfile = within(cardActions).getByRole('link', { name: 'Open profile' });
    expect(taskRow.compareDocumentPosition(cardActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(openProfile.className).toMatch(/chq-btn/);
  });

  // 44px floor (DEC-393): jsdom evaluates no @media, so this is a static
  // CSS-text receipt over speakers.css's single terminal
  // `@media (max-width: 700px)` block, comment-stripped first (a literal
  // `{`/`}` inside a comment would desynchronise brace-matching). Both
  // the phone head-actions row and the card-actions row already carry a
  // documented DEC-393 wave-120 "tap-floor-exempt: composition" ruling --
  // this receipt pins that ruling's own text so a future edit that
  // silently strips the comment (and the guarantee it records) shows up
  // as a diff here.
  it('44px floor: the phone-head and card action rows are composition-exempt over floored .chq-btn children', () => {
    const css = stripCssComments(readFileSync(CSS_PATH, 'utf-8'));
    const rawCss = readFileSync(CSS_PATH, 'utf-8');

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

    function ruleBody(layer: string, selector: string): string {
      const rule = /([^{}]+)\{([^{}]*)\}/g;
      const bodies: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = rule.exec(layer)) !== null) {
        const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]!);
      }
      expect(bodies.length).toBeGreaterThan(0);
      return bodies.join('\n');
    }

    // Both rows compose from .chq-btn children and declare no min-height of
    // their own -- the flex:1 stretch rule is the row's ONLY declaration
    // beyond layout.
    const headActionsFlex = ruleBody(phoneLayer, '.chq-speakers-phone-head-actions .chq-btn');
    expect(headActionsFlex).toMatch(/flex:\s*1/);
    const cardActionsFlex = ruleBody(phoneLayer, '.chq-speakers-card-actions .chq-btn');
    expect(cardActionsFlex).toMatch(/flex:\s*1/);

    // The blessed composition-exemption comments themselves, pinned by
    // source text so a silent strip is a diff here.
    expect(rawCss).toContain(
      "already floored by the base .chq-btn rule\n     (DEC-393 wave-120 shape 3: a container every one of whose children is\n     a floored chq-btn control).",
    );
    expect(rawCss).toContain(
      'already floored by the base .chq-btn rule -- not a missing rule\n     (DEC-393 wave-120 shape 3, wave-94/-112 (no CSS rule) precedent).',
    );
  });
});

describe('v12 frame render verdict "Roster · 390" (docs/design/Chautauqua Speakers.dc.html:260-282, task w31-a, DEC-976 wave-31)', () => {
  function drillInRows(): readonly OnboardingRow[] {
    return grid().rows;
  }

  it('renders every drawn element from a real RosterDrillIn mount, in drawn order', () => {
    render(
      <MemoryRouter>
        <RosterDrillIn
          rows={drillInRows()}
          acceptedCount={12}
          notClaimedCount={2}
          onAddSpeaker={vi.fn()}
          onBack={vi.fn()}
          eventId={EVENT_ID}
          onSelectStatus={vi.fn()}
          onSendInvite={vi.fn()}
          invitingContactIds={new Set()}
        />
      </MemoryRouter>,
    );

    // :262 -- the 44px-floored back link, first in the head.
    verbatimLine(
      262,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Speakers</a>',
    );
    const backBtn = screen.getByRole('button', { name: '‹ Speakers' });
    expect(backBtn).toBeInTheDocument();

    // :263 -- exactly one <h1> "Roster", after the back link.
    verbatimLine(
      263,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Roster</h1>',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Roster' });
    expect(backBtn.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :264 -- the summary, shape-matched, after the H1.
    verbatimLine(264, '        <span style="font-size:13px; color:#565A4B">12 accepted · 2 not claimed</span>');
    const summary = document.querySelector('.chq-speakers-roster-drillin .chq-summary')!;
    expect(summary.textContent).toMatch(/^\d+ accepted · \d+ not claimed$/);
    expect(h1.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :270-274 -- per-row name/meta/invite chip, then the trailing bordered
    // 44px "Open" -- in drawn order.
    verbatimLine(
      270,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ row.name }}</span>',
    );
    verbatimLine(
      274,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600">Open</span>',
    );
    const nameLink = screen.getByRole('link', { name: 'Ada Lovelace' });
    const row = nameLink.closest('.chq-speakers-roster-row') as HTMLElement;
    const inviteTrigger = within(row).getByRole('button', { name: /Participation status for Ada Lovelace/ });
    expect(inviteTrigger.textContent).toContain('▾');
    const openLink = within(row).getByRole('link', { name: 'Open' });
    expect(nameLink.compareDocumentPosition(inviteTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inviteTrigger.compareDocumentPosition(openLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(openLink.className).toMatch(/chq-btn-secondary/);

    // :279/:280 -- the footer dock, primary "Add a speaker" (flex:1, filled,
    // 48px) then secondary "Import CSV" (bordered, 48px), after every row.
    verbatimLine(
      279,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Add a speaker</span>',
    );
    verbatimLine(
      280,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Import CSV</span>',
    );
    const dock = document.querySelector('.chq-phone-dock') as HTMLElement;
    expect(dock).not.toBeNull();
    const addBtn = within(dock).getByRole('button', { name: 'Add a speaker' });
    const importLink = within(dock).getByRole('link', { name: 'Import CSV' });
    expect(row.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addBtn.compareDocumentPosition(importLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addBtn.className).toMatch(/chq-btn-primary/);
    expect(importLink.className).toMatch(/chq-btn-secondary/);
  });

  // 44px floor over speakers.css's own terminal block for the roster row and
  // its Open control -- both compose from the shared .chq-btn family
  // (floored globally at phone width) rather than declaring a min-height of
  // their own in this file, matching .chq-speakers-roster-open's bare
  // `flex-shrink: 0` body.
  it('44px floor: the roster row Open control declares no competing min-height in speakers.css', () => {
    const css = stripCssComments(readFileSync(CSS_PATH, 'utf-8'));

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

    const rule = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    let openBody: string | undefined;
    while ((m = rule.exec(phoneLayer)) !== null) {
      const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
      if (selectors.includes('.chq-speakers-roster-open')) openBody = m[2]!;
    }
    expect(openBody).toBeDefined();
    // No min-height override here that could UNDERCUT the shared .chq-btn
    // floor (a lower override would win the cascade by appearing later);
    // the class also never sets one below 44px.
    const minHeightMatch = openBody!.match(/min-height:\s*(\d+)px/);
    if (minHeightMatch) {
      expect(Number(minHeightMatch[1])).toBeGreaterThanOrEqual(44);
    }
  });
});
