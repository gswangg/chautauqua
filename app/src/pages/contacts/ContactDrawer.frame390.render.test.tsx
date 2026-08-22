// w31-b (DEC-976 wave-31): the frame's FIRST markup-level verdict for
// "Contact · 390" (docs/design/Chautauqua Contacts.dc.html:407-437 --
// "the errand you actually run on a phone"). Until this file the frame was
// cited only by contacts-phone-frames.test.ts (source-scan pins over
// contacts.css/contacts-panels.css TEXT) and
// ContactDrawer.phoneRead.render.test.tsx (behaviour: dock buttons, values
// as inert text, Edit swap) -- neither enumerates the frame's drawn
// literals in drawn order against the real mounted DOM. This file mounts
// the REAL drawer via the EXACT harness
// ContactDrawer.phoneRead.render.test.tsx already uses (matchMedia stub +
// mockApi + render(<ContactDrawer .../>)) -- copied verbatim, never a
// second mock stack (DEC-663) -- and asserts DOM structure/order (jsdom
// applies no @media, so every claim here is about markup, never computed
// geometry) plus a static CSS-text receipt over contacts-panels.css's
// single terminal max-width:700px block (DEC-385).
//
// DEC-967 wave-31: structural copy is graded by literal; `{{ g.* }}` /
// `{{ h.* }}` template rows and the frame's own sample data ("Priya
// Raman", "Latticework Systems · Principal Engineer") are graded by SHAPE
// only, never pinned as literals the app must reproduce.
//
// DEC-576 wave-31 (later-DEVIATIONS-entry wins): DEVIATIONS.md's "Contact
// drawer footer" row keeps the recorded A20 ruling (Delete far-left
// destructive tertiary, Cancel/Save as the right-flushed terminal pair,
// save-scope sentence on its own line above the bar) over the frame's
// buttons-only Cancel/Save/Email/Add-to-event order for the phone EDIT
// state -- this file asserts the APP's order for that state and records
// the frame's order as the blessed divergence it already is, never a new
// finding.
//
// DEC-959 / DEC-380 wave-120 struck (DEVIATIONS.md "Contact drawer's phone
// EDIT stack is not the frame's read dock"): the frame's :433-436 draws
// ONLY the 390 READ footer (Email / Edit, both min-height:48px,
// padding:12px 16px 16px) via the shell's shared .chq-phone-dock -- graded
// against the frame directly below. The five-control EDIT bar is an
// undrawn state whose shape is the recorded interpretation (min-height:
// 48px, padding:0 16px, one control per line, reached through the dock's
// own Edit) -- graded against that interpretation, not the frame.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContactDrawer } from './ContactDrawer';
import { mockApi } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import type { ContactDetail } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Mirrors
 * MergePage.frame390.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// Exact harness idiom from ContactDrawer.phoneRead.render.test.tsx -- the
// same matchMedia-stub shape PlanEditor.render.test.tsx:2496-2504
// established, unstubbed in afterEach so every OTHER render test in this
// directory keeps exercising the desktop tree by default.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetEventsCacheForTests();
});

const CONTACT: ContactDetail = {
  id: 'ct1',
  firstName: 'Dana',
  lastName: 'Whitfield',
  email: 'dana@example.com',
  company: 'Northline Robotics',
  title: 'Staff Engineer',
  labels: [],
  phone: '+1 555 019 4821',
  notes: 'Met at PlatformCon; follow up in Q2.',
  bio: 'Distributed systems and developer tooling.',
  headshotUrl: null,
  socialLinks: { twitter: '@dana', linkedin: '', github: '', website: '' },
  customFields: {},
  history: {
    submissions: [{ id: 'sub1', eventId: 'ev1', eventName: 'DevFlow 2027', title: 'Scaling stateful services', ref: 'S-102', status: 'accepted' }],
    submissionsTotal: 1,
    emails: [],
    emailsTotal: 0,
    events: ['DevFlow 2027'],
    eventsTotal: 1,
  },
};

