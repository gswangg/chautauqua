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

// Second fingerprint (DEC-678 amendment, w51-b): the `<td className="chq-
// empty">` shape only catches the retired pattern when it's still inside a
// table. B7's filtered-vs-fresh split is load-bearing outside <td> too --
// e.g. a bare `<p className="chq-empty">No sends match "{q}".</p>` sitting
// beside a search input. That line carries the SAME offense (the flat,
// escape-less `chq-empty` register standing in for EmptyState's 'filtered'
// variant) without ever being a <td>.
//
// This fingerprint is deliberately narrow: it fires only on an element
// whose className tokens include the EXACT token `chq-empty` (never the
// `chq-empty-block`/`chq-empty-what`/... family EmptyState itself renders --
// those are the fix, not the offense) AND whose JSX children interpolate a
// search/filter identifier (`{q`, `{query`, `{search`, `{filter`). A lone,
// unparameterised `chq-empty` line (a rail's or sub-list's one-line "nothing
// here" message) is explicitly blessed -- see the comment at the top of
// app/src/components/EmptyState.tsx -- and is NOT flagged; only the
// filtered-search voice is retired.
const CHQ_EMPTY_ELEMENT_RE = /<(\w+)\b([^>]*\bclassName=(?:"[^"]*"|'[^']*')[^>]*)>([\s\S]*?)<\/\1>/g;
const FILTER_IDENTIFIER_RE = /\{(q|query|search|filter)\b/;

function scanFilteredEmptyProse(relFile: string, source: string): Offense[] {
  const offenses: Offense[] = [];
  let m: RegExpExecArray | null;
  CHQ_EMPTY_ELEMENT_RE.lastIndex = 0;
  while ((m = CHQ_EMPTY_ELEMENT_RE.exec(source))) {
    const tag = m[1];
    if (tag === 'td') continue; // covered by the first fingerprint above
    const attrs = m[2] ?? '';
    const content = m[3] ?? '';
    const tokens = classTokens(attrs);
    if (!tokens.has('chq-empty')) continue;
    if (!FILTER_IDENTIFIER_RE.test(content)) continue;
    const line = lineOf(source, m.index);
    offenses.push({ file: relFile, line, text: stripJsxExpressions(content).replace(/\s+/g, ' ').trim() });
  }
  return offenses;
}

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
  offenses.push(...scanFilteredEmptyProse(relFile, source));
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

  describe('second fingerprint: a filtered chq-empty line outside a <td> (negative control on a synthetic source)', () => {
    it('flags a non-<td> element carrying chq-empty and interpolating the search query', () => {
      const source = `
        function C() {
          return <p className="chq-empty">No sends match &ldquo;{q.trim()}&rdquo;.</p>;
        }
      `;
      const offenses = scanFilteredEmptyProse('synthetic.tsx', source);
      expect(offenses).toHaveLength(1);
    });

    it('does NOT flag an unparameterised one-line chq-empty message (blessed rail/sub-list voice)', () => {
      const source = `
        function C() {
          return <p className="chq-empty">No duplicate groups found.</p>;
        }
      `;
      expect(scanFilteredEmptyProse('synthetic.tsx', source)).toEqual([]);
    });

    it('does NOT flag EmptyState\'s own chq-empty-block/-what family, even alongside a filter identifier', () => {
      const source = `
        function C() {
          return (
            <div className="chq-empty-block chq-empty-block-filtered">
              <p className="chq-empty-what">No sends match {q}.</p>
            </div>
          );
        }
      `;
      expect(scanFilteredEmptyProse('synthetic.tsx', source)).toEqual([]);
    });

    it('does NOT re-flag a <td className="chq-empty"> (already covered by the first fingerprint)', () => {
      const source = `
        function C() {
          return <td className="chq-empty">No matches for {q}.</td>;
        }
      `;
      expect(scanFilteredEmptyProse('synthetic.tsx', source)).toEqual([]);
    });
  });
});
