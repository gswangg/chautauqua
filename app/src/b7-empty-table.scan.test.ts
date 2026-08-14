// DESIGN-RULINGS B7 rule 6 (DEC-678): a loaded, empty row set never renders
// as "a full <thead>/pager over a one-cell apology". That pattern has two
// textual fingerprints in the JSX this codebase writes: a <td> tagged
// `className="chq-empty"` (the flat one-line-message convention this rule
// retires), and a <td colSpan={...}> whose literal text (JSX `{...}`
// expressions stripped) reads "No ..."/"Nothing ...". Neither fingerprint is
// itself the rule -- the shared EmptyState component (app/src/components/
// EmptyState.tsx) is -- but a scan that ENUMERATES every <td> in
// app/src/pages/**/*.tsx (never a hand-list, per house convention) catches a
// future page reintroducing the retired pattern without having to know its
// name in advance.
//
// Two exceptions are legitimate, not violations of the rule:
//   - a loading-row placeholder (<PageSkeleton>/<DelayedLoading> as the
//     cell's content) is a WAIT, not an empty result, and is explicitly
//     out of scope;
//   - ResultsTable's per-row "Reviews" disclosure band (className
//     `chq-review-reviews-detail`) is a sub-region of an already-populated
//     row (the parent submission has results; only ITS reviews list is
//     momentarily empty/loading), not the table's own zero-row state.
//
// ALLOWLIST holds exactly the files named by task-w47-c's own scope, each
// with a one-line reason, and is checked for EXISTENCE only (the named file
// must still be among the files this scan visits) -- deliberately NOT for
// "still violates", per DEC-678's wave-47 amendment, so a parallel branch
// that fixes one of these out from under this scan does not flip it red for
// having "nothing left to allow".
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES_ROOT = join(HERE, 'pages');

/** Every *.tsx file under app/src/pages, excluding test files, keyed by its
 * path relative to app/src/pages (posix separators). */
function allPageFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}

const PAGE_FILES = allPageFiles(PAGES_ROOT);

// Files whose remaining `chq-empty`/"No .../Nothing ..." <td> markup is
// deliberately out of this scan's authority: each is being converted to
// EmptyState on a parallel branch this same wave (per the wave-47 field
// guide finding), and re-flagging it here would only ever be redundant with
// (or, worse, contradict) that branch's own fix.
const ALLOWLIST: Record<string, string> = {
  'content/SessionList.tsx': 'being converted to EmptyState on a parallel branch this wave',
  'content/FilesLibrary.tsx': 'being converted to EmptyState on a parallel branch this wave',
};

/** Strips balanced `{...}` JSX expression segments (including
 * `{/* comment *\/}` blocks, which are themselves `{...}`) from a <td>'s
 * inner text, leaving only literal JSX text content to test for "No"/
 * "Nothing". Depth-counted rather than a non-greedy regex so a `{cond &&
 * ({...})}` expression containing its own nested braces is removed whole,
 * not truncated at its first inner `}`. */
function stripJsxExpressions(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

function classTokens(attrs: string): Set<string> {
  const m = attrs.match(/\bclassName=(?:"([^"]*)"|'([^']*)')/);
  const text = m ? (m[1] ?? m[2] ?? '') : '';
  return new Set(text.split(/\s+/).filter(Boolean));
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

interface Offense {
  file: string;
  line: number;
  text: string;
}

const TD_RE = /<td\b([^>]*)>([\s\S]*?)<\/td>/g;
const NO_NOTHING_RE = /\b(No|Nothing)\b/;
const PERMITTED_CONTENT_RE = /<(PageSkeleton|DelayedLoading)\b/;

function scanFile(relFile: string, source: string): Offense[] {
  const offenses: Offense[] = [];
  let m: RegExpExecArray | null;
  TD_RE.lastIndex = 0;
  while ((m = TD_RE.exec(source))) {
    const attrs = m[1] ?? '';
    const content = m[2] ?? '';
    const tokens = classTokens(attrs);
    const line = lineOf(source, m.index);

    if (tokens.has('chq-empty')) {
      offenses.push({ file: relFile, line, text: `className="chq-empty"` });
      continue;
    }

    if (!/\bcolSpan\b/.test(attrs)) continue;
    if (tokens.has('chq-review-reviews-detail')) continue;
    if (PERMITTED_CONTENT_RE.test(content)) continue;

    const literalText = stripJsxExpressions(content).replace(/\s+/g, ' ').trim();
    if (NO_NOTHING_RE.test(literalText)) {
      offenses.push({ file: relFile, line, text: literalText });
    }
  }
  return offenses;
}

describe('DEC-678 B7 rule 6: a loaded, empty row set never renders as a bare <td> apology', () => {
  it('visits at least 15 page files (vacuous-scan tripwire)', () => {
    expect(PAGE_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('every ALLOWLIST entry names a file this scan actually visits (dead-config tripwire)', () => {
    for (const file of Object.keys(ALLOWLIST)) {
      expect(PAGE_FILES, `${file} is not among the files this scan visits`).toContain(file);
    }
  });

  for (const relFile of PAGE_FILES) {
    if (ALLOWLIST[relFile]) continue;
    it(`${relFile}: no <td className="chq-empty"> and no <td colSpan> reading "No…"/"Nothing…"`, () => {
      const source = readFileSync(join(PAGES_ROOT, relFile), 'utf8');
      const offenses = scanFile(relFile, source);
      expect(
        offenses,
        offenses.map((o) => `${o.file}:${o.line}: ${JSON.stringify(o.text)}`).join('\n'),
      ).toEqual([]);
    });
  }
});
