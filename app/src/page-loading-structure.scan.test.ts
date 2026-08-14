// DEC-678 (wave-8 amendment, re-amended wave 15): a page's MAIN region
// ("chq-page"-classed container, or the RoleGate/Suspense wrappers that gate
// EVERY route) must render PageSkeleton on its first loading frame, not
// DelayedLoading's 250ms-withheld label -- structure, not a delayed word, is
// what a first paint needs. DelayedLoading remains correct for a SUB-region
// wait inside an already-structured page (an embedded/inline branch, a
// history panel, a queue's in-flight score-count) where surrounding chrome
// already gives the page its shape and only a nested fragment is still
// loading.
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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

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
  const appSource = readFileSync(join(APP_SRC, 'App.tsx'), 'utf8');
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

const PAGE_FILES: string[] = [
  'App.tsx',
  ...Array.from(new Set(PARSED_PAGE_LOADER_FILES.map((f) => DELEGATES[f] ?? f))),
];

// Every DelayedLoading call site deliberately left in place by the wave-8/
// wave-15 PageSkeleton migrations, named so a future sweep can diff against
// this list instead of re-litigating each one. All are sub-region waits
// inside a page whose surrounding chrome (or an `embedded` branch that
// renders no chrome of its own) already gives the page its shape.
const ALLOWED_SUBREGION_HINTS: Record<string, string[]> = {
  'pages/review/ResultsTable.tsx': ['if (embedded) return <DelayedLoading />'],
  'pages/review/ProgressPanel.tsx': ['if (embedded) return <DelayedLoading />'],
  'pages/review/ReviewerQueue.tsx': [
    '<section className="chq-section">',
    '{!routeEnvelope ? (',
    '{scoreLeft === null ? (',
  ],
  'pages/submissions/SubmissionDetailPage.tsx': ['Loading history…'],
  'pages/speakers/SpeakerDetailPage.tsx': ['Loading speaker…'],
  'pages/contacts/MergePage.tsx': ['{!previewError && !preview && <DelayedLoading />}'],
  'pages/content/ContentApp.tsx': ['<DelayedLoading label="Loading submission…" />'],
};

/** Depth-counted extraction of every top-level `<div className="...">...</div>`
 * block whose class attribute contains the token `chq-page`. Depth counting
 * (rather than a non-greedy regex) means a block containing its own nested
 * divs is captured in full, not truncated at the first inner `</div>`. */
function extractChqPageBlocks(source: string): string[] {
  const blocks: string[] = [];
  const openRe = /<div className="([^"]*)">/g;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source))) {
    const classAttr = match[1];
    if (!classAttr) continue;
    const classes = classAttr.split(/\s+/);
    if (!classes.includes('chq-page')) continue;
    const start = match.index;
    let depth = 1;
    let cursor = openRe.lastIndex;
    const tagRe = /<div[\s>]|<\/div>/g;
    tagRe.lastIndex = cursor;
    let tagMatch: RegExpExecArray | null;
    let end = source.length;
    while ((tagMatch = tagRe.exec(source))) {
      if (tagMatch[0].startsWith('</div>')) {
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

/** True if, once the outer div tag, any `<h1>...</h1>` title, and comments
 * are stripped, the only remaining JSX content is a single self-closing
 * `<DelayedLoading .../>` (or `<DelayedLoading />`) -- i.e. DelayedLoading
 * is the block's ONLY content child. */
function isDelayedLoadingOnlyChild(block: string): boolean {
  let inner = block
    .replace(/^<div className="[^"]*">/, '')
    .replace(/<\/div>\s*$/, '')
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
function needsPageSkeletonImport(source: string): boolean {
  return extractChqPageBlocks(source).length > 1 || /<Suspense[^>]*\bfallback=/.test(source);
}

describe('DEC-678: page main regions render PageSkeleton, not a delayed label', () => {
  it('parses at least 15 pageLoaders entries from App.tsx (vacuous-scan tripwire)', () => {
    expect(PARSED_PAGE_LOADER_FILES.length).toBeGreaterThanOrEqual(15);
  });

  for (const file of PAGE_FILES) {
    describe(file, () => {
      const source = readFileSync(join(APP_SRC, file), 'utf8');

      if (needsPageSkeletonImport(source)) {
        it('imports PageSkeleton', () => {
          expect(source).toMatch(/from ['"][^'"]*components\/PageSkeleton['"]/);
        });
      }

      it('no chq-page-classed block has DelayedLoading as its only content child', () => {
        const offenders = extractChqPageBlocks(source).filter(isDelayedLoadingOnlyChild);
        expect(offenders).toEqual([]);
      });
    });
  }

  it('every remaining DelayedLoading call site is named in ALLOWED_SUBREGION_HINTS', () => {
    for (const file of PAGE_FILES) {
      const source = readFileSync(join(APP_SRC, file), 'utf8');
      if (!source.includes('<DelayedLoading')) continue;
      const hints = ALLOWED_SUBREGION_HINTS[file] ?? [];
      expect(hints.length, `${file} still calls DelayedLoading but has no allow-list entry`).toBeGreaterThan(0);
      for (const hint of hints) {
        expect(source, `${file}: expected hint ${JSON.stringify(hint)} not found`).toContain(hint);
      }
    }
  });
});
