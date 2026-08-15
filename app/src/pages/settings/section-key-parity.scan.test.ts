// w3-a/DEC-728 amendment: Settings.tsx's SECTIONS rail and each panel's own
// SummarySection drill (`?section=<key>&edit=1`) must agree on exactly one
// spelling per section -- a panel that declares a SECTION_KEY the rail
// doesn't know (or vice versa) silently strands the B10 single-panel screen
// (the read scroll renders instead, per Settings.tsx's urlSection fallback
// to null). This walks every *Panel.tsx source under this directory with
// node:fs (the app/src/optionality-grammar-scan.test.ts pattern) and diffs
// the declared SECTION_KEY literals against SECTIONS' own keys, so a panel
// that invents a second spelling fails the build instead of silently
// falling back to the read scroll.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../Settings';

const HERE = dirname(fileURLToPath(import.meta.url));

// The seven files Settings.tsx's SECTIONS array itself imports as a rail
// entry's Panel -- deliberately NOT every *Panel.tsx in this directory
// (ApiTokensPanel, ExportsPanel, EmbedsPanel, ResourcesPanel,
// SavedEmbedsPanel, SessionboardImportPanel, etc. are sub-panels drilled
// into from inside a rail panel and never declare their own top-level
// SECTION_KEY -- that's expected, not a gap this scan checks). PublicPagesPanel
// has no edit view at all (B10 DROP, DEC-896 amendment wave 26) -- it never
// declares a SECTION_KEY and is exempt here by name.
const RAIL_PANEL_FILES = [
  'EventSettingsPanel.tsx',
  'CallForPapersPanel.tsx',
  'TracksRoomsPanel.tsx',
  'PortalSettingsPanel.tsx',
  'PeopleRolesPanel.tsx',
  'YourDataPanel.tsx',
];
const EXEMPT_NO_SECTION_KEY = new Set(['PublicPagesPanel.tsx']);

function walkPanelFiles(dir: string): string[] {
  return RAIL_PANEL_FILES.map((name) => join(dir, name));
}

describe('DEC-728 (w3-a): every settings panel SECTION_KEY matches a SECTIONS rail key exactly', () => {
  it('the set of declared SECTION_KEY literals equals SECTIONS keys minus the B10-exempt public-pages panel', () => {
    const declaredKeys = new Set<string>();
    const filesWithoutKey: string[] = [];

    for (const file of walkPanelFiles(HERE)) {
      const name = file.split('/').pop() as string;
      const source = readFileSync(file, 'utf8');
      const match = source.match(/const SECTION_KEY = '([^']+)'/);
      if (match && match[1] !== undefined) {
        declaredKeys.add(match[1]);
      } else if (!EXEMPT_NO_SECTION_KEY.has(name)) {
        filesWithoutKey.push(name);
      }
    }

    expect(filesWithoutKey).toEqual([]);

    const railKeys = new Set(SECTIONS.filter((s) => s.key !== 'public-pages').map((s) => s.key));

    expect(declaredKeys).toEqual(railKeys);
  });
});
