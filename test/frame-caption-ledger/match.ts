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

// -- Digit-skeleton normalization (DEC-976 wave-142/w17-f) --------------
//
// The population side (./population.ts) no longer discards captions that
// contain a digit -- retiring that discriminator surfaced every
// count-bearing consequence caption in the pack ("23 submissions have a
// decision and nobody has been told"), most of which the app composes from
// a live count rather than spelling out literally. A plain verbatim
// substring match (the pass above) can never find those: the frame spells
// a real number, the source spells a template expression. digitSkeleton
// collapses every run of digits -- and every digit RANGE such as `12-14` or
// `12–14`, matched and replaced as ONE unit so a range never yields two
// sentinels where the frame/source pair would only agree on one -- to a
// single sentinel token, on both sides of the comparison.
const DIGIT_SKELETON_TOKEN = '#';
const DIGIT_OR_RANGE_RE = /\d+(?:\s*[-–—]\s*\d+)?/g;

/** Collapses every run of digits, and every digit range (`12-14`, `12–14`)
 * matched as a single unit, to one sentinel token. Exported so the
 * non-vacuity synthetic fixture in the test suite can drive this exact
 * function over a fabricated pair, never a live product count. */
export function digitSkeleton(s: string): string {
  return s.replace(DIGIT_OR_RANGE_RE, DIGIT_SKELETON_TOKEN);
}

// `${...}` template interpolations and single-brace `{...}` merge
// placeholders exist only on the SOURCE side (a frame caption is always
// literal text, never a template literal) -- collapsed to the SAME
// sentinel `digitSkeleton` uses, so a composed
// `` `${count} submissions have a decision...` `` skeletonizes to the exact
// same string as the frame's literal `23 submissions have a decision...`.
// `${...}` is collapsed first (its own braces would otherwise be caught,
// and mis-tokenized, by the plain single-brace pass below).
function collapseSourcePlaceholders(s: string): string {
  return s.replace(/\$\{[^}]*\}/g, DIGIT_SKELETON_TOKEN).replace(/\{[^}]*\}/g, DIGIT_SKELETON_TOKEN);
}

function sourceDigitSkeleton(s: string): string {
  return digitSkeleton(collapseSourcePlaceholders(s));
}

/** True when `text` (normalized) occurs verbatim as a substring of some
 * already-normalized source blob, OR -- a second pass, run only after the
 * first finds nothing, never in place of it -- when its digit-skeleton form
 * occurs as a substring of some source blob's own digit-skeleton form (with
 * `${...}`/`{...}` placeholders additionally collapsed on the source side).
 * Plain substring, not boundary-anchored: every population member here is
 * >= 20 chars (the population's own length discriminator), so an accidental
 * in-word collision is not a realistic risk the way it is for a short
 * control label. `skeletonBlobs`, when supplied, must be
 * `normalizedBlobs.map(sourceDigitSkeleton)` precomputed once by the
 * caller (UNMATCHED below does this so the campaign-sized scan does not
 * re-skeletonize every source blob for every one of the ~380 captions); when
 * omitted (every direct/synthetic test call) it is computed on the fly. */
export function captionIsMatched(
  text: string,
  normalizedBlobs: string[],
  skeletonBlobs?: string[]
): boolean {
  const needle = normalizeCaption(text);
  if (needle.length === 0) return false;
  if (normalizedBlobs.some((blob) => blob.includes(needle))) return true;
  const skeletonNeedle = digitSkeleton(needle);
  const blobsForSkeleton = skeletonBlobs ?? normalizedBlobs.map(sourceDigitSkeleton);
  return blobsForSkeleton.some((blob) => blob.includes(skeletonNeedle));
}

export const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
export const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeCaption(readFileSync(f, 'utf-8')));
const SKELETON_SOURCE_BLOBS: string[] = NORMALIZED_SOURCE_BLOBS.map(sourceDigitSkeleton);

export const UNMATCHED: Caption[] = CAPTIONS_AFTER_EXCLUSION.filter(
  (c) => !captionIsMatched(c.text, NORMALIZED_SOURCE_BLOBS, SKELETON_SOURCE_BLOBS)
);
