// DEC-678 amendment (w52-d): a zero-row COLLECTION under a section label
// renders through the shared EmptyState component (app/src/components/
// EmptyState.tsx), never the bare, escape-less `.chq-empty` line B7 retired
// for that purpose. Six former offenders (ReviewerQueue's queue and plan
// list, PlanEditor's roster, ProgressPanel's roster, RecentSends, and
// CommentThread) were converted on this branch. This scan locks that in by
// enumerating EVERY non-test .tsx file under app/src (never a hand-list) and
// asserting the surviving `chq-empty` (exact token) sites are EXACTLY the
// four documented prose lines that are not collections -- a plan-not-open
// notice, a cross-role routing notice, a "nothing selected yet" instruction,
// and the route error boundary's action row.
//
// The check is by file:count pair, not "does the file contain the string",
// so a future PR that removes one of the four sites must also shrink this
// ALLOWLIST -- and a future PR that reintroduces a `chq-empty` line anywhere
// else in the tree (in or out of app/src/pages) fails loudly here instead of
// slipping past the older, pages-only, <td>-scoped b7-empty-table.scan.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = HERE;

/** Every *.tsx file under app/src, excluding test files, keyed by its path
 * relative to app/src (posix separators). */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}

const SOURCE_FILES = allSourceFiles(SRC_ROOT);

// The four sites task w52-d verified (at the file) are NOT collections, each
// with a one-line reason -- these are the task's own scope and get a real
// non-collection justification.
//
// The collection zero-states this scan's full-tree enumeration turned up
// outside w52-d's six named surfaces have since been converted in wave 55:
// w55-c took the speaker detail page's four sub-collections (sessions,
// tasks, files, other events) and the file-versions list in VersionList.tsx;
// w55-b took the six contacts-group lists (DirectoryRail x3, DuplicatesView,
// PipelineBoard, SegmentsPanel). Both files therefore left the ALLOWLIST
// entirely, and SpeakerDetailPage's entry dropped 5 -> 1: only its
// non-collection notes field survives. Every entry below is now a genuine
// non-collection site with a real justification -- no "left for a future
// wave" placeholders remain.
const ALLOWLIST: Record<string, { count: number; reason: string }> = {
  'pages/review/ReviewerQueue.tsx': {
    count: 1,
    reason:
      "the closed-plan notice is a plan-state notice, not an empty collection -- there is no list to have zero rows. It carries two mutually exclusive voices since DEC-018's wave-58 amendment ('This review plan is not currently open.' for a reviewer, the 'seeing it as an organiser' line for an organizer), rendered as ONE element with conditional text so this count stays at 1.",
  },
  'pages/Review.tsx': {
    count: 1,
    reason:
      "'That page belongs to the {owner} view.' is a cross-role routing notice (DEC-608), not a collection result.",
  },
  'pages/submissions/DeleteSubmissionsPage.tsx': {
    count: 1,
    reason:
      "'No sessions selected. Pick sessions to delete...' is an instruction for a page that was never handed a collection to render.",
  },
  'components/RouteErrorBoundary.tsx': {
    count: 1,
    reason:
      "the <p className=\"chq-empty\"> here wraps the boundary's own retry/back action row, reusing the class for spacing, not to state a zero-row result.",
  },
  'pages/contacts/MergePage.tsx': {
    count: 1,
    reason:
      "'Pick two or more duplicate records...' is an instruction for a page handed no selection, same shape as DeleteSubmissionsPage's -- not a collection, but not in w52-d's named scope to convert either.",
  },
  'pages/speakers/SpeakerDetailPage.tsx': {
    count: 1,
    reason:
      "the notes field's 'No notes.' line is the one surviving non-collection site -- a single field's absent value, not a zero-row collection; sessions/tasks/files/other-events all converted to EmptyState on w55-c.",
  },
};

/** Matches opening tags of the shape `<tag ...className="...">` (and the
 * self-closing form), extracting the tag name and its attribute string. Does
 * not require a matching close tag -- this scan only needs to test the
 * className token list on the opening tag itself. */
const OPEN_TAG_RE = /<(\w+)\b([^>]*)>/g;

function classTokens(attrs: string): Set<string> {
  const m = attrs.match(/\bclassName=(?:"([^"]*)"|'([^']*)')/);
  const text = m ? (m[1] ?? m[2] ?? '') : '';
  return new Set(text.split(/\s+/).filter(Boolean));
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

interface Hit {
  line: number;
  tag: string;
}

/** Every element in `source` whose className token list contains the EXACT
 * token `chq-empty` -- never `chq-empty-block`/`chq-empty-what`/`chq-empty-
 * reason`/`chq-empty-actions`/`chq-empty-escape`, which are EmptyState's own
 * family and are the fix, not the offense. */
function findChqEmptyElements(source: string): Hit[] {
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  OPEN_TAG_RE.lastIndex = 0;
  while ((m = OPEN_TAG_RE.exec(source))) {
    const tag = m[1]!;
    const attrs = m[2] ?? '';
    if (!classTokens(attrs).has('chq-empty')) continue;
    hits.push({ line: lineOf(source, m.index), tag });
  }
  return hits;
}

describe('DEC-678 (w52-d): the bare chq-empty line survives only at four documented, non-collection sites', () => {
  it('visits at least 40 source files (vacuous-scan tripwire)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(40);
  });

  it('every ALLOWLIST entry names a file this scan actually visits (dead-config tripwire)', () => {
    for (const file of Object.keys(ALLOWLIST)) {
      expect(SOURCE_FILES, `${file} is not among the files this scan visits`).toContain(file);
    }
  });

  it('the set of files carrying a bare chq-empty element, with counts, equals the ALLOWLIST exactly', () => {
    const actual: Record<string, number> = {};
    const offenseLines: string[] = [];
    for (const relFile of SOURCE_FILES) {
      const source = readFileSync(join(SRC_ROOT, relFile), 'utf8');
      const hits = findChqEmptyElements(source);
      if (hits.length === 0) continue;
      actual[relFile] = hits.length;
      for (const hit of hits) offenseLines.push(`${relFile}:${hit.line}: <${hit.tag} className="chq-empty">`);
    }

    const expected: Record<string, number> = {};
    for (const [file, { count }] of Object.entries(ALLOWLIST)) expected[file] = count;

    expect(actual, offenseLines.join('\n')).toEqual(expected);
  });

  describe('negative control on a synthetic source (fingerprint precision)', () => {
    it('flags a bare <p className="chq-empty"> element', () => {
      expect(findChqEmptyElements('<p className="chq-empty">Nothing here.</p>')).toHaveLength(1);
    });

    it('does NOT flag EmptyState\'s own chq-empty-block/-what/-reason/-escape family', () => {
      const source = `
        <div className="chq-empty-block chq-empty-block-fresh">
          <p className="chq-empty-what">No reviewers assigned yet.</p>
          <p className="chq-empty-reason">reason</p>
        </div>
      `;
      expect(findChqEmptyElements(source)).toEqual([]);
    });

    it('does NOT flag an unrelated className containing "chq-empty" as a substring of another token', () => {
      expect(findChqEmptyElements('<div className="chq-emptyish-thing">x</div>')).toEqual([]);
    });
  });
});
