// DEC-678 (wave-8 amendment, re-amended wave 15, re-amended wave 19): a
// page's MAIN region ("chq-page"-classed container, or the RoleGate/
// Suspense wrappers that gate EVERY route) must render PageSkeleton on its
// first loading frame, not DelayedLoading's 250ms-withheld label --
// structure, not a delayed word, is what a first paint needs. DelayedLoading
// remains correct for a SUB-region wait inside an already-structured page
// (an embedded/inline branch, a history panel, a queue's in-flight
// score-count) where surrounding chrome already gives the page its shape
// and only a nested fragment is still loading.
//
// wave-15 amendment: the file list this scan walks is no longer hand-
// written (a hand list only agrees with the route table until the next page
// is added and nobody remembers to append it -- exactly the P1 this wave
// closes). It is DERIVED from App.tsx's `pageLoaders` object -- the single
// place every admin route's code-split chunk is declared -- by parsing each
// `import('./pages/...')` specifier. A page whose entire body is handed to a
// nested component (Speakers -> OnboardingGrid, Contacts -> ContactsApp,
// Content -> ContentApp, Submissions -> SubmissionsTable) is scanned through
// that delegate instead of itself, via DELEGATES below, since the thin
// wrapper page never renders a loading branch of its own.
//
// wave-19 amendment: two gaps the wave-15 scan left open, both found by
// re-reading it rather than trusting its green run --
//   (a) extractChqPageBlocks only matched a single-line, double-quoted,
//       attribute-only `<div className="...">` -- a chq-page div with other
//       attributes before/after className (Scorecard.tsx's multi-line
//       `<div className="..." style={...} onKeyDown={...}>`), a single- or
//       template-quoted className, or a `<main>`/`<section>` root, all
//       measured as ZERO blocks -- a page whose ENTIRE chq-page structure is
//       spelled one of those ways passed both the PageSkeleton-import and
//       DelayedLoading-only-child checks vacuously, having scanned nothing.
//       Fixed by matching the className ATTRIBUTE (any position among other
//       attributes, any quote style, and a template literal whose static
//       text carries the chq-page token) on a div/main/section root.
//   (b) PAGE_FILES only ever held pageLoaders' code-split entries (or their
//       DELEGATES substitute) -- a page that renders a `<Routes>` switch of
//       its OWN nested route components (Review.tsx -> PlanList/PlanEditor/
//       ProgressPanel/ResultsTable/ReviewerQueue/Scorecard) left every one
//       of those unscanned, so ALLOWED_SUBREGION_HINTS keys for three of
//       them (review/ResultsTable.tsx, review/ProgressPanel.tsx,
//       review/ReviewerQueue.tsx) were dead config nobody's scan ever
//       checked, and the other three (PlanEditor/PlanList/Scorecard) hid a
//       real DEC-678 violation apiece -- PlanList.tsx and Scorecard.tsx's
//       main-region loading branches called DelayedLoading, not
//       PageSkeleton (fixed in those files; PageSkeleton import + variant
//       now match the page's shape). Fixed by resolving every
//       `<Route element={<Component .../>} />` found inside a page whose
//       source contains `<Routes>` back through that page's own relative
//       imports (one level -- a delegate's own further imports are not
//       walked) and folding the result into PAGE_FILES.
// Both gaps are also now load-bearing assertions here: a scanned file with
// zero chq-page blocks that still gates a loading state some other way
// fails by name (vacuity), and every ALLOWED_SUBREGION_HINTS key must name
// a file PAGE_FILES actually contains (dead config).
import { readFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

function read(relFile: string): string {
  return readFileSync(posix.join(APP_SRC, relFile), 'utf8');
}

/** A page that delegates its entire body to a nested component is scanned
 * through that delegate instead of itself -- the wrapper file (keyed here,
 * relative to app/src/) never renders a loading branch of its own. */
const DELEGATES: Record<string, string> = {
  'pages/Speakers.tsx': 'pages/speakers/OnboardingGrid.tsx',
  'pages/Contacts.tsx': 'pages/contacts/ContactsApp.tsx',
  'pages/Content.tsx': 'pages/content/ContentApp.tsx',
  'pages/Submissions.tsx': 'pages/submissions/SubmissionsTable.tsx',
};

/** Parses every `import('./pages/...')` specifier out of App.tsx's
 * `pageLoaders` object (the one place every admin route's code-split chunk
 * is declared) and resolves it to a path relative to app/src/, applying
 * DELEGATES so a whole-body delegate is scanned instead of its thin
 * wrapper. Asserted (below) to find >= 15 entries -- a vacuous-scan
 * tripwire, so a future refactor that renames `pageLoaders` or changes its
 * import shape fails loudly instead of silently scanning zero files. */
function derivePageFiles(): string[] {
  const appSource = read('App.tsx');
  const importRe = /import\(['"](\.\/pages\/[^'"]+)['"]\)/g;
  const relPaths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(appSource))) {
    const specifier = match[1]!; // e.g. './pages/Overview'
    const relPath = `${specifier.slice(2)}.tsx`; // 'pages/Overview.tsx'
    relPaths.push(relPath);
  }
  return relPaths;
}

