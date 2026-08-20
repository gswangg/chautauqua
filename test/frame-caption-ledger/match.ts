// Frame caption/consequence ledger -- MATCH module (DEC-976 wave-133; split
// from test/frame-caption-ledger.scan.test.ts by the contention-custodian
// decomposition, no behaviour change).
//
// Builds the source-corpus side (every non-test .ts/.tsx/.css/.md under
// app/src/** and src/**), the string/template-aware comment stripper and
// this ledger's own wide HTML-entity table, the normalize/match primitives,
// and the resulting UNMATCHED population. See
// test/frame-caption-ledger.scan.test.ts's own header for the full
// rationale (why this file cannot reuse frame-source-corpus.ts's
// stripComments/isSourceFile directly, only its isDecisionRegistryFile
// predicate).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDecisionRegistryFile } from '../frame-source-corpus';
import type { Caption } from './population';
import { CAPTIONS_AFTER_EXCLUSION } from './exclusions';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/frame-caption-ledger/
const REPO_ROOT = join(HERE, '..', '..');
export const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
export const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Match side: every non-test .ts/.tsx/.css/.md under app/src/** and src/**

function isSourceFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.css') || name.endsWith('.md');
}

/** Every .ts/.tsx/.css/.md file under `root`, skipping any path containing
 * `.test.` AND the decision registry (`src/decisions-data/**`,
 * `src/decisions.ts`), enumerated via readdirSync rather than named
 * (DEC-808). The registry predicate is IMPORTED from
 * test/frame-source-corpus.ts (its sibling ledgers already share it) rather
 * than re-implemented -- this ledger's own prior private enumerator dropped
 * that clause, so eleven captions read BUILT only because a `DEC_NNN` string
 * constant or a `DEC-NNN.md` amendment quotes them verbatim (DEC-967/DEC-613
 * wave-138). The file-kind list stays LOCAL (unlike that module's, this
 * ledger's own corpus deliberately reaches `.md`, which the shared
 * `isSourceFile` does not) -- sharing the PREDICATE, not the enumerator. */
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
 * over backslash escapes -- the same string-aware shape
 * test/frame-source-corpus.ts's stripComments uses (DEC-967 wave-130), so a
 * `//`/`/*` inside a string literal is never mistaken for a real comment
 * opener. Re-implemented here (rather than imported) because this ledger's
 * own entity table below is wider than that module's, and the two must stay
 * one function each, not a shared function called with two different entity
 * tables threaded through it. */
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

// Wide entity table -- DEC-976 wave-133's own list, beyond
// test/frame-source-corpus.ts's set (which lacks &hellip; &quot; &#39;
// &ldquo; &rdquo; &lt; &gt;).
export const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lsaquo;': '‹',
  '&rsaquo;': '›',
  '&nbsp;': ' ',
  '&middot;': '·',
  '&hellip;': '…',
  '&quot;': '"',
  '&#39;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
  '&rsquo;': '’',
  '&lsquo;': '‘',
};

/** Strips comments (string/template-aware), decodes this ledger's wide HTML
 * entity table, and collapses whitespace runs to a single space. Applied
 * identically to both the frame-pack side and the source-corpus side. */
export function normalizeCaption(raw: string): string {
  let s = stripComments(raw);
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(char);
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** True when `text` (normalized) occurs verbatim as a substring of some
 * already-normalized source blob. Plain substring, not boundary-anchored:
 * every population member here is >= 20 chars (the population's own length
 * discriminator), so an accidental in-word collision is not a realistic
 * risk the way it is for a short control label. */
export function captionIsMatched(text: string, normalizedBlobs: string[]): boolean {
  const needle = normalizeCaption(text);
  if (needle.length === 0) return false;
  return normalizedBlobs.some((blob) => blob.includes(needle));
}

export const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
export const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeCaption(readFileSync(f, 'utf-8')));

export const UNMATCHED: Caption[] = CAPTIONS_AFTER_EXCLUSION.filter(
  (c) => !captionIsMatched(c.text, NORMALIZED_SOURCE_BLOBS)
);
