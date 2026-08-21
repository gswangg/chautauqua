// w32-b (DEC-032 wave-32, DEC-976, DEC-967, DEC-989, DEC-874, DEC-180): the
// pack's LAST unclaimed zero-instrument phone frame gets its first real-
// mount verdict. docs/design/Chautauqua Settings.dc.html :275-312 ("Settings"
// 390 landing) previously had only SOURCE-SCAN citers
// (settings-phone-frames.test.ts:98, settings-phone-390.frames.test.ts:183 --
// both assert against SETTINGS_TSX read as file TEXT, never a render). Per
// DEC-976/DEC-967 a source scan is a citation, not a conformance receipt.
//
// Entered through the REAL Settings page (react-router + mockApi), copying
// the harness from app/src/pages/Settings.frame-verdicts.render.test.tsx
// verbatim (never a sub-panel, never a second mock stack). jsdom applies no
// stylesheet (no @media), so DOM-structure assertions below are about
// element/order/count, never computed geometry -- the CSS companion
// describe block at the bottom pins settings.css's terminal phone layer by
// SOURCE TEXT instead, brace-matched with the sibling helper from
// settings-phone-frames.test.ts, read-only.
//
// MEASUREMENT ONLY. Settings.tsx and settings.css are HARD READ-ONLY for
// this lane -- every DIVERGES finding below is recorded in the sibling
// audit doc, docs/design/audit/settings-hub-390-v12.md, not fixed here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage, SECTIONS } from '../Settings';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const CSS_FILE = join(HERE, 'settings.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// Brace-matched terminal phone layer, copied verbatim from the sibling
// scan's own `phoneLayer()` (settings-phone-frames.test.ts) -- read-only,
// not re-derived.
const css = readFileSync(CSS_FILE, 'utf8');
function phoneLayer(): string {
  const mediaBlocks = [...css.matchAll(/@media \(max-width: 700px\) \{/g)];
  expect(mediaBlocks).toHaveLength(1);
  const start = mediaBlocks[0]!.index! + mediaBlocks[0]![0].length;
  let depth = 1;
  let i = start;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

function rule(layer: string, selector: string): string {
  const escaped = selector.replace(/[.[\]'=]/g, (c) => `\\${c}`);
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = layer.match(re);
  expect(match, `expected to find rule ${selector} in the phone layer`).not.toBeNull();
  return match![1]!;
}

const EVENT_ID = 'evt-settings-hub390';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

function mockLanding() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      location: 'Austin, TX',
      timezone: 'America/Chicago',
      recordPrefix: 'DC26',
      branding: { logoUrl: '', accentColor: '' },
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Hall', capacity: 500 }]),
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [{ id: 'f1', label: 'Title', locked: true }],
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 3, speakers: 2, scheduled: 1 },
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
    'GET /api/v1/tokens': listEnvelope([]),
  });
}

