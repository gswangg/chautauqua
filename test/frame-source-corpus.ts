// Shared frame-label source corpus (DEC-967 wave-130 amendment; task w5-n).
//
// Every ledger that asks "does the app render this frame's literal label?"
// (test/frame-control-label.scan.test.ts, and any sibling that lands later)
// needs the same three primitives: enumerate the non-test source files that
// could contain the label, normalize each file's text so comments/entities/
// whitespace cannot fake a match, and decide whether a label occurs in that
// normalized corpus. Two independent copies of this logic rot independently
// (DEC-967 wave-128 clause 4 names the exact rot: a naive two-regex comment
// stripper eats real code). This module is the ONE place that logic lives.
//
// This is a plain helper module, not a suite -- vitest.config.ts's `include`
// is `test/**/*.test.ts`, so a bare `.ts` file under `test/` is never
// collected as a test file. Its own behaviour is proved by
// test/frame-source-corpus.test.ts, over fabricated fixtures only.
import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

function isSourceFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.css');
}

/** True for the decision-registry's own prose (DEC-976 wave-129 amendment
 * (c)): `src/decisions-data/**`'s `DEC_NNN` constants and `src/decisions.ts`'s
 * barrel are English sentences that quote frame labels verbatim, so a
 * ruling's own prose satisfying the ledger it rules on is DEC-967's "a
 * ledger a comment can satisfy is not a ledger", one level out. Skipped
 * from the match corpus so the registry can never grade itself.
 *
 * Matched on path segments rather than on a `root`-derived prefix so the
 * exclusion holds for any `root` a caller passes. */
export function isDecisionRegistryFile(full: string): boolean {
  const parts = full.split(sep);
  const srcIdx = parts.lastIndexOf('src');
  if (srcIdx === -1) return false;
  const rest = parts.slice(srcIdx + 1);
  if (rest[0] === 'decisions-data') return true;
  return rest.length === 1 && rest[0] === 'decisions.ts';
}

/** Every .ts/.tsx/.css file under `root`, skipping any path containing
 * `.test.` and the decision registry itself, enumerated via readdirSync
 * rather than named (DEC-808: a directory is not a population, but an
 * enumeration of one is). */
export function enumerateSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isSourceFile(entry.name)) continue;
    const full = join(entry.parentPath, entry.name);
    if (full.includes('.test.')) continue;
    if (isDecisionRegistryFile(full)) continue;
    out.push(full);
  }
  return out.sort();
}

type ScanState = 'normal' | 'single' | 'double' | 'template' | 'line' | 'block';

/** Single left-to-right scanner that strips block and line comments while
 * tracking `'`/`"`/`` ` `` string and template-literal state and stepping
 * over backslash escapes. This is deliberately NOT two chained regex
 * replaces (a block-comment regex chained into a line-comment regex): that
 * shape lets a block-comment opener that appears INSIDE a line comment open
 * a phantom block comment that swallows real code up to the next block-
 * comment closer anywhere later in the file, and lets a line-comment opener
 * that appears inside a string (e.g. a
 * `'https://…'` literal) truncate that line. Measured on main `9fa38009`:
 * the two-regex version loses `app/src/pages/Overview.tsx`'s rendered
 * `'Add a speaker by hand ›'` label this exact way (DEC-967 wave-130
 * amendment, sighting recurs). A comment is replaced with a single space so
 * tokens on either side of it never fuse together; string/template contents
 * are left untouched (including any `//` or `/*` they contain) because they
 * are not comments. */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let state: ScanState = 'normal';

  while (i < n) {
    const c = src[i]!;
    const c2 = i + 1 < n ? src[i + 1] : undefined;

    if (state === 'normal') {
      if (c === '/' && c2 === '/') {
        state = 'line';
        out += ' ';
        i += 2;
        continue;
      }
      if (c === '/' && c2 === '*') {
        state = 'block';
        out += ' ';
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        state = c === "'" ? 'single' : c === '"' ? 'double' : 'template';
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (c === '\n') {
        state = 'normal';
        out += c;
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (c === '*' && c2 === '/') {
        state = 'normal';
        out += ' ';
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    // state is 'single' | 'double' | 'template': inside a string/template.
    const quoteChar = state === 'single' ? "'" : state === 'double' ? '"' : '`';
    if (c === '\\') {
      out += c;
      if (c2 !== undefined) out += c2;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
    if (c === quoteChar) state = 'normal';
    continue;
  }

  return out;
}

/** Decode table for every HTML entity the app corpus is measured (task
 * w11-ff) to actually write across app/src/** + src/** (excluding the
 * decision registry and .test. files, same population enumerateSourceFiles
 * yields for every ledger that imports this module). DEC-967 sighting #14:
 * a decode hole can only ever INVENT a control-label/caption offender, never
 * hide one, because the frame pack itself writes only &amp;/&lt;/&gt; --
 * every other entity below comes from the APP side, the side
 * normalizeSource() decodes. Exported (rather than kept module-private) so
 * test/entity-decode-coverage.scan.test.ts can grade this exact table
 * instead of holding a second copy of it (DEC-613). */
export const ENTITY_MAP: Record<string, string> = {
  '&lsaquo;': '‹',
  '&rsaquo;': '›',
  '&middot;': '·',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '’',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&hellip;': '…',
  '&apos;': "'",
  '&quot;': '"',
  '&times;': '×',
  '&gt;': '>',
  '&lt;': '<',
  '&#39;': "'",
  '&rarr;': '→',
  '&larr;': '←',
  '&#9650;': '▲',
  '&#8599;': '↗',
};

/** Strips comments (block and line, string/template-aware), decodes the
 * frame-pack's HTML entities, and collapses whitespace runs to a single
 * space -- DEC-967 wave-128 clause 4. */
export function normalizeSource(raw: string): string {
  let s = stripComments(raw);
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(char);
  }
  return s.replace(/\s+/g, ' ');
}

function isAlnum(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/** True when `label` (whitespace-collapsed) occurs verbatim, word-boundary
 * anchored, in some already-normalized source blob. A needle whose first or
 * last character is alphanumeric may not sit directly against another
 * alphanumeric character in the blob -- so the frame's `Wait` is NOT
 * satisfied by the app's `Waitlist`. A needle that starts/ends with
 * punctuation (e.g. `‹ Your portal`) has no such constraint on that side. */
export function labelIsMatched(label: string, normalizedBlobs: string[]): boolean {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return false;
  const firstIsAlnum = isAlnum(needle[0]);
  const lastIsAlnum = isAlnum(needle[needle.length - 1]);

  return normalizedBlobs.some((blob) => {
    let idx = blob.indexOf(needle);
    while (idx !== -1) {
      const before = idx > 0 ? blob[idx - 1] : undefined;
      const afterIdx = idx + needle.length;
      const after = afterIdx < blob.length ? blob[afterIdx] : undefined;
      const boundaryBeforeOk = !firstIsAlnum || !isAlnum(before);
      const boundaryAfterOk = !lastIsAlnum || !isAlnum(after);
      if (boundaryBeforeOk && boundaryAfterOk) return true;
      idx = blob.indexOf(needle, idx + 1);
    }
    return false;
  });
}