const PARSED_PAGE_LOADER_FILES = derivePageFiles();

/** wave-19: a page whose body is a `<Routes>` switch (Review.tsx, choosing
 * between the producer and reviewer subtrees) delegates its loading
 * structure to whichever route component actually mounts -- each is found
 * by resolving `<Route ... element={<Component .../>} />` through the
 * page's own relative imports. Deliberately one level only: a resolved
 * delegate's OWN imports are not walked, matching DELEGATES' shallow reach
 * above and keeping this from sweeping in every modal/helper a page
 * happens to import.
 */
function deriveRouteDelegates(relFile: string): string[] {
  const source = read(relFile);
  if (!/<Routes>/.test(source)) return [];
  const importMap = new Map<string, string>();
  const importRe = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(source))) {
    const names = im[1]!
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/)[0]!.trim())
      .filter(Boolean);
    for (const name of names) importMap.set(name, im[2]!);
  }
  const routeRe = /<Route\b[^>]*\belement=\{<(\w+)/g;
  const out = new Set<string>();
  let rm: RegExpExecArray | null;
  while ((rm = routeRe.exec(source))) {
    const specifier = importMap.get(rm[1]!);
    if (!specifier) continue;
    const resolved = `${posix.join(posix.dirname(relFile), specifier)}.tsx`;
    if (resolved.startsWith('pages/')) out.add(resolved);
  }
  return Array.from(out);
}

const BASE_PAGE_FILES = Array.from(new Set(PARSED_PAGE_LOADER_FILES.map((f) => DELEGATES[f] ?? f)));
const ROUTE_DELEGATE_FILES = BASE_PAGE_FILES.flatMap(deriveRouteDelegates);

const PAGE_FILES: string[] = ['App.tsx', ...Array.from(new Set([...BASE_PAGE_FILES, ...ROUTE_DELEGATE_FILES]))];

// Every DelayedLoading call site deliberately left in place by the wave-8/
// wave-15/wave-19 PageSkeleton migrations, named so a future sweep can diff
// against this list instead of re-litigating each one. All are sub-region
// waits inside a page whose surrounding chrome (or an `embedded` branch that
// renders no chrome of its own) already gives the page its shape.
const ALLOWED_SUBREGION_HINTS: Record<string, string[]> = {
  'pages/review/ResultsTable.tsx': ['if (embedded) return <DelayedLoading />'],
  'pages/review/ProgressPanel.tsx': ['if (embedded) return <DelayedLoading />'],
  'pages/review/ReviewerQueue.tsx': [
    '<section className="chq-section">',
    '{!routeEnvelope ? (',
    '{scoreLeft === null ? (',
  ],
  // wave-19: the plan list's own loading branch now renders PageSkeleton
  // (fixed below in the same wave); this remaining call sits inside the
  // "Evaluation plans" section, below the title row/summary chrome the page
  // has already painted by the time this section's own fetch resolves.
  'pages/review/PlanList.tsx': ['{loading && <DelayedLoading />}'],
  'pages/submissions/SubmissionDetailPage.tsx': ['Loading history…'],
  'pages/speakers/SpeakerDetailPage.tsx': ['Loading speaker…'],
  'pages/contacts/MergePage.tsx': ['{!previewError && !preview && <DelayedLoading />}'],
  'pages/content/ContentApp.tsx': ['<DelayedLoading label="Loading submission…" />'],
};

const ROOT_TAGS = ['div', 'main', 'section'];

/** True if an opening tag's attribute string carries a `className` whose
 * (static) text includes the `chq-page` token -- literal double- or
 * single-quoted, or a template literal (`className={\`...\`}`) whose
 * interpolated `${...}` segments are stripped before the token check, so
 * `` `chq-page chq-comms-page ${pageMeasureClass}` `` still counts. Other
 * attributes before or after className are tolerated (the whole tag's
 * attribute text is searched, not anchored to className being first). */
function hasChqPageClass(attrs: string): boolean {
  const m = attrs.match(/\bclassName=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/);
  if (!m) return false;
  let text = m[1] ?? m[2] ?? m[3] ?? '';
  if (m[3] !== undefined) {
    text = text.replace(/\$\{[^}]*\}/g, ' ');
  }
  return text.split(/\s+/).filter(Boolean).includes('chq-page');
}

/** Depth-counted extraction of every top-level `<div|main|section
 * ...className carries chq-page...>...</same-tag>` block. Depth counting
 * (rather than a non-greedy regex) means a block containing its own nested
 * tags of the same name is captured in full, not truncated at the first
 * inner close tag; counting is keyed to the SPECIFIC root tag name so a
 * `<main>` root containing ordinary `<div>...</div>` children isn't closed
 * early by one of those divs. */
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

