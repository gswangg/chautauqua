// DEC-678 (wave-17 amendment): "TYPED FILE LIST SCAN MEASURES FILES SOMEONE
// REMEMBERED" -- applied here to first-paint skeleton coverage itself, not
// just to page-loading-structure.scan.test.ts's own list. Gate-4 and SBEK
// run 4 both filed 'admin pages render blank/heading-only on first load' as
// a cross-area turn tax on every eval agent; PageSkeleton
// (app/src/components/PageSkeleton.tsx) is the house answer, and w15-b
// closed the last named instance (/review/plans/:id/results). But nothing
// kept the NEXT page honest -- coverage was whichever pages a wave happened
// to touch. This scan derives the page-module list straight from
// app/src/App.tsx's own source (the lazy import specifiers behind
// NAV_SECTIONS' loaders, plus the component imports referenced by
// ELEMENT_BY_PATTERN and the catch-all Route) rather than a hand-typed
// list, and requires each resolved module's source text to literally
// contain `PageSkeleton` -- unless it is named in PAGE_SKELETON_ALLOWLIST
// with a reviewable reason. The allowlist is itself checked against the
// derivation, so an allowlist entry cannot outlive the module it excuses.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..', 'app', 'src');
const APP_TSX_PATH = join(APP_SRC, 'App.tsx');
const APP_SOURCE = readFileSync(APP_TSX_PATH, 'utf8');

interface PageModule {
  /** pageLoaders key, e.g. 'overview' */
  key: string;
  /** path relative to app/src/, e.g. 'pages/Overview.tsx' */
  file: string;
  /** human-readable nav/route entries that reach this module, for failure messages */
  reachedBy: string[];
}

/** Parses every `key: () => import('./pages/...').then(...)` entry out of
 * App.tsx's `pageLoaders` object -- the single place every admin route's
 * code-split chunk is declared -- and resolves each specifier to a real
 * file under app/src/pages/**. */
function derivePageLoaderFiles(): Map<string, string> {
  const byKey = new Map<string, string>();
  const re = /(\w+):\s*\(\)\s*=>[\s\S]*?import\(['"](\.\/pages\/[^'"]+)['"]\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(APP_SOURCE))) {
    const key = match[1]!;
    const specifier = match[2]!; // e.g. './pages/Overview'
    const file = `pages/${specifier.slice('./pages/'.length)}.tsx`;
    byKey.set(key, file);
  }
  return byKey;
}

/** Parses every `const Comp = lazy(pageLoaders.key);` assignment, giving the
 * lazy-component variable name each pageLoaders key is bound to -- needed to
 * resolve the JSX element types referenced by NAV_SECTIONS/ELEMENT_BY_PATTERN
 * back to a pageLoaders key. */
function deriveComponentToKey(): Map<string, string> {
  const byComponent = new Map<string, string>();
  const re = /const (\w+) = lazy\(pageLoaders\.(\w+)\);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(APP_SOURCE))) {
    byComponent.set(match[1]!, match[2]!);
  }
  return byComponent;
}

/** Reach entries from NAV_SECTIONS: `{ label: 'X', path: 'Y', ...,
 * loader: pageLoaders.key },` -- one array entry per line. */
function deriveNavSectionReach(): Map<string, string[]> {
  const reach = new Map<string, string[]>();
  const re = /\{\s*label:\s*'([^']+)',\s*path:\s*'([^']+)',[\s\S]*?loader:\s*pageLoaders\.(\w+)\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(APP_SOURCE))) {
    const [, label, path, key] = match;
    const list = reach.get(key!) ?? [];
    list.push(`NAV_SECTIONS entry "${label}" (${path})`);
    reach.set(key!, list);
  }
  return reach;
}

/** Reach entries from ELEMENT_BY_PATTERN (the route table): `'pattern':
 * <Comp />,` -- resolved to a pageLoaders key via componentToKey. Also
 * covers the admin catch-all `<Route path="*" element={<Comp />} />`. */
