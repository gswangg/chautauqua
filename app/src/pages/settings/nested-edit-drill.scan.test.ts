// DEC-785 amendment (wave 66): a panel that accepts a `readOnly` prop is,
// by construction, only ever mounted inside its caller's own edit drill
// (`?section=<key>&edit=1`). Before this wave, ApiTokensPanel and
// ResourcesPanel each ALSO owned a second, local summary/edit split
// (`showEditor` state + 'Change'/'Back' controls) gating their own
// create/revoke and add/edit/delete surfaces behind a second click -- a
// drill inside the drill, so Revoke/Delete were unreachable on first
// arrival at the caller's already-gated edit URL.
//
// This scan derives its population from source, not a hand-list (the
// DEC-180/DEC-367 family): every `app/src/pages/settings/*.tsx` whose own
// function signature declares a `readOnly` prop (not merely mentions the
// word -- CallForPapersPanel etc. pass `readOnly` as a plain HTML input
// attribute, and PortalSettingsPanel/YourDataPanel pass it as a JSX prop
// into ApiTokensPanel/ResourcesPanel; neither declares it as ITS OWN prop).
// For every file in that population, the file must NOT also declare a local
// edit-toggle `useState` (the `showEditor`/`show<X>` boolean pattern this
// wave removed) -- that would be the nested drill reintroduced.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

// Matches a component's own destructured-props signature declaring a
// `readOnly` prop, e.g. `({ readOnly = false }: { readOnly?: boolean })`.
// Deliberately anchored on BOTH the destructure and the type annotation so
// a file that merely forwards `readOnly` as a JSX attribute (an HTML
// `<input readOnly />` or `<ChildPanel readOnly />`) does not match.
const OWN_READ_ONLY_PROP_RE = /\{\s*readOnly[^}]*\}\s*:\s*\{[^}]*readOnly\?:\s*boolean[^}]*\}/;

// Matches a local boolean toggle state used to gate a second, in-component
// summary/edit split -- the shape `const [showX, setShowX] = useState(...)`.
const EDIT_TOGGLE_STATE_RE = /const\s*\[\s*show\w*\s*,\s*set\w*\s*\]\s*=\s*useState(?:<[^>]*>)?\(\s*(?:true|false)\s*\)/;

function settingsTsxFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.tsx') && !name.includes('.test.'));
}

function readOnlyPropPanelFiles(dir: string): string[] {
  return settingsTsxFiles(dir).filter((name) => OWN_READ_ONLY_PROP_RE.test(readFileSync(join(dir, name), 'utf8')));
}

describe('DEC-785 amendment (wave 66): no nested edit-toggle drill behind a readOnly-prop panel', () => {
  it('derives the readOnly-prop population from source and finds exactly ApiTokensPanel + ResourcesPanel', () => {
    const files = readOnlyPropPanelFiles(HERE);
    expect(files.sort()).toEqual(['ApiTokensPanel.tsx', 'ResourcesPanel.tsx']);
  });

  it('no readOnly-prop panel also declares a local edit-toggle state', () => {
    const files = readOnlyPropPanelFiles(HERE);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((name) => EDIT_TOGGLE_STATE_RE.test(readFileSync(join(HERE, name), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('negative control: the detector flags a re-introduced showEditor toggle', () => {
    const fixture = `
      export function FakePanel({ readOnly = false }: { readOnly?: boolean }) {
        const [showEditor, setShowEditor] = useState(false);
        return null;
      }
    `;
    expect(EDIT_TOGGLE_STATE_RE.test(fixture)).toBe(true);
  });
});
