// DEC-393 wave-17: receipt test for the "As" role chip's desktop floor fix.
//
// `docs/design/Chautauqua Contacts.dc.html`:602 draws the "As" role chip
// (the unselected -- "Reviewer" -- state, own text content "Reviewer") at
// `min-height:46px; ... padding:0 15px`. The desktop-control-floor-v12.md
// ledger's text-match join previously resolved this row to `chq-pill`
// (PeopleRolesPanel.tsx's UNRELATED Settings "Invite someone" chip -- see
// that file's own doc comment). The real control is
// `app/src/pages/contacts/AddToEventModal.tsx`'s
// `chq-btn chq-add-to-event-role-btn` button inside `.chq-segmented`,
// which renders its role list from the app's own vocabulary
// (PARTICIPANT_ROLE_OPTIONS) rather than a literal "Reviewer" string --
// exactly why the ledger's text-match join can never see this control
// directly (DEC-967: read the ACTUAL design-file line and product source,
// never trust a prior resolution).
//
// This test asserts, byte-for-byte:
//   1. the frame line the ledger cites still reads what this fix targets;
//   2. the product control renders the class the CSS rule below scopes to;
//   3. contacts-panels.css carries the scoped 46px floor rule.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/pages/contacts/
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const FRAME_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

describe('Contacts "As" role chip desktop floor (DEC-393 wave-17)', () => {
  it('the frame line the ledger cites still draws min-height:46px on the unselected role chip', () => {
    const lines = readFileSync(FRAME_FILE, 'utf-8').split('\n');
    // 1-based line 602.
    expect(lines[601]).toBe(
      '            <span style="border:1px solid #BAB6A6; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 15px; font-size:14px">Reviewer</span>'
    );
  });

  it('AddToEventModal.tsx renders the role buttons with chq-add-to-event-role-btn, not a literal Speaker/Reviewer/Guest chq-pill', () => {
    const tsx = readFileSync(join(HERE, 'AddToEventModal.tsx'), 'utf-8');
    expect(tsx).toMatch(/className=\{`chq-btn chq-add-to-event-role-btn\$\{role === opt\.value \? ' is-selected' : ''\}`\}/);
    expect(tsx).not.toMatch(/chq-pill/);
  });

  it('contacts-panels.css floors .chq-btn.chq-add-to-event-role-btn at the frame\'s own 46px', () => {
    const css = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');
    const ruleMatch = css.match(/\.chq-btn\.chq-add-to-event-role-btn\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    expect(ruleMatch![1]).toMatch(/min-height:\s*46px/);
  });
});