function deriveRouteReach(componentToKey: Map<string, string>): Map<string, string[]> {
  const reach = new Map<string, string[]>();
  const addReach = (key: string | undefined, entry: string) => {
    if (!key) return;
    const list = reach.get(key) ?? [];
    list.push(entry);
    reach.set(key, list);
  };

  const patternRe = /'([^']+)':\s*<(\w+)\s*\/>,/g;
  let match: RegExpExecArray | null;
  while ((match = patternRe.exec(APP_SOURCE))) {
    const [, pattern, component] = match;
    addReach(componentToKey.get(component!), `ELEMENT_BY_PATTERN route "${pattern}"`);
  }

  const catchAllRe = /<Route path="\*" element=\{<(\w+)\s*\/>\}/;
  const catchAllMatch = catchAllRe.exec(APP_SOURCE);
  if (catchAllMatch) {
    addReach(componentToKey.get(catchAllMatch[1]!), 'catch-all Route path="*"');
  }

  return reach;
}

function derivePageModules(): PageModule[] {
  const fileByKey = derivePageLoaderFiles();
  const componentToKey = deriveComponentToKey();
  const navReach = deriveNavSectionReach();
  const routeReach = deriveRouteReach(componentToKey);

  const modules: PageModule[] = [];
  for (const [key, file] of fileByKey) {
    const reachedBy = [...(navReach.get(key) ?? []), ...(routeReach.get(key) ?? [])];
    if (reachedBy.length === 0) continue; // not reachable from any nav section or route -- not a live page module
    modules.push({ key, file, reachedBy });
  }
  return modules;
}

const PAGE_MODULES = derivePageModules();

/** [modulePath (relative to app/src/), reason] -- a module here legitimately
 * has no async first paint of its own (a pure form/modal page, a static
 * single-document page whose child panels each own their own data fetch, or
 * a shell that hands its ENTIRE body to exactly one child page component
 * which itself renders PageSkeleton). Every entry is checked below to still
 * name a module the derivation actually found, so this list cannot outlive
 * the module it excuses. */
const PAGE_SKELETON_ALLOWLIST: Array<[string, string]> = [
  ['pages/Submissions.tsx', 'delegates its entire body to pages/submissions/SubmissionsTable.tsx, which renders PageSkeleton'],
  ['pages/Speakers.tsx', 'delegates its entire body to pages/speakers/OnboardingGrid.tsx, which renders PageSkeleton'],
  ['pages/Content.tsx', 'delegates its entire body to pages/content/ContentApp.tsx, which renders PageSkeleton'],
  ['pages/Contacts.tsx', 'delegates its entire body to pages/contacts/ContactsApp.tsx'],
  ['pages/Settings.tsx', 'static single-document rail + panel column render immediately; each settings panel owns its own data fetch, not a page-level load gate'],
  ['pages/NotFound.tsx', 'static 404 card renders in full on first paint; the event-name eyebrow fills in async but is not a load the page gates on'],
];

describe('DEC-678 (wave 17): first-paint skeleton coverage is enumerated, not remembered', () => {
  it('derives at least 14 page modules from App.tsx (vacuous-scan tripwire)', () => {
    expect(PAGE_MODULES.length).toBeGreaterThanOrEqual(14);
  });

  it('every PAGE_SKELETON_ALLOWLIST entry still names a module the derivation found', () => {
    const derivedFiles = new Set(PAGE_MODULES.map((m) => m.file));
    for (const [file] of PAGE_SKELETON_ALLOWLIST) {
      expect(derivedFiles.has(file), `${file} is allowlisted but the derivation no longer finds it as a live page module`).toBe(
        true,
      );
    }
  });

  const allowlistByFile = new Map(PAGE_SKELETON_ALLOWLIST);

  for (const mod of PAGE_MODULES) {
    const allowReason = allowlistByFile.get(mod.file);
    const label = allowReason ? `${mod.file} (allowlisted)` : mod.file;

    it(`${label} renders PageSkeleton on first paint, or is allowlisted with a reason`, () => {
      if (allowReason) {
        expect(allowReason.length).toBeGreaterThan(0);
        return;
      }
      const source = readFileSync(join(APP_SRC, mod.file), 'utf8');
      expect(
        source.includes('PageSkeleton'),
        `${mod.file} has no PageSkeleton reference, but is reached by: ${mod.reachedBy.join(', ')}. ` +
          `Either render PageSkeleton for its first-paint load, or add ['${mod.file}', '<reason>'] to PAGE_SKELETON_ALLOWLIST above.`,
      ).toBe(true);
    });
  }
});