function renderLanding() {
  mockLanding();
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('v12 Settings hub 390 landing (Chautauqua Settings.dc.html:275-312, w32-b, DEC-032/DEC-976/DEC-967/DEC-989/DEC-874/DEC-180)', () => {
  it('frame :281 H1 "Settings" -- MATCHES: real mount renders the page-title H1 at the un-drilled (27px cluster-landing) register, never the 26px drill register', () => {
    verbatimLine(
      281,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Settings</h1>',
    );
    renderLanding();
    const heading = screen.getByRole('heading', { name: 'Settings', level: 1 });
    expect(heading).toHaveClass('chq-page-title');
    // The 26px drill register is a distinct class (`chq-settings-drill-
    // title`) that Settings.tsx only mints when a section is drilled
    // (`phoneDrillTitle`); on the plain /settings landing no section is
    // active, so that twin must be entirely absent, and the page wrapper
    // must not carry data-drilled="true" (the attribute settings.css's
    // phone layer keys the 26px swap off of, per :1548/:1894).
    expect(heading).not.toHaveClass('chq-settings-drill-title');
    expect(document.querySelector('.chq-settings-drill-title')).toBeNull();
    expect(document.querySelector('.chq-settings-page[data-drilled="false"]')).not.toBeNull();
    expect(document.querySelector('.chq-settings-page[data-drilled="true"]')).toBeNull();
  });

  it('frame :278/:279 head band (wordmark + right-flushed event name) -- NOT INSTRUMENTABLE at this scope: both are drawn by the app SHELL (App.tsx Header), not by SettingsPage', () => {
    verbatimLine(
      278,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px">chautauqua</span>',
    );
    verbatimLine(279, '          <span style="margin-left:auto; font-size:12px; font-weight:600; color:#565A4B">DevFlow 2027</span>');
    renderLanding();
    // Confirms the negative: a real mount of SettingsPage alone (the
    // harness this task is bound to reuse) mints neither element -- the
    // wordmark span lives in App.tsx's Header() (`chq-header` >
    // `chq-wordmark`), which no Settings-cluster real-mount test wraps
    // (grep: no test under app/src imports App.tsx's Header around a
    // SettingsPage mount). See the audit doc's head-band row for the
    // owning-file citation; this is a scope boundary, not a verdict.
    expect(document.querySelector('.chq-wordmark')).toBeNull();
    expect(document.querySelector('.chq-header')).toBeNull();
  });

  it('frame :285-293 body rows -- MATCHES: one row per mobileGroups entry, row count equals the rail section count, label/Open/detail order and shape hold for every row (DEC-180: enumerated, not hand-listed)', async () => {
    verbatimLine(285, '        <sc-for list="{{ mobileGroups }}" as="g" hint-placeholder-count="5">');
    verbatimLine(
      287,
      '            <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px">',
    );
    verbatimLine(
      288,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ g.label }}</span>',
    );
    verbatimLine(289, '              <span style="font-size:13px; font-weight:700; color:#4E5C31">Open</span>');
    verbatimLine(291, '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ g.detail }}</span>');
    renderLanding();
    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    const rows = within(rail).getAllByRole('button');
    // DEC-180: the row count is DERIVED from SECTIONS (the rail's own
    // population), never hand-listed as a literal number -- so this
    // assertion tracks the real population even if a future section is
    // added or removed.
    expect(rows).toHaveLength(SECTIONS.length);
    SECTIONS.forEach((section, i) => {
      const row = rows[i]!;
      // Shape only (DEC-967): {{ g.label }} / {{ g.detail }} are template
      // placeholders, never graded against a literal string.
      expect(row).toHaveTextContent(section.label);
      expect(row).toHaveTextContent(section.detail);
      const openSpan = within(row).getByText('Open');
      expect(openSpan).toHaveClass('chq-settings-rail-link-open');
      const labelSpan = within(row).getByText(section.label);
      expect(labelSpan).toHaveClass('chq-settings-rail-link-label');
      const detailSpan = within(row).getByText(section.detail);
      expect(detailSpan).toHaveClass('chq-settings-rail-link-detail');
      // baseline row: label and Open share one row wrapper distinct from
      // the detail line beneath it.
      const baselineRow = labelSpan.closest<HTMLElement>('.chq-settings-rail-link-row');
      expect(baselineRow).not.toBeNull();
      expect(within(baselineRow!).getByText('Open')).toBe(openSpan);
      expect(baselineRow!.contains(detailSpan)).toBe(false);
    });
  });

  it('frame :295 closing sentence -- MATCHES: renders as plain TEXT in a real mount, never a disabled control (DEC-032 ruling: disabled has exactly two legal uses, neither applies here)', () => {
    verbatimLine(
      295,
      '          <span style="font-size:13px; color:#565A4B; line-height:1.5">Embed codes are easier to copy on a laptop</span>',
    );
    renderLanding();
    const note = screen.getByText('Embed codes are easier to copy on a laptop');
    expect(note.tagName).toBe('P');
    expect(note).toHaveClass('chq-settings-rail-note');
    // Not a control: no role, no disabled attribute/aria-disabled, no
    // button/link tag standing in for the disabled token's two legal uses
    // (inert control, drag handle) -- neither applies to a device-capability
    // fact.
    expect(note).not.toHaveAttribute('disabled');
    expect(note).not.toHaveAttribute('aria-disabled');
    expect(note.closest('button, a, [role="button"]')).toBeNull();
  });

  it('frame :299-306 footer strip -- MATCHES: it is the shell tab bar drawn inside the device box, not a page dock -- SettingsPage mints ZERO [data-chq-phone-dock] elements at the landing (DEC-989 wave-85)', () => {
    verbatimLine(299, '      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:10px 8px 14px; display:flex; gap:2px">');
    renderLanding();
    // A page dock stacked here on top of the shell tab bar would visually
    // double the footer band (DEC-989 wave-85). settings.css's own comment
    // at the drilled-register rule states this directly ("The footer is
    // the shell tab bar (App.tsx), not a page-level dock -- nothing to
    // build here.").
    expect(document.querySelectorAll('[data-chq-phone-dock]')).toHaveLength(0);
  });

  it('CSS companion (settings.css terminal phone layer, READ-ONLY): pins the un-drilled H1 falls through to the shared 27px register and the drilled register stays 26px -- reusing the sibling scan\'s own phoneLayer()/rule() helpers, not re-derived', () => {
    const layer = phoneLayer();
    // Un-drilled: no `.chq-page-title` rule scoped OUTSIDE [data-drilled]
    // inside the phone layer -- confirms the landing H1 falls through to
    // styles.css's shared --chq-type-page-title-phone-size (27px), never
    // the drilled 26px override.
    expect(layer).not.toMatch(/(?<!\[data-drilled='true'\]\s)\.chq-page-title\s*\{[^}]*font-size:\s*26px/);
    // Drilled: the Settings-local 26px register exists and is scoped
    // strictly to [data-drilled='true'].
    const drilledTitleRule = rule(layer, "[data-drilled='true'] .chq-page-title");
    expect(drilledTitleRule).toMatch(/font-size:\s*26px/);
    // The phone-only landing furniture (Open pill, detail line, rail note)
    // is hidden by default outside the media block (DEC-385 narrow
    // overrides wide) -- reused from the sibling scan's own assertion.
    const desktopHide = css.match(
      /\.chq-settings-rail-link-open,\s*\n\s*\.chq-settings-rail-link-detail,\s*\n\s*\.chq-settings-rail-note\s*\{([^}]*)\}/,
    );
    expect(desktopHide, 'expected a top-level (desktop) display:none rule for the phone-only landing furniture').not.toBeNull();
    expect(desktopHide![1]).toMatch(/display:\s*none/);
  });
});
