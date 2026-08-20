// v12m-w9-o-r1-c (DEC-964/DEC-893): Pipeline and Duplicates become
// one-screen-at-a-time phone drills at 390, each with its OWN head band --
// "‹ Contacts" back control, an H1, a count line -- as the FIRST child of
// the drill, not the parent .chq-page's landing head
// (.chq-contacts-title-row / .chq-contacts-tabstrip-row).
//
// jsdom applies no stylesheet and evaluates no @media rule, so these are
// source-scan pins over the .tsx JSX text, not computed style (mirrors
// MergePage.phoneFrame.test.ts). Every assertion below carries a DEC-976
// receipt: a backtick-quoted VERBATIM literal from the cited frame line,
// and a real `expect(` within 6 source lines beneath the comment.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const PIPELINE_TSX = readFileSync(join(HERE, 'PipelineBoard.tsx'), 'utf-8');
const DUPLICATES_TSX = readFileSync(join(HERE, 'DuplicatesView.tsx'), 'utf-8');
const CONTACTS_APP_TSX = readFileSync(join(HERE, 'ContactsApp.tsx'), 'utf-8');

describe('v12 phone drill "Pipeline · 390" (docs/design/Chautauqua Contacts.dc.html:447-451)', () => {
  // docs/design/Chautauqua Contacts.dc.html:448 `<div style="border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:7px">`
  it('head element composes the shell vocabulary onto the page-local head, page-local class kept', () => {
    expect(PIPELINE_TSX).toMatch(
      /<div className="chq-contacts-pipeline-head chq-phone-head chq-phone-head-drill">/,
    );
  });

  // docs/design/Chautauqua Contacts.dc.html:449 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Contacts</a>`
  it('back control carries chq-phone-back alongside its page-local class', () => {
    expect(PIPELINE_TSX).toMatch(
      /className="chq-btn chq-btn-tertiary chq-contacts-pipeline-back chq-phone-back"/,
    );
  });
});

describe('v12 phone drill head for Duplicates, derived from the "Pipeline · 390" frame band (DEC-964: Duplicates has no 390 frame of its own; the band\'s own lines are receipted at the expects below)', () => {
  it('imports and calls useIsPhone to gate the drill head', () => {
    expect(DUPLICATES_TSX).toMatch(/import \{ useIsPhone \} from '\.\.\/\.\.\/lib\/useIsPhone';/);
    expect(DUPLICATES_TSX).toMatch(/const isPhone = useIsPhone\(\);/);
  });

  // docs/design/Chautauqua Contacts.dc.html:448 `<div style="border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:7px">`
  it('renders a chq-phone-head chq-phone-head-drill element gated on isPhone', () => {
    expect(DUPLICATES_TSX).toMatch(/\{isPhone && \(\s*<div className="chq-phone-head chq-phone-head-drill">/);
  });

  // docs/design/Chautauqua Contacts.dc.html:449 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Contacts</a>`
  it('renders a chq-phone-back control that fires onBack', () => {
    expect(DUPLICATES_TSX).toMatch(
      /<button type="button" className="chq-link-button chq-phone-back" onClick=\{onBack\}>/,
    );
    expect(DUPLICATES_TSX).toMatch(/&lsaquo; Contacts/);
  });

  // docs/design/Chautauqua Contacts.dc.html:450 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Pipeline</h1>`
  it('renders an H1 titled Duplicates', () => {
    expect(DUPLICATES_TSX).toMatch(/<h1 className="chq-page-title">Duplicates<\/h1>/);
  });

  // docs/design/Chautauqua Contacts.dc.html:451 `<span style="font-size:13px; color:#565A4B">20 people</span>`
  it('renders a chq-summary count line using the countOf helper, never a hand-typed count', () => {
    expect(DUPLICATES_TSX).toMatch(
      /<span className="chq-summary">\{countOf\(statedTotal, 'possible duplicate'\)\}<\/span>/,
    );
  });

  it('onBack is an optional prop threaded through, never a hard requirement that breaks other callers', () => {
    expect(DUPLICATES_TSX).toMatch(/onBack\?: \(\) => void;/);
    expect(DUPLICATES_TSX).toMatch(
      /export function DuplicatesView\(\{ onMerged, initialNotice, initialDismissPairIds, onBack \}: Props\) \{/,
    );
  });
});

describe('ContactsApp stands its landing head down behind a phone drill (DEC-964)', () => {
  it('imports and calls useIsPhone', () => {
    expect(CONTACTS_APP_TSX).toMatch(/import \{ useIsPhone \} from '\.\.\/\.\.\/lib\/useIsPhone';/);
    expect(CONTACTS_APP_TSX).toMatch(/const isPhone = useIsPhone\(\);/);
  });

  it('gates chq-contacts-title-row on isPhone and panel', () => {
    expect(CONTACTS_APP_TSX).toMatch(
      /\{!\(isPhone && panel !== 'directory'\) && \(\s*<div className="chq-contacts-title-row">/,
    );
  });

  it('gates chq-contacts-tabstrip-row on isPhone and panel', () => {
    expect(CONTACTS_APP_TSX).toMatch(
      /\{!\(isPhone && panel !== 'directory'\) && \(\s*<div className="chq-toolbar chq-contacts-tabstrip-row">/,
    );
  });

  it('passes onBack to DuplicatesView so its drill head can return to the directory', () => {
    expect(CONTACTS_APP_TSX).toMatch(/<DuplicatesView\s/);
    expect(CONTACTS_APP_TSX).toMatch(/onBack=\{\(\) => setPanel\('directory'\)\}/);
  });
});

describe("DEC-893: 'Add to the pipeline' keeps its landed full-width 48px head placement", () => {
  it('the pipeline head still owns the add-to-pipeline action, not moved out into the board body', () => {
    const headStart = PIPELINE_TSX.indexOf('chq-contacts-pipeline-head chq-phone-head chq-phone-head-drill');
    expect(headStart).toBeGreaterThan(-1);
    // The head <div> spans from its opening tag to the matching close --
    // find the next top-level sibling to bound the search so a match deep
    // in the board body below can't be mistaken for one inside the head.
    const nextSection = PIPELINE_TSX.indexOf('chq-contacts-pipeline-columns', headStart);
    const headSlice = PIPELINE_TSX.slice(headStart, nextSection === -1 ? undefined : nextSection);
    expect(headSlice).toMatch(/Add to the pipeline/);
  });
});
