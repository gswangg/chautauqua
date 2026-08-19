// DEC-678 (wave-36 amendment): first-paint structure is proven by RENDER,
// not by a source-text grep. test/page-skeleton-coverage.scan.test.ts and
// app/src/page-loading-structure.scan.test.ts stay as cheap tripwires (they
// only prove the literal string `PageSkeleton` / a chq-page block is
// present in a module's source -- an import, not a paint). This file is the
// authority: it derives the SAME page-module list straight from App.tsx's
// own source (the derivation is copied verbatim from
// test/page-skeleton-coverage.scan.test.ts's derivePageLoaderFiles/
// deriveComponentToKey/deriveNavSectionReach/deriveRouteReach, plus one
// addition -- deriveComponentNames, which reads the `m.ComponentName`
// half of each pageLoaders `.then()` clause so this file can resolve the
// export to mount without hand-typing a list; not imported from that test
// file so importing this file never re-registers that file's `describe`
// blocks), dynamically imports each module, mounts its default page
// component with global fetch stubbed to a promise that never resolves,
// flushes one microtask, and inspects the real DOM.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_TSX_PATH = join(HERE, 'App.tsx');
const APP_SOURCE = readFileSync(APP_TSX_PATH, 'utf8');

interface PageModule {
  /** pageLoaders key, e.g. 'overview' */
  key: string;
  /** path relative to app/src/, e.g. 'pages/Overview.tsx' */
  file: string;
  /** the named export pageLoaders' `.then((m) => ({ default: m.X }))` binds to */
  componentName: string;
  /** human-readable nav/route entries that reach this module, for failure messages */
  reachedBy: string[];
}

// --- derivation, copied from test/page-skeleton-coverage.scan.test.ts -----

function derivePageLoaderFiles(): Map<string, string> {
  const byKey = new Map<string, string>();
  const re = /(\w+):\s*\(\)\s*=>[\s\S]*?import\(['"](\.\/pages\/[^'"]+)['"]\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(APP_SOURCE))) {
    const key = match[1]!;
    const specifier = match[2]!;
    const file = `pages/${specifier.slice('./pages/'.length)}.tsx`;
    byKey.set(key, file);
  }
  return byKey;
}

function deriveComponentToKey(): Map<string, string> {
  const byComponent = new Map<string, string>();
  const re = /const (\w+) = lazy\(pageLoaders\.(\w+)\);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(APP_SOURCE))) {
    byComponent.set(match[1]!, match[2]!);
  }
  return byComponent;
}

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

/** Not part of the original derivation: reads the `m.ComponentName` half of
 * every pageLoaders `.then((m) => ({ default: m.X }))` clause, keyed by
 * pageLoaders key, so this file can resolve which named export to mount
 * without hand-typing a component-name list. */
function deriveComponentNames(): Map<string, string> {
  const byKey = new Map<string, string>();
  const re =
    /(\w+):\s*\(\)\s*=>[\s\S]*?import\(['"]\.\/pages\/[^'"]+['"]\)\.then\(\(m\)\s*=>\s*\(\{\s*default:\s*m\.(\w+)\s*\}\)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(APP_SOURCE))) {
    byKey.set(match[1]!, match[2]!);
  }
  return byKey;
}

function derivePageModules(): PageModule[] {
  const fileByKey = derivePageLoaderFiles();
  const componentToKey = deriveComponentToKey();
  const navReach = deriveNavSectionReach();
  const routeReach = deriveRouteReach(componentToKey);
  const componentNameByKey = deriveComponentNames();

  const modules: PageModule[] = [];
  for (const [key, file] of fileByKey) {
    const reachedBy = [...(navReach.get(key) ?? []), ...(routeReach.get(key) ?? [])];
    if (reachedBy.length === 0) continue; // not reachable from any nav section or route -- not a live page module
    const componentName = componentNameByKey.get(key);
    if (!componentName) {
      throw new Error(`derivePageModules: no component name resolved for pageLoaders.${key} (file ${file})`);
    }
    modules.push({ key, file, componentName, reachedBy });
  }
  return modules;
}

const PAGE_MODULES = derivePageModules();

// ---------------------------------------------------------------------------

/** Modules whose mount needs infrastructure/context this harness has no
 * honest way to supply, OR whose first paint has, by inspected design, no
 * page-level load for a skeleton to stand in for -- so asserting `.chq-
 * skeleton` against them would fail for a reason unrelated to a missing
 * skeleton. Checked exact (both directions) against PAGE_MODULES below. */
const CANNOT_MOUNT: { file: string; reason: string }[] = [
  {
    file: 'pages/Settings.tsx',
    reason:
      "SettingsPage's own render has no page-level async gate: the section rail and every panel render " +
      'synchronously on mount (app/src/pages/Settings.tsx has no useEffect-driven fetch of its own), and each ' +
      'panel owns its own sub-region fetch behind DelayedLoading, not a page-level PageSkeleton -- there is no ' +
      'in-flight page-level load for this harness to observe a skeleton against.',
  },
  {
    file: 'pages/NotFound.tsx',
    reason:
      'NotFoundPage renders its full 404 card synchronously on mount; its useCurrentEvent/apiList(\'/events\') ' +
      "call only fills in the eyebrow's event name in the background (app/src/pages/NotFound.tsx's own " +
      'useEffect) and never gates the card body -- there is no in-flight page-level load for this harness to ' +
      'observe a skeleton against.',
  },
];

const CANNOT_MOUNT_FILES = new Set(CANNOT_MOUNT.map((e) => e.file));

interface MountConfig {
  /** initialEntries path (may carry a query string). */
  path: string;
  /** Route pattern to register, only needed when the module reads useParams(). */
  routePath?: string;
}