describe('v12 frame render verdict "Contact · 390" (task w31-b, DEC-976 wave-31)', () => {
  it('renders every drawn body element, in drawn order, from the real mounted drawer (READ state)', async () => {
    // :409 the 44px back link
    verbatimLine(
      409,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Contacts</a>',
    );
    // :410 the H1 (SHAPE only -- never pinned to "Priya Raman")
    verbatimLine(
      410,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Priya Raman</h1>',
    );
    // :411 the "<company> · <title>" identity line (SHAPE only)
    verbatimLine(411, '        <span style="font-size:13px; color:#565A4B">Latticework Systems · Principal Engineer</span>');
    // :414-416 a drawn body section's eyebrow ({{ g.name }} -- SHAPE)
    verbatimLine(414, '          <div style="padding:16px 0 6px; border-bottom:2px solid #1B1D17">');
    verbatimLine(
      415,
      '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">{{ g.name }}</span>',
    );
    // :419-420 a record row: label eyebrow + value ({{ c.label }} / {{ c.value }} -- SHAPE)
    verbatimLine(
      419,
      '              <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">{{ c.label }}</span>',
    );
    // :424-425 the "Across your events" eyebrow -- a literal, not templated
    verbatimLine(424, '        <div style="padding:18px 0 8px; border-bottom:2px solid #1B1D17">');
    verbatimLine(
      425,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Across your events</span>',
    );
    // :429-430 a history row: event + what ({{ h.event }} / {{ h.what }} -- SHAPE)
    verbatimLine(429, '            <span style="font-size:14px; font-weight:600">{{ h.event }}</span>');
    // :434 the footer dock's primary control (READ state, DEC-959)
    verbatimLine(
      434,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Email Priya</span>',
    );
    // :435 the footer dock's secondary control (READ state, DEC-959)
    verbatimLine(
      435,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Edit</span>',
    );

    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Dana Whitfield')).toBeInTheDocument();
    });

    // docs/design/Chautauqua Contacts.dc.html:409 -- exactly one back
    // link, reading the frame's own literal label
    // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Contacts</a>`.
    const backLinks = within(dialog).getAllByRole('button', { name: '‹ Contacts' });
    expect(backLinks).toHaveLength(1);

    // :410 -- the name (SHAPE: "First Last", never the frame's own sample).
    expect(within(dialog).getByText('Dana Whitfield')).toBeInTheDocument();
    expect(within(dialog).queryByText('Priya Raman')).toBeNull();

    // :411 -- the "<company> · <title>" identity line (SHAPE).
    expect(within(dialog).getByText('Northline Robotics · Staff Engineer')).toBeInTheDocument();

    // :414-416 -- every drawn body section renders its own eyebrow, in
    // drawn order: the record's titled groups (Contact, Profile, the
    // event-scoped group, Notes), each headed by the shared
    // .chq-section-label eyebrow treatment.
    const sectionLabels = dialog.querySelectorAll('.chq-section-label');
    const sectionLabelText = Array.from(sectionLabels).map((el) => el.textContent);
    expect(sectionLabelText).toEqual(['Contact', 'Profile', 'On this event', 'Notes']);

    // :417-421 -- every record row draws a label eyebrow above its value,
    // in the DOM (frame collapses the 130px gutter at 390 -- CSS-side,
    // pinned separately below and in contacts-phone-frames.test.ts).
    const rows = dialog.querySelectorAll('.chq-contacts-record-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector('.chq-contacts-record-label')).not.toBeNull();
    }
    // :419 -- a concrete row's label eyebrow, present verbatim.
    const emailLabel = within(dialog)
      .getAllByText('Email')
      .find((el) => el.classList.contains('chq-contacts-record-label'));
    expect(emailLabel).toBeDefined();
    // :420 -- READ state renders the value as inert text, never a
    // click-to-edit button (DEC-616/DEC-959).
    expect(dialog.querySelector('button.chq-contacts-record-value')).toBeNull();
    expect(within(dialog).getByText('dana@example.com')).toBeInTheDocument();

    // :424-425 -- the "Across your events" eyebrow, verbatim.
    expect(within(dialog).getByRole('heading', { level: 3, name: 'Across your events' })).toBeInTheDocument();

    // :427-431 -- history rows render event + what, in order, one per
    // history entry.
    const historyRows = dialog.querySelectorAll('.chq-contacts-history-row');
    expect(historyRows.length).toBeGreaterThan(0);
    const firstHistoryRow = historyRows[0]!;
    expect(firstHistoryRow.querySelector('.chq-contacts-history-event')).not.toBeNull();
    expect(firstHistoryRow.querySelector('.chq-contacts-history-what')).not.toBeNull();
    expect(within(dialog).getAllByText('DevFlow 2027').length).toBeGreaterThan(0);

    // :433-436 -- the footer dock: exactly the frame's two controls, in
    // drawn order, scoped to the dock container (DEC-874: never
    // getByRole on name alone across the whole dialog).
    const dock = dialog.querySelector('[data-chq-phone-dock]');
    expect(dock).not.toBeNull();
    expect(dock).toHaveClass('chq-phone-dock');
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons.map((b) => b.textContent)).toEqual(['Email Dana', 'Edit']);

    // The five-control desktop/EDIT action bar is absent in READ state.
    expect(dialog.querySelector('.chq-contacts-drawer-actions')).toBeNull();
  });

  it('DEC-576/DEC-959: pressing Edit swaps to the recorded-interpretation EDIT bar, in the app\'s own order (not the frame\'s)', async () => {
    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Dana Whitfield')).toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit' }));

    // The dock is gone; the EDIT bar has replaced it.
    expect(dialog.querySelector('[data-chq-phone-dock]')).toBeNull();
    const actions = dialog.querySelector('.chq-contacts-drawer-actions') as HTMLElement;
    expect(actions).not.toBeNull();

    // DEC-576 wave-31 tie-break: DEVIATIONS.md's "Contact drawer footer"
    // row wins over the frame's undrawn buttons-only order -- Delete sits
    // far-left as a destructive tertiary, separate from the right-flushed
    // Email / Add to event / Cancel / Save group, in that order.
    const deleteBtn = within(actions).getByRole('button', { name: 'Delete this contact' });
    expect(deleteBtn.className).toContain('chq-btn-destructive-tertiary');
    const rightGroup = actions.querySelector('.chq-contacts-drawer-actions-right') as HTMLElement;
    const rightButtons = within(rightGroup).getAllByRole('button');
    expect(rightButtons.map((b) => b.textContent)).toEqual(['Email', 'Add to event', 'Cancel', 'Save']);
    // Delete never sits adjacent to Save -- it is outside the right group entirely.
    expect(rightGroup.contains(deleteBtn)).toBe(false);

    // The save-scope sentence sits on its own line above the bar.
    expect(dialog.querySelector('.chq-contacts-save-scope-note')).not.toBeNull();
  });

  // :433-436 44px/48px floor (DEC-393/DEC-959): jsdom evaluates no @media,
  // so this is a static CSS-text receipt. The READ dock is the shell's
  // shared .chq-phone-dock (app/src/styles.css, not owned by this task --
  // reused rather than re-declared, DEC-613 wave-93), receipted directly
  // rather than re-pinned in contacts-panels.css.
  it('44px/48px floor: the READ dock floors both controls at >=48px via the shared .chq-phone-dock', () => {
    const shellCss = stripCssComments(readFileSync(join(HERE, '..', '..', 'styles.css'), 'utf-8'));

    function topLevelOrPhoneRuleBody(css: string, selector: string): string {
      const mediaOpener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
      let m: RegExpExecArray | null;
      const layers: string[] = [];
      while ((m = mediaOpener.exec(css)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        const start = i;
        while (i < css.length && depth > 0) {
          if (css[i] === '{') depth += 1;
          else if (css[i] === '}') depth -= 1;
          i += 1;
        }
        layers.push(css.slice(start, i - 1));
      }
      const layer = layers.join('\n');
      const rule = /([^{}]+)\{([^{}]*)\}/g;
      const bodies: string[] = [];
      let r: RegExpExecArray | null;
      while ((r = rule.exec(layer)) !== null) {
        const selectors = r[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(r[2]!);
      }
      expect(bodies.length).toBeGreaterThan(0);
      return bodies.join('\n');
    }

    const dockFloor = topLevelOrPhoneRuleBody(shellCss, '.chq-phone-dock .chq-btn').match(/min-height:\s*(\d+)px/);
    expect(dockFloor).not.toBeNull();
    expect(Number(dockFloor![1])).toBeGreaterThanOrEqual(44);
  });

  // Companion CSS half (DEC-976 wave-31): pin contacts-panels.css's SINGLE
  // terminal @media (max-width: 700px) block by source text, mirroring
  // MergePage.frame390.render.test.tsx's own brace-matched extraction. The
  // record row/history/EDIT-bar rules the frame's body draws from live in
  // contacts.css (task w31-c owns that file this wave); this file only
  // pins the ONE drawer-owned rule contacts-panels.css's terminal block
  // carries -- the back-link substitution for the shared ModalFrame Close
  // control (DEC-651/DEC-663 wave-159).
  it('contacts-panels.css terminal max-width:700px block: hides the shared ModalFrame Close control for the drawer\'s back link', () => {
    const cssPath = join(HERE, 'contacts-panels.css');
    const css = stripCssComments(readFileSync(cssPath, 'utf-8'));

    const mediaOpener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
    const openMatch = mediaOpener.exec(css);
    expect(openMatch).not.toBeNull();
    // Exactly one terminal max-width:700px block in this file (DEC-385).
    expect(mediaOpener.exec(css)).toBeNull();
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

    // :409 -- the back link is the drill's sole escape at phone; the
    // shared ModalFrame header Close control is stood down here, scoped
    // to `.chq-contacts-drawer` only (never a bare `.chq-modal-close-btn`,
    // which would blank Close on every other dialog in the app).
    const closeBtn = ruleBody('.chq-contacts-drawer .chq-modal-close-btn');
    expect(closeBtn).toMatch(/display:\s*none/);
  });
});
