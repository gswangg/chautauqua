// DEC-678 (wave-17 amendment, re-amended wave 20): "TYPED FILE LIST SCAN
// MEASURES FILES SOMEONE REMEMBERED" -- applied here to first-paint
// skeleton coverage itself, not just to page-loading-structure.scan.test.ts's
// own list. Gate-4 and SBEK run 4 both filed 'admin pages render
// blank/heading-only on first load' as a cross-area turn tax on every eval
// agent; PageSkeleton (app/src/components/PageSkeleton.tsx) is the house
// answer, and w15-b closed the last named instance
// (/review/plans/:id/results). But nothing kept the NEXT page honest --
// coverage was whichever pages a wave happened to touch. This scan derives
// the page-module list straight from app/src/App.tsx's own source (the lazy
// import specifiers behind NAV_SECTIONS' loaders, plus the component imports
// referenced by ELEMENT_BY_PATTERN and the catch-all Route) rather than a
// hand-typed list, and requires each resolved module's source text to
// literally contain `PageSkeleton` -- unless it is named in
// PAGE_SKELETON_ALLOWLIST with a reviewable reason. The allowlist is itself
// checked against the derivation, so an allowlist entry cannot outlive the
// module it excuses.
//
// wave-20 amendment: four of the six allowlist entries claimed to "delegate
// its entire body to X, which renders PageSkeleton" -- but nothing resolved
// X or checked it. The load-bearing half of every such reason was unchecked
// prose. The allowlist is now structured ({file, delegate?, reason}) and:
//   - every named `delegate` must resolve to a file that exists under
//     app/src/;
//   - every named delegate (and every no-delegate entry, on its own source)
//     must satisfy (a) its source contains `PageSkeleton`, or (b) it renders
//     at most one chq-page-classed block (a single-return page has nothing
//     for PageSkeleton to stand in for). The chq-page block extractor is
//     ported from page-loading-structure.scan.test.ts's depth-counted one,
//     widened to also recognize `className={...}` expression forms (not
//     just literal/template-literal quoting) -- a guard bound to one
//     className spelling measures nothing.
import { existsSync, readFileSync } from 'node:fs';
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

const ROOT_TAGS = ['div', 'main', 'section'];

/** True if an opening tag's attribute string carries a `className` whose
 * text includes the `chq-page` token. Handles literal double- or
 * single-quoted className, a template literal (interpolated `${...}`
 * segments stripped before the token check), and -- wave-20 -- a general
 * `className={expr}` form, where the whole expression text is scanned for
 * the `chq-page` token (rather than only the template-literal special
 * case) so an expression-form className is not silently invisible to this
 * scan. */
