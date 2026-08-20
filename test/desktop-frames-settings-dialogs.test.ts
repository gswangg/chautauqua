// Desktop-frame claims, Settings cluster -- the DIALOG half (DEC-976, v12
// mobile campaign wave 105; task v12m-w5-b). Node tier only -- readFileSync
// over sources, no jsdom, no render. Header + `frameLine(n)` + `read(...)`
// copied verbatim from test/desktop-frames-comms.test.ts (task v12m-w3-r).
//
// Frames worked, from `docs/design/Chautauqua Settings.dc.html`: :1271
// "Invite someone", :1319 "Invite - the one-time password", :1352 "Invite -
// rejected", :1392 "Confirm - reversible", :1414 "Confirm - irreversible",
// :1440 "Portal resource - add", :1477 "Reset a password", :1507 "Import
// from Sessionboard".
//
// Receipt shape (DEC-976 wave-87/102/104): each it() carries the strict
// citation `docs/design/Chautauqua Settings.dc.html:<line>` and a
// backtick-quoted literal copied VERBATIM from that frame line, with a real
// expect() about the tree within 6 source lines. Expected values are TYPED
// literals, never a re-read of the frame compared to itself. Per DEC-976
// wave-104 the citation lives in the it()-body comment, not the describe
// title, so it is inside the tautology guard's widened population.
//
// JUDGEMENT (DEC-976 wave-105), per this task's own instructions: DEVIATIONS
// Sec.6 already defers "shared ConfirmDialog 480/subtitle/typed-label
// anatomy (09--21/22)" and "Sessionboard importer modal + per-entity
// dispositions (09--25)" as post-deadline reworks. Read against those:
//
//   - :1392/:1414 (Confirm - reversible/irreversible): the drawn ANATOMY
//     (480px frame, a `.chq-modal-sub` subtitle line, the typed-confirm
//     input's exact placement) is the deferred item and is NOT claimed
//     here. What the tree DOES satisfy, and what these two it()s claim
//     instead, is the behavioural contract the two frames actually draw:
//     a reversible action takes one sentence + Cancel + a primary with no
//     typing (SavedEmbedsPanel.tsx's embed toggle-off, itself an
//     almost-verbatim match of the frame's "Turn off ... ?" / "Turn it
//     off" / "Nothing is deleted" copy), and an irreversible action
//     requires typing the exact name before its destructive-verb primary
//     unlocks (ResourcesPanel.tsx's resource delete, ConfirmDialog's own
//     named example of `weight="irreversible"`). ConfirmDialog.tsx +
//     confirm-dialog.css are the shared component; the two callers are
//     cited as its real population.
//   - :1507 (Import from Sessionboard) is LEFT UNCLAIMED. DEVIATIONS Sec.6
//     names this exact frame ("Sessionboard importer modal + per-entity
//     dispositions (09--25)") as a deferred rework, and the tree confirms
//     why: SessionboardImportPanel.tsx builds an inline page-embedded
//     panel with a 3-step rail ("Choose file" / "Review what will change"
//     / "Done"), never the drawn 620px modal, and its report is an
//     aggregate created/updated/skipped count, never the drawn
//     per-entity-row disposition table. No it() below cites :1507; this
//     comment is the required divergence note.
//
// DESKTOP IS FROZEN: this file asserts against existing source; it makes no
// CSS/TSX change.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const FRAME_LINES = readFileSync(DESIGN_FILE, 'utf-8').split('\n');

/** 1-based line lookup so a citation's quote can be asserted against the
 * pack itself (not re-derived), catching a re-cut that moves the line. */
