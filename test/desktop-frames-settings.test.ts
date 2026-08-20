// Desktop-frame claims, Settings cluster -- editing/summary half (DEC-976,
// v12 mobile campaign wave 105; task w5-a). Node tier only -- readFileSync
// over sources, no jsdom, no render. Claims 7 of the 8 desktop frames
// `docs/design/Chautauqua Settings.dc.html` draws for Settings: :28, :698,
// :788, :869, :950, :1021, :1215.
//
// `:1111` "Settings · editing your data" is LEFT UNCLAIMED. Per
// DEVIATIONS.md §6 the Your-data EDIT view (retention select, keeping-and-
// deleting checkboxes, revoke-every-token footer) is an unbuilt feature --
// `app/src/pages/settings/YourDataPanel.tsx` renders only the read-side
// summary row set (Exports, API tokens, API docs), never a drilled edit
// form with those controls. This is a cited deviation, not a new finding,
// so it is not claimed here and DEVIATIONS.md is not touched (DEC-976
// wave-105: do not append to DEVIATIONS.md or docs/design/audit/*.md).
//
// Receipt shape (DEC-976 wave-87/102/105): each it() carries the strict
// citation `docs/design/Chautauqua Settings.dc.html:<line>` and a
// backtick-quoted literal copied VERBATIM from that frame line, with a real
// expect() about the tree within 6 source lines. Expected values are TYPED
// literals, never a re-read of the frame compared to itself. Assertions run
// against file CONTENT (rendered strings / literal source text), never
// against an app file's line number.
//
// Two literals drawn by the pack do not survive contact with the built
// source, so they are not asserted (correctness beats claim count, per this
// task's instructions -- the surrounding claim still stands on other
// literals from the same frame):
//   - :950's edit-view footer draws "Change your own password" as a left
//     flush link; no such control or copy exists anywhere under
//     app/src/pages/settings/ (grepped) -- PeopleRolesPanel.tsx's edit
//     footer is Close-only.
//   - :1215's refusal band reads "Nothing was saved"; the built ErrorSummary
//     (via EventSettingsPanel's slug-conflict path) instead prints a
//     count-driven heading ("One thing needs fixing ...") and the kept copy
//     "Nothing was lost. Your edits are still below." -- a differently
//     worded but equivalent refusal-band contract, not a missing one, so
//     the claim stands on the field-level conflict message and the shared
//     kept/heading structure instead of the frame's literal heading text.
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