function hasChqPageClass(attrs: string): boolean {
  const m = attrs.match(/\bclassName=(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/);
  if (!m) return false;
  const literal = m[1] ?? m[2];
  if (literal !== undefined) {
    return literal.split(/\s+/).filter(Boolean).includes('chq-page');
  }
  const expr = m[3] ?? '';
  // Expression form: treat any block whose expression text contains the
  // `chq-page` token as a chq-page block. Token-bounded (not a bare
  // substring match) so `chq-page-title` inside the expression doesn't
  // falsely count.
  return /(^|[\s'"`])chq-page(?=$|[\s'"`])/.test(expr);
}

/** Depth-counted extraction of every top-level `<div|main|section
 * ...className carries chq-page...>...</same-tag>` block. Depth counting
 * (rather than a non-greedy regex) means a block containing its own nested
 * tags of the same name is captured in full, not truncated at the first
 * inner close tag; counting is keyed to the SPECIFIC root tag name so a
 * `<main>` root containing ordinary `<div>...</div>` children isn't closed
 * early by one of those divs. Ported from page-loading-structure.scan.test.ts. */
function extractChqPageBlocks(source: string): string[] {
  const blocks: string[] = [];
  const openRe = new RegExp(`<(${ROOT_TAGS.join('|')})\\b([^>]*)>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source))) {
    const tag = match[1]!;
    const attrs = match[2] ?? '';
    if (!hasChqPageClass(attrs)) continue;
    const start = match.index;
    let depth = 1;
    const tagRe = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
    tagRe.lastIndex = openRe.lastIndex;
    let tagMatch: RegExpExecArray | null;
    let end = source.length;
    while ((tagMatch = tagRe.exec(source))) {
      if (tagMatch[0].startsWith(`</${tag}>`)) {
        depth -= 1;
      } else {
        depth += 1;
      }
      if (depth === 0) {
        end = tagRe.lastIndex;
        break;
      }
    }
    blocks.push(source.slice(start, end));
    openRe.lastIndex = end;
  }
  return blocks;
}

/** True if a module's own source satisfies either branch that excuses it
 * from rendering PageSkeleton directly: (a) it references PageSkeleton
 * itself, or (b) it renders at most one chq-page-classed block (a
 * single-return page has nothing for PageSkeleton to stand in for). */
function satisfiesSkeletonOrSingleBlock(source: string): boolean {
  if (source.includes('PageSkeleton')) return true;
  return extractChqPageBlocks(source).length <= 1;
}

interface AllowlistEntry {
  /** path relative to app/src/, matched against the App.tsx-derived module list */
  file: string;
  /** path relative to app/src/ that this file hands its entire body to, if any */
  delegate?: string;
  reason: string;
}

/** A module here legitimately has no async first paint of its own (a pure
 * form/modal page, a static single-document page whose child panels each
 * own their own data fetch, or a shell that hands its ENTIRE body to
 * exactly one child page component). Every entry's `file` is checked below
 * to still name a module the derivation actually found, and every named
 * `delegate` is checked to both exist and actually satisfy the excuse it is
 * cited for -- so this list cannot outlive the module (or the delegate's
 * behavior) it excuses. */
const PAGE_SKELETON_ALLOWLIST: AllowlistEntry[] = [
  {
    file: 'pages/Submissions.tsx',
    delegate: 'pages/submissions/SubmissionsTable.tsx',
    reason: 'delegates its entire body to pages/submissions/SubmissionsTable.tsx, which renders PageSkeleton',
  },
  {
    file: 'pages/Speakers.tsx',
    delegate: 'pages/speakers/OnboardingGrid.tsx',
    reason: 'delegates its entire body to pages/speakers/OnboardingGrid.tsx, which renders PageSkeleton',
  },
  {
    file: 'pages/Content.tsx',
    delegate: 'pages/content/ContentApp.tsx',
    reason: 'delegates its entire body to pages/content/ContentApp.tsx, which renders PageSkeleton',
  },
  {
    file: 'pages/Contacts.tsx',
    delegate: 'pages/contacts/ContactsApp.tsx',
    reason:
      'delegates its entire body to pages/contacts/ContactsApp.tsx, which renders exactly one chq-page block ' +
      '(a single-return page, with nothing for PageSkeleton to stand in for)',
  },
  {
    file: 'pages/Settings.tsx',
    reason:
      'static single-document rail + panel column render immediately as exactly one chq-page block; each ' +
      'settings panel owns its own data fetch, not a page-level load gate',
  },
  {
    file: 'pages/NotFound.tsx',
    reason:
      'static 404 card renders in full on first paint (zero chq-page blocks -- no page-level load gate at ' +
      'all); the event-name eyebrow fills in async but is not a load the page gates on',
  },
];

describe('DEC-678 (wave 17, re-amended wave 20): first-paint skeleton coverage is enumerated, not remembered', () => {
  it('derives at least 14 page modules from App.tsx (vacuous-scan tripwire)', () => {
    expect(PAGE_MODULES.length).toBeGreaterThanOrEqual(14);
  });

  it('PAGE_SKELETON_ALLOWLIST is non-empty and every entry has a non-empty reason', () => {
    expect(PAGE_SKELETON_ALLOWLIST.length).toBeGreaterThan(0);
    for (const entry of PAGE_SKELETON_ALLOWLIST) {
      expect(entry.reason.length, `${entry.file} has an empty reason`).toBeGreaterThan(0);
    }
  });

  it('every PAGE_SKELETON_ALLOWLIST entry still names a module the derivation found', () => {
    const derivedFiles = new Set(PAGE_MODULES.map((m) => m.file));
    for (const { file } of PAGE_SKELETON_ALLOWLIST) {
      expect(derivedFiles.has(file), `${file} is allowlisted but the derivation no longer finds it as a live page module`).toBe(
        true,
      );
    }
  });

  for (const entry of PAGE_SKELETON_ALLOWLIST) {
    it(`${entry.file}: allowlist reason's delegate (if any) resolves to a real file`, () => {
      if (!entry.delegate) return;
      const delegatePath = join(APP_SRC, entry.delegate);
      expect(existsSync(delegatePath), `${entry.file}'s allowlist reason names delegate '${entry.delegate}', but no such file exists under app/src/`).toBe(
        true,
      );
    });

    it(`${entry.file}: the delegate named in its allowlist reason actually renders PageSkeleton or at most one chq-page block`, () => {
      const targetFile = entry.delegate ?? entry.file;
      const source = readFileSync(join(APP_SRC, targetFile), 'utf8');
      const ok = satisfiesSkeletonOrSingleBlock(source);
      const blockCount = extractChqPageBlocks(source).length;
      expect(
        ok,
        `${entry.file}'s allowlist reason relies on ${targetFile}, but it neither references PageSkeleton nor ` +
          `renders at most one chq-page block (found ${blockCount}). Either render PageSkeleton in ${targetFile}'s ` +
          'first-paint branch, or fix the allowlist reason.',
      ).toBe(true);
    });
  }

  const allowlistByFile = new Map(PAGE_SKELETON_ALLOWLIST.map((entry) => [entry.file, entry]));

  for (const mod of PAGE_MODULES) {
    const allowEntry = allowlistByFile.get(mod.file);
    const label = allowEntry ? `${mod.file} (allowlisted)` : mod.file;

    it(`${label} renders PageSkeleton on first paint, or is allowlisted with a reason`, () => {
      if (allowEntry) {
        expect(allowEntry.reason.length).toBeGreaterThan(0);
        return;
      }
      const source = readFileSync(join(APP_SRC, mod.file), 'utf8');
      expect(
        source.includes('PageSkeleton'),
        `${mod.file} has no PageSkeleton reference, but is reached by: ${mod.reachedBy.join(', ')}. ` +
          `Either render PageSkeleton for its first-paint load, or add { file: '${mod.file}', reason: '<reason>' } to PAGE_SKELETON_ALLOWLIST above.`,
      ).toBe(true);
    });
  }
});
