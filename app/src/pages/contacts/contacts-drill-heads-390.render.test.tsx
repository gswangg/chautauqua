// w15-th (DEC-663 wave-159, task w15-th-contacts-drill-heads-390): the two
// Contacts phone drills (ContactDrawer, ImportWizard) each draw exactly ONE
// escape in their v12 390 head band -- the `‹ Contacts` back link
// (docs/design/Chautauqua Contacts.dc.html:409 "Contact · 390",
// :489-491 "Import CSV · 390") -- never a second Close beside it. This
// file receipts:
//   1. ImportWizard now supplies a `backLink` to ModalFrame (was omitted
//      entirely before this wave).
//   2. The Import match-columns subtitle carries the frame's phone
//      register at :491 (file name · row count · column position).
//   3. contacts-panels.css's terminal max-width:700px block stands down
//      ModalFrame's header Close for both drills once a back link is
//      present, scoped by each drill's own wrapper class -- never
//      ModalFrame.tsx, never a bare `.chq-modal-close-btn`.
//
// jsdom applies no stylesheet (no @media), so item 3's phone-only
// assertions read the CSS TEXT rather than computed style, following the
// `phoneLayerRuleBody` idiom ImportWizard.phoneColumns.render.test.tsx
// already uses in this directory (a local copy, not an import, per that
// file's own note that it stays untouched).
//
// OPEN FRAME DIVERGENCE (not this task's to fix): MergePage.tsx:283's
// `.chq-contacts-merge-picks` radio list has no counterpart in frame
// "Merge · 390" (docs/design/Chautauqua Contacts.dc.html:528,
// `<sc-for list="{{ mergeRows }}" as="m" hint-placeholder-count="5">`)
// because that mock assumes an already-chosen pair -- but the picker is
// what SELECTS which pair is merged, and removing it would strand the
// route with no way to reach a pair at all. Left in place; recorded here
// for a later DEVIATIONS ruling.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';
import { ContactDrawer } from './ContactDrawer';
import { mockApi } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import type { ContactDetail } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');
const PANELS_CSS = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Settings.frame-verdicts.render.
 * test.tsx's own `verbatimLine` and repointed at Chautauqua Contacts.dc.html. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** jsdom applies no stylesheet, so a "hidden/shown at phone width" claim
 * can only be verified against the CSS TEXT -- copied from
 * ImportWizard.phoneColumns.render.test.tsx's own `phoneLayerRuleBody`
 * (a local copy, not an import, per that file's own note). */
function phoneLayerRuleBody(css: string, selector: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  const layers: string[] = [];
  while ((m = opener.exec(withoutComments)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < withoutComments.length && depth > 0) {
      if (withoutComments[i] === '{') depth += 1;
      else if (withoutComments[i] === '}') depth -= 1;
      i += 1;
    }
    layers.push(withoutComments.slice(start, i - 1));
  }
  const layer = layers.join('\n');
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let rm: RegExpExecArray | null;
  while ((rm = rule.exec(layer)) !== null) {
    const selectors = rm[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectors.includes(selector)) return rm[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

/** Same technique for a plain top-level (outside any @media) rule -- copied
 * from ImportWizard.render.test.tsx's `topLevelRuleBody`. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme', 'Jane,Smith,jane@example.com,Beta'].join(
  '\n',
);

const CONTACT: ContactDetail = {
  id: 'ct1',
  firstName: 'Priya',
  lastName: 'Raman',
  email: 'priya@example.com',
  company: 'Latticework Systems',
  title: 'Principal Engineer',
  labels: [],
  phone: null,
  notes: null,
  bio: null,
  headshotUrl: null,
  socialLinks: { twitter: '@priya', linkedin: '', github: '', website: '' },
  customFields: {},
  history: {
    submissions: [],
    submissionsTotal: 0,
    emails: [],
    emailsTotal: 0,
    events: [],
    eventsTotal: 0,
  },
};

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

describe('ImportWizard head band gets a back link (DEC-663 wave-159)', () => {
  it('renders the ‹ Contacts back link, wired to the wizard\'s onClose', async () => {
    verbatimLine(489, '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Contacts</a>');
    const onClose = vi.fn();
    render(<ImportWizard onClose={onClose} onImported={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    const back = within(dialog).getByRole('button', { name: '‹ Contacts' });
    expect(back).toHaveClass('chq-phone-back');

    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the match-columns subtitle carries the frame\'s phone register: file · rows · column position (:491)', async () => {
    verbatimLine(491, '        <span style="font-size:13px; color:#565A4B">speakers.csv · 214 rows · 2 of 5</span>');
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);

    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Match the columns');

    const dialog = screen.getByRole('dialog', { name: 'Import contacts' });
    // Pasted text has no file name -- the wizard's own "Pasted CSV" fallback
    // (ImportWizard.tsx, chq-contacts-import-match-filename) is reused here.
    const phoneSubtitle = within(dialog).getByText('Pasted CSV · 2 rows · 1 of 4');
    expect(phoneSubtitle).toHaveClass('chq-contacts-import-subtitle-phone');
    const desktopSubtitle = within(dialog).getByText('Pasted CSV · 2 rows');
    expect(desktopSubtitle).toHaveClass('chq-contacts-import-subtitle-desktop');
  });

  it('desktop\'s own copy of the step (:285-286) carries file · rows with NO column position', () => {
    verbatimLine(285, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.035em; line-height:1">Match the columns</span>');
    verbatimLine(286, '          <span style="font-size:13px; color:#565A4B">speakers.csv · 214 rows</span>');
    // Same DOM node the phone assertion above reads -- desktop's copy is
    // the sibling span shown once .chq-contacts-import-subtitle-phone goes
    // hidden below 700px (contacts-panels.css); this test is the CSS-text
    // half of that swap, receipted separately from the DOM assertion above
    // since jsdom evaluates no @media at all.
    const phoneBody = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-subtitle-desktop');
    expect(phoneBody).toMatch(/display:\s*none/);
    const desktopDefault = topLevelRuleBody(PANELS_CSS, '.chq-contacts-import-subtitle-phone');
    expect(desktopDefault).toMatch(/display:\s*none/);
  });
});

describe('Redundant phone Close stands down once a back link is present (DEC-663 wave-159)', () => {
  it('desktop is frozen: neither drill\'s Close rule exists outside the terminal max-width:700px block', () => {
    // topLevelRuleBody throws if the selector has a top-level (non-media)
    // declaration -- both must throw, proving the standdown is 390-only.
    expect(() => topLevelRuleBody(PANELS_CSS, '.chq-contacts-import .chq-modal-close-btn')).toThrow();
    expect(() => topLevelRuleBody(PANELS_CSS, '.chq-contacts-drawer .chq-modal-close-btn')).toThrow();
  });

  it('ImportWizard: .chq-contacts-import .chq-modal-close-btn is hidden inside the terminal phone block', () => {
    const body = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import .chq-modal-close-btn');
    expect(body).toMatch(/display:\s*none/);
  });

  it('ContactDrawer: .chq-contacts-drawer .chq-modal-close-btn is hidden inside the terminal phone block', () => {
    const body = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-drawer .chq-modal-close-btn');
    expect(body).toMatch(/display:\s*none/);
  });

  it('the standdown is a substitution, not a capability removal: ImportWizard\'s back link calls the same onClose Close called', async () => {
    const onClose = vi.fn();
    render(<ImportWizard onClose={onClose} onImported={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });

    // Both controls still exist in the DOM (jsdom renders regardless of the
    // @media rule that would hide Close at 390) and both call the SAME
    // handler the wizard was given.
    const back = within(dialog).getByRole('button', { name: '‹ Contacts' });
    const closeBtn = within(dialog).getByRole('button', { name: 'Close' });
    fireEvent.click(back);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('the standdown is a substitution, not a capability removal: ContactDrawer\'s back link calls the same onClose Close called', async () => {
    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });
    const onClose = vi.fn();
    render(<ContactDrawer contactId="ct1" onClose={onClose} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });
    const back = within(dialog).getByRole('button', { name: '‹ Contacts' });
    const closeBtn = within(dialog).getByRole('button', { name: 'Close' });
    fireEvent.click(back);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