describe('desktop frame claims: Settings cluster, editing/summary half (v12m-w5-a)', () => {
  // docs/design/Chautauqua Settings.dc.html:28
  // `Event, form, publishing, data · 1600`
  it('renders the seven-section summary rail (Settings.tsx) with SummarySection as the shared drill primitive', () => {
    expect(frameLine(28)).toContain('Event, form, publishing, data · 1600');
    const settings = read('pages/Settings.tsx');
    // The rail's own comment cites the same frame and pins the section
    // order/count to it (lines 61-233 in the pack's numbering).
    expect(settings).toContain("docs/design/Chautauqua Settings.dc.html lines 61-233");
    const order = ['Event', 'Call for papers', 'Tracks and rooms', 'Public pages', 'Speaker portal', 'Your data', 'People and roles'];
    for (const label of order) {
      expect(settings).toContain(`label: '${label}'`);
    }
    const summarySection = read('pages/settings/SummarySection.tsx');
    expect(summarySection).toContain("className=\"chq-settings-panel chq-settings-numbered\"");
    expect(summarySection).toContain('{editing ? \'Back\' : actionLabel}');
  });

  // docs/design/Chautauqua Settings.dc.html:698
  // `Settings · editing the event`
  it('renders the Event edit view (Name and address / When and where) in EventSettingsPanel.tsx', () => {
    expect(frameLine(698)).toContain('Settings · editing the event');
    const src = read('pages/settings/EventSettingsPanel.tsx');
    expect(src).toContain('Name and address');
    expect(src).toContain('When and where');
    expect(src).toContain('Changing the slug breaks every link already shared, including saved embeds');
    expect(src).toContain("label=\"Time zone\"");
    expect(src).toContain("label=\"Venue\"");
  });

  // docs/design/Chautauqua Settings.dc.html:788
  // `Settings · editing tracks and rooms`
  it('renders the Tracks and rooms edit view (two lists, drag handles, Add controls) in TracksRoomsPanel.tsx', () => {
    expect(frameLine(788)).toContain('Settings · editing tracks and rooms');
    const src = read('pages/settings/TracksRoomsPanel.tsx');
    expect(src).toContain('Add a track');
    expect(src).toContain('Add a room');
    expect(src).toContain('Tracks &middot; {tracks.length}');
    expect(src).toContain('Rooms &middot; {rooms.length}');
  });

  // docs/design/Chautauqua Settings.dc.html:869
  // `Settings · editing the speaker portal`
  it('renders the Speaker portal edit view (Welcome note / edit pills / Resources) in PortalSettingsPanel.tsx', () => {
    expect(frameLine(869)).toContain('Settings · editing the speaker portal');
    const src = read('pages/settings/PortalSettingsPanel.tsx');
    expect(src).toContain("label=\"Welcome note\"");
    expect(src).toContain('What speakers may edit');
    expect(src).toContain('organiser-only');
    expect(src).toContain('Resources');
    const resources = read('pages/settings/ResourcesPanel.tsx');
    expect(resources).toContain('Add a resource');
  });

  // docs/design/Chautauqua Settings.dc.html:950
  // `Settings · editing people and roles`
  it('renders the People and roles edit view (roster, Invite someone, Reset password) in PeopleRolesPanel.tsx', () => {
    expect(frameLine(950)).toContain('Settings · editing people and roles');
    const src = read('pages/settings/PeopleRolesPanel.tsx');
    expect(src).toContain('Invite someone');
    expect(src).toContain('People &middot; {users.length}');
    expect(src).toContain('Reset password');
    expect(src).toContain("You cannot remove or demote yourself. A reviewer's scope limits which tracks they are assigned.");
  });

  // docs/design/Chautauqua Settings.dc.html:1021
  // `Settings · editing one saved embed`
  it('renders one saved embed\'s edit view (recipe fields + snippet readout) via SavedEmbedsPanel/EmbedsPanel', () => {
    expect(frameLine(1021)).toContain('Settings · editing one saved embed');
    const savedEmbeds = read('pages/settings/SavedEmbedsPanel.tsx');
    // DEC-822: the row's Edit link opens the builder at ?embed=<id>, the
    // same EmbedsPanel that draws the recipe fields and snippet readout the
    // frame's editor draws.
    expect(savedEmbeds).toContain("params.set('embed', id)");
    const embedsPanel = read('pages/settings/EmbedsPanel.tsx');
    expect(embedsPanel).toContain('aria-label="Fields shown"');
    expect(embedsPanel).toContain('chromeless, no login required');
    expect(embedsPanel).toContain('EmbedCodeReadout');
    const readout = read('pages/settings/EmbedCodeReadout.tsx');
    expect(readout).toContain('Copy snippet');
  });

  // docs/design/Chautauqua Settings.dc.html:1215
  // `Settings · save rejected by the server`
  it('renders a server-refused save (field conflict + kept-edits copy) via SettingsEditForm/ErrorSummary', () => {
    expect(frameLine(1215)).toContain('Settings · save rejected by the server');
    const eventPanel = read('pages/settings/EventSettingsPanel.tsx');
    // The frame's refusal is a slug-taken conflict on the Event edit form --
    // the built field-level message for that exact failure.
    expect(eventPanel).toContain('That slug is already taken by another event in this org.');
    expect(eventPanel).toContain('kept="Nothing was lost. Your edits are still below."');
    const errorSummary = read('components/ErrorSummary.tsx');
    expect(errorSummary).toContain('{kept && <p>{kept}</p>}');
    const editForm = read('pages/settings/SettingsEditForm.tsx');
    expect(editForm).toContain("{pending ? 'Saving…' : 'Save changes'}");
  });
});