function frameLine(n: number): string {
  const line = FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Settings.dc.html has no line ${n}`);
  return line;
}

const APP_SRC = join(REPO_ROOT, 'app', 'src');

function read(relPath: string): string {
  return readFileSync(join(APP_SRC, relPath), 'utf-8');
}

describe('desktop frame claims: Settings cluster, dialog half (v12m-w5-b)', () => {
  // docs/design/Chautauqua Settings.dc.html:1271
  // `Invite someone`
  it('renders the "Invite someone" dialog (create-at-once, no pending state) in PeopleRolesPanel.tsx', () => {
    expect(frameLine(1271)).toContain('Invite someone');
    const src = read('pages/settings/PeopleRolesPanel.tsx');
    expect(src).toContain("title=\"Invite someone\"");
    expect(src).toContain("{creating ? 'Creating…' : 'Create the account'}");
    expect(src).toContain('This is the username they sign in with');
  });

  // docs/design/Chautauqua Settings.dc.html:1319
  // `Invite · the one-time password`
  it('renders the reveal-once password step (same dialog, swapped body) in PeopleRolesPanel.tsx', () => {
    expect(frameLine(1319)).toContain('Invite');
    expect(frameLine(1319)).toContain('the one-time password');
    const src = read('pages/settings/PeopleRolesPanel.tsx');
    expect(src).toContain('can now sign in');
    expect(src).toContain('Closing this dialog is the last time you see it — after that only a reset can replace it.');
  });

  // docs/design/Chautauqua Settings.dc.html:1352
  // `Invite · rejected`
  it('renders the duplicate-email rejection (kept fields + route to the existing row) in PeopleRolesPanel.tsx', () => {
    expect(frameLine(1352)).toContain('Invite');
    expect(frameLine(1352)).toContain('rejected');
    const src = read('pages/settings/PeopleRolesPanel.tsx');
    expect(src).toContain("err.code === 'conflict' && err.fields?.email");
    expect(src).toContain("Open {personLabel(duplicateUser)}&apos;s row");
  });

  // JUDGEMENT (see file header): the 480px/subtitle anatomy is the
  // DEVIATIONS Sec.6-deferred "shared ConfirmDialog ... anatomy" item and is
  // not claimed; the reversible WEIGHT contract (one sentence, Cancel, a
  // primary, no typing) is what this it() claims, against ConfirmDialog.tsx
  // itself and its real reversible caller SavedEmbedsPanel.tsx.
  // docs/design/Chautauqua Settings.dc.html:1392
  // `Confirm · reversible`
  it('reversible confirms take a default weight with no typed confirmation, per ConfirmDialog.tsx + SavedEmbedsPanel.tsx', () => {
    expect(frameLine(1392)).toContain('Confirm · reversible');
    const dialogSrc = read('components/ConfirmDialog.tsx');
    expect(dialogSrc).toContain("weight = 'reversible'");
    expect(dialogSrc).toContain("weight === 'irreversible' && (");
    const callerSrc = read('pages/settings/SavedEmbedsPanel.tsx');
    expect(callerSrc).toContain('confirmLabel="Turn it off"');
    expect(callerSrc).not.toContain('weight="irreversible"');
  });

  // JUDGEMENT (see file header): same anatomy deferral as :1392. The
  // "type the name, destructive verb unlocks" contract is what this it()
  // claims, against ConfirmDialog.tsx's own throw-if-no-phrase guard and its
  // named irreversible caller ResourcesPanel.tsx.
  // docs/design/Chautauqua Settings.dc.html:1414
  // `Confirm · irreversible`
  it('irreversible confirms require typing confirmPhrase before the destructive primary unlocks, per ConfirmDialog.tsx + ResourcesPanel.tsx', () => {
    expect(frameLine(1414)).toContain('Confirm · irreversible');
    const dialogSrc = read('components/ConfirmDialog.tsx');
    expect(dialogSrc).toContain(
      "throw new Error(\"ConfirmDialog: weight='irreversible' requires a non-empty confirmPhrase\")",
    );
    expect(dialogSrc).toContain('typed.trim().toLowerCase() === (confirmPhrase as string).trim().toLowerCase()');
    const callerSrc = read('pages/settings/ResourcesPanel.tsx');
    expect(callerSrc).toContain('weight="irreversible"');
    expect(callerSrc).toContain('confirmPhrase={pendingDelete.title}');
  });

  // JUDGEMENT: DEC-650's wave-130 amendment (landed by v12m-w5-m) collapsed
  // the frame's kind-specific verbs to ONE primary label, 'Add it' (:1469),
  // for both resource kinds -- what a two-verb claim ("Add wiki page" /
  // "Upload file") used to assert is the divergence that lane removed. This
  // it() claims the frame as it now reads: :1469's single primary, :1454's
  // `Name` field label, and :1456's help copy, all against ResourcesPanel.tsx.
  // docs/design/Chautauqua Settings.dc.html:1440
  // `Portal resource · add`
  it('renders the "Add a resource" dialog (Kind toggle, Name + hint, one Add it primary) in ResourcesPanel.tsx', () => {
    expect(frameLine(1440)).toContain('Portal resource · add');
    expect(frameLine(1454)).toContain('Name');
    expect(frameLine(1456)).toContain('What speakers see in the list');
    expect(frameLine(1469)).toContain('Add it');
    const src = read('pages/settings/ResourcesPanel.tsx');
    expect(src).toContain('title="Add a resource"');
    expect(src).toContain('aria-label="Kind"');
    // DEC-650 wave-130/131: the pack draws ONE primary for a dialog whose
    // Kind control switches what is being added, and names the field `Name`
    // with the hint "What speakers see in the list" -- so the claim is
    // anchored on the CONTENT the pack prints, never on a line number in
    // either file (the two-verb `Add wiki page`/`Upload file` pair this
    // claim used to pin WAS the divergence, and is gone). Typed literals on
    // the app side, so no assertion here is pack-vs-pack.
    expect(src).toContain('Add it');
    expect(src).toContain('label="Name"');
    expect(src).toContain('help="What speakers see in the list"');
    expect(src).not.toContain("'Add wiki page'");
  });

  // docs/design/Chautauqua Settings.dc.html:1477
  // `Reset a password`
  it('renders the reset-password reveal (sessions ended everywhere, no email sent) in PeopleRolesPanel.tsx', () => {
    expect(frameLine(1477)).toContain('Reset a password');
    const src = read('pages/settings/PeopleRolesPanel.tsx');
    expect(src).toContain('is ended — they are signed out everywhere.');
    expect(src).toContain('Resetting sends no email; pass the new password on yourself.');
  });
});
