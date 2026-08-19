// DEC-781/DEC-747/DEC-896: pure CSS-source-scan pins for the tracks-and-
// rooms grid geometry and the shared .chq-settings-row/.chq-settings-edit-row
// vocabulary. These assertions never render a component, so this file needs
// no DOM/jsdom -- it runs under the default "node" environment.
//
// Custodian decomposition (contention hotspot): split out of
// TracksRoomsPanel.render.test.tsx -- the CSS-only half of that suite. No
// behavior changed; every `it` below is verbatim from the pre-split file.
// Shared fixtures live in TracksRoomsPanel.render-helpers.ts.
import { describe, expect, it } from 'vitest';
import { SETTINGS_CSS, topLevelRuleBody } from './TracksRoomsPanel.render-helpers';

describe('TracksRoomsPanel CSS geometry', () => {
  it('the tracks-and-rooms columns split the full 820px measure as two even halves with counts right-flushed (DEC-781)', () => {
    const gridBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-tracks-rooms-grid');
    expect(gridBody).toMatch(/display:\s*grid/);
    expect(gridBody).toMatch(/grid-template-columns:\s*1fr 1fr/);

    const rowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-tracks-rooms-row');
    expect(rowBody).toMatch(/display:\s*grid/);
    // name column flexes, the count/capacity column is auto-sized and
    // right-flushed against the row's own end -- not centered, not left.
    expect(rowBody).toMatch(/grid-template-columns:\s*1fr auto/);
  });

  it('hosts the tracks-and-rooms grid inside a .chq-settings-row that itself collapses to one full-width column (DEC-747/DEC-781)', () => {
    const fullRowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row-full');
    expect(fullRowBody).toMatch(/grid-template-columns:\s*1fr/);
  });

  // w22-c/DEC-896: tracks and rooms edit rows carry different column
  // counts, so the shared .chq-settings-edit-row class no longer owns a
  // grid-template-columns of its own -- each entity gets its own width hook.
  it('.chq-settings-edit-row declares no grid-template-columns of its own (shared chrome only)', () => {
    const rowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-edit-row');
    expect(rowBody).toMatch(/display:\s*grid/);
    expect(rowBody).not.toMatch(/grid-template-columns/);
  });

  it('.chq-settings-track-edit-row: frame tracks columns with a FIXED actions track (user-filed: auto resized when dirty Save/Cancel appeared)', () => {
    const body = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-track-edit-row');
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*150px\s*200px/);
  });

  it('.chq-settings-room-edit-row: frame rooms columns with a FIXED actions track (same user-filed geometry rule)', () => {
    const body = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-room-edit-row');
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*110px\s*150px\s*200px/);
  });
});

describe('DEC-781: .chq-settings-row is ONE grid row, not a column stack', () => {
  it('settings.css declares .chq-settings-row exactly once at the top level (no dead duplicate a source-scan or the cascade could silently prefer)', () => {
    const withoutMedia = SETTINGS_CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const matches = withoutMedia.match(/(^|\n)\.chq-settings-row\s*\{/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the row is a three-column definition grid (label | value | right-flushed meta), not a flex column stack', () => {
    const rowBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row');
    expect(rowBody).toMatch(/display:\s*grid/);
    expect(rowBody).not.toMatch(/flex-direction:\s*column/);
    expect(rowBody).toMatch(/grid-template-columns:\s*170px 1fr auto/);
  });

  it('the meta (hint) column right-flushes its content so it collapses to nothing when absent', () => {
    const hintBody = topLevelRuleBody(SETTINGS_CSS, '.chq-settings-row-hint');
    expect(hintBody).toMatch(/text-align:\s*right/);
  });
});
