// DEC-678 (wave-8 amendment): a page's MAIN region ("chq-page"-classed
// container, or the RoleGate/Suspense wrappers that gate EVERY route) must
// render PageSkeleton on its first loading frame, not DelayedLoading's
// 250ms-withheld label -- structure, not a delayed word, is what a first
// paint needs. DelayedLoading remains correct for a SUB-region wait inside
// an already-structured page (an embedded/inline branch, a history panel,
// a queue's in-flight score-count) where surrounding chrome already gives
// the page its shape and only a nested fragment is still loading.
//
// This scan enforces two things per file in PAGE_FILES:
//   (a) it imports PageSkeleton (the main-region wait exists and uses it);
//   (b) no `<div className="...chq-page...">...</div>` block -- found by
//       depth-counted div matching, so nested divs don't truncate the scan
//       early -- has `<DelayedLoading` as its ONLY non-title content child.
// A DelayedLoading found OUTSIDE any chq-page-classed block (an embedded
// early return, a nested sub-panel deep inside an already-rendered page) is
// a legitimate sub-region wait and is not flagged; ALLOWED_SUBREGION_HINTS
// below names every such site that this file's edits deliberately left on
// DelayedLoading, so the allow-list can't silently grow underneath a future
// find-and-replace.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

const PAGE_FILES = [
  'App.tsx',
  'pages/review/ResultsTable.tsx',
  'pages/review/PlanEditor.tsx',
  'pages/review/ProgressPanel.tsx',
  'pages/review/ReviewerQueue.tsx',
  'pages/Comms.tsx',
  'pages/Agenda.tsx',
  'pages/submissions/SubmissionDetailPage.tsx',
  'pages/submissions/DeleteSubmissionsPage.tsx',
];

// Every DelayedLoading call site deliberately left in place by the wave-8
// PageSkeleton migration, named so a future sweep can diff against this
// list instead of re-litigating each one. All are sub-region waits inside a
// page whose surrounding chrome (or an `embedded` branch that renders no
// chrome of its own) already gives the page its shape.
const ALLOWED_SUBREGION_HINTS: Record<string, string[]> = {
  'pages/review/ResultsTable.tsx': ['if (embedded) return <DelayedLoading />'],
  'pages/review/ProgressPanel.tsx': ['if (embedded) return <DelayedLoading />'],
  'pages/review/ReviewerQueue.tsx': [
    '<section className="chq-section">',
    '{!routeEnvelope ? (',
    '{scoreLeft === null ? (',
  ],
  'pages/submissions/SubmissionDetailPage.tsx': ['Loading history…'],
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

describe('DEC-678 (wave 8): page main regions render PageSkeleton, not a delayed label', () => {
  for (const file of PAGE_FILES) {
    describe(file, () => {
      const source = readFileSync(join(APP_SRC, file), 'utf8');

      it('imports PageSkeleton', () => {
        expect(source).toMatch(/from ['"][^'"]*components\/PageSkeleton['"]/);
      });

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