/** True if, once the outer root tag, any `<h1>...</h1>` title, and comments
 * are stripped, the only remaining JSX content is a single self-closing
 * `<DelayedLoading .../>` (or `<DelayedLoading />`) -- i.e. DelayedLoading
 * is the block's ONLY content child. */
function isDelayedLoadingOnlyChild(block: string): boolean {
  const rootTagRe = new RegExp(`^<(?:${ROOT_TAGS.join('|')})\\b[^>]*>`);
  const closeTagRe = new RegExp(`<\\/(?:${ROOT_TAGS.join('|')})>\\s*$`);
  let inner = block
    .replace(rootTagRe, '')
    .replace(closeTagRe, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/g, '')
    .trim();
  return /^<DelayedLoading(\s[^>]*)?\/>$/.test(inner);
}

/** A file only needs to IMPORT PageSkeleton if it actually gates its main
 * region behind more than one distinct chq-page-classed return (i.e. some
 * branch renders less than the full page while another renders it) -- a
 * single-return page (e.g. ContactsApp.tsx, Settings.tsx) shows its full
 * structure on every render and has nothing for PageSkeleton to stand in
 * for; forcing an unused import there would be exactly the kind of dummy
 * fix DEC-678 argues against. App.tsx is the one file that gates via a
 * React.Suspense `fallback=` (its route table has no chq-page div of its
 * own), so it is special-cased in.
 */
const SUSPENSE_FALLBACK_RE = /<Suspense[^>]*\bfallback=/;

function needsPageSkeletonImport(source: string): boolean {
  return extractChqPageBlocks(source).length > 1 || SUSPENSE_FALLBACK_RE.test(source);
}

/** wave-19: a scanned page whose chq-page-block count is zero is either
 * (a) a page whose ENTIRE structure the scan failed to see -- exactly the
 * failure mode gap (a) above describes -- or (b) a page with no loading
 * frame to begin with (nothing async gates its first render), which is
 * outside what DEC-678 is about. The two are told apart by whether the
 * file shows ANY sign of gating a render on a loading state at all
 * (a `DelayedLoading` call, or an `if (...loading...)`/`{...loading... &&`
 * conditional) -- only then does zero-blocks-and-no-Suspense-fallback name
 * a real vacuous scan.
 */
const LOADING_GATE_RE = /<DelayedLoading\b|\bif\s*\(\s*[\w.]*[Ll]oading[\w]*\s*\)|\{\s*[\w.]*[Ll]oading[\w]*\s*&&/;

describe('DEC-678: page main regions render PageSkeleton, not a delayed label', () => {
  it('parses at least 15 pageLoaders entries from App.tsx (vacuous-scan tripwire)', () => {
    expect(PARSED_PAGE_LOADER_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('resolves at least one <Routes>-nested delegate (Review.tsx) so the review/* hints below are not dead config', () => {
    expect(ROUTE_DELEGATE_FILES.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of PAGE_FILES) {
    describe(file, () => {
      const source = read(file);
      const blocks = extractChqPageBlocks(source);

      it('has a chq-page block, or a Suspense fallback, whenever it gates a render on a loading state (vacuous-scan tripwire)', () => {
        if (blocks.length > 0) return;
        if (!LOADING_GATE_RE.test(source)) return; // no loading frame to structure at all
        expect(SUSPENSE_FALLBACK_RE.test(source), `${file}: gates a loading state but the scan found zero chq-page blocks and no Suspense fallback`).toBe(true);
      });

      if (needsPageSkeletonImport(source)) {
        it('imports PageSkeleton', () => {
          expect(source).toMatch(/from ['"][^'"]*components\/PageSkeleton['"]/);
        });
      }

      it('no chq-page-classed block has DelayedLoading as its only content child', () => {
        const offenders = blocks.filter(isDelayedLoadingOnlyChild);
        expect(offenders).toEqual([]);
      });
    });
  }

  it('every remaining DelayedLoading call site is named in ALLOWED_SUBREGION_HINTS', () => {
    for (const file of PAGE_FILES) {
      const source = read(file);
      if (!source.includes('<DelayedLoading')) continue;
      const hints = ALLOWED_SUBREGION_HINTS[file] ?? [];
      expect(hints.length, `${file} still calls DelayedLoading but has no allow-list entry`).toBeGreaterThan(0);
      for (const hint of hints) {
        expect(source, `${file}: expected hint ${JSON.stringify(hint)} not found`).toContain(hint);
      }
    }
  });

  it('every ALLOWED_SUBREGION_HINTS key names a file the scan actually visits (dead-config tripwire)', () => {
    for (const key of Object.keys(ALLOWED_SUBREGION_HINTS)) {
      expect(PAGE_FILES, `${key} is not among the files this scan visits`).toContain(key);
    }
  });
});