/** Per-module mount shape, mirroring the same MemoryRouter/Route wiring the
 * existing app/src/pages/**\/*.render.test.tsx files already use for each of
 * these pages (SubmissionDetailPage.render.test.tsx, SpeakerDetailPage.
 * render.test.tsx, MergePage.render.test.tsx, DeleteSubmissionsPage.render.
 * test.tsx, Overview.render.test.tsx, Speakers.render.test.tsx, ...). Every
 * PAGE_MODULES file not in CANNOT_MOUNT must have an entry here (checked
 * below), and every entry here must name a real derived module (also
 * checked below).
 */
const MOUNT_CONFIG: Record<string, MountConfig> = {
  'pages/Overview.tsx': { path: '/overview' },
  'pages/Submissions.tsx': { path: '/submissions' },
  'pages/forms/FormsPage.tsx': { path: '/submissions/forms' },
  'pages/Review.tsx': { path: '/review' },
  'pages/Speakers.tsx': { path: '/speakers' },
  'pages/Content.tsx': { path: '/content' },
  'pages/Agenda.tsx': { path: '/agenda' },
  'pages/Comms.tsx': { path: '/comms' },
  'pages/Contacts.tsx': { path: '/contacts' },
  'pages/contacts/MergePage.tsx': { path: '/contacts/merge?ids=ct-1,ct-2' },
  'pages/submissions/SubmissionDetailPage.tsx': { path: '/submissions/sub-1', routePath: '/submissions/:id' },
  'pages/speakers/SpeakerDetailPage.tsx': { path: '/speakers/ct-1', routePath: '/speakers/:contactId' },
  // Design pack v12: the task view -- one task across every speaker, opened
  // from a grid column head.
  'pages/speakers/TaskView.tsx': { path: '/speakers/tasks/task-1', routePath: '/speakers/tasks/:taskId' },
  'pages/submissions/DeleteSubmissionsPage.tsx': { path: '/submissions/delete?ids=sub-1' },
};

const EVENT_ID = 'evt-first-paint';

async function flushMicrotask(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** A fetch stub that never resolves or rejects -- every page-level request
 * this harness triggers stays perpetually in flight, so whatever the
 * component renders after one microtask flush IS its first-paint state. */
function stubFetchNeverResolves(): void {
  (globalThis as { fetch: typeof fetch }).fetch = (() => new Promise(() => {})) as typeof fetch;
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  stubFetchNeverResolves();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DEC-678 (wave 36): admin page modules render STRUCTURE on first paint, proven by render', () => {
  it('derives at least 14 page modules from App.tsx (vacuous-scan tripwire)', () => {
    expect(PAGE_MODULES.length).toBeGreaterThanOrEqual(14);
  });

  it('CANNOT_MOUNT has at most 6 entries, and every reason is a fact, never "needs work"', () => {
    expect(CANNOT_MOUNT.length).toBeLessThanOrEqual(6);
    for (const entry of CANNOT_MOUNT) {
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.reason.toLowerCase()).not.toContain('needs work');
    }
  });

  it('every CANNOT_MOUNT entry still names a module the derivation found (no stale entries)', () => {
    const derivedFiles = new Set(PAGE_MODULES.map((m) => m.file));
    for (const { file } of CANNOT_MOUNT) {
      expect(derivedFiles.has(file), `${file} is in CANNOT_MOUNT but the derivation no longer finds it`).toBe(true);
    }
  });

  it('MOUNT_CONFIG plus CANNOT_MOUNT covers every derived module exactly (no silent additions, none skipped)', () => {
    const derivedFiles = new Set(PAGE_MODULES.map((m) => m.file));
    const covered = new Set([...Object.keys(MOUNT_CONFIG), ...CANNOT_MOUNT_FILES]);
    expect(covered).toEqual(derivedFiles);
  });

  for (const mod of PAGE_MODULES) {
    if (CANNOT_MOUNT_FILES.has(mod.file)) continue;

    it(`${mod.file} renders skeleton STRUCTURE (not just a heading) on first paint, and no empty state while loading`, async () => {
      const config = MOUNT_CONFIG[mod.file];
      if (!config) throw new Error(`no MOUNT_CONFIG entry for ${mod.file} -- see coverage test above`);

      const specifier = `./${mod.file.slice(0, -'.tsx'.length)}`;
      const imported = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
      const Component = imported[mod.componentName] as React.ComponentType | undefined;
      if (!Component) {
        throw new Error(`${mod.file} has no export named ${mod.componentName} (reached by: ${mod.reachedBy.join(', ')})`);
      }

      const tree = config.routePath ? (
        <MemoryRouter initialEntries={[config.path]}>
          <Routes>
            <Route path={config.routePath} element={<Component />} />
          </Routes>
        </MemoryRouter>
      ) : (
        <MemoryRouter initialEntries={[config.path]}>
          <Component />
        </MemoryRouter>
      );

      render(tree);
      await flushMicrotask();

      const skeletonEls = document.querySelectorAll('[class*="chq-skeleton"]');
      expect(
        skeletonEls.length,
        `${mod.file} (reached by: ${mod.reachedBy.join(', ')}) rendered no chq-skeleton-classed element on ` +
          'first paint -- source containing the literal string `PageSkeleton` proves an import, not a paint.',
      ).toBeGreaterThan(0);

      const emptyStateEls = document.querySelectorAll('[class*="chq-empty"]');
      expect(
        emptyStateEls.length,
        `${mod.file} rendered an empty-state-classed element while its load was still in flight (DEC-678: an ` +
          'empty state is only reachable from a settled load).',
      ).toBe(0);
    });
  }
});
