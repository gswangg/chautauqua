// Frame caption/consequence ledger -- POPULATION module (DEC-976 wave-133;
// task w8-a; split from test/frame-caption-ledger.scan.test.ts by the
// contention-custodian decomposition, no behaviour change).
//
// Extracts every population-qualifying muted-prose caption from
// docs/design/*.dc.html. See test/frame-caption-ledger.scan.test.ts's own
// header for the full grammar rationale (muted colours, uppercase/eyebrow
// exclusion, `{{`/digit/`@` discriminators, >= 20 chars). This module owns
// only the EXTRACTION grammar; exclusion tables live in ./exclusions.ts and
// the match/ratchet machinery lives in ./match.ts and ./ceiling.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/frame-caption-ledger/
const REPO_ROOT = join(HERE, '..', '..');
export const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');

export interface Caption {
  /** Bare filename under docs/design/, e.g. "Chautauqua Docs.dc.html". */
  fileName: string;
  /** 1-based line number the opening tag starts on. */
  line: number;
  text: string;
}

const MUTED_COLOR_RE = /color:#565A4B|color:#3F4237|color:#8E8A7A/;
const UPPERCASE_RE = /text-transform:uppercase/;

// Matches an opening `<span|div|p style="...">` through its own matching
// closing tag (backreference \1 on the tag name), across line breaks (`s`
// flag) -- the pack's caption spans are single-line in practice (asserted
// in the test suite's non-vacuity/exact-count guards), but the grammar
// itself does not assume that.
const TAG_RE = /<(span|div|p)\s+style="([^"]*)">([^<]*)<\/\1>/gs;

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to every sibling ledger's own designFiles(). */
export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** Extracts every population-qualifying caption from raw frame-file TEXT.
 * Exported so the non-vacuity synthetic fixture in the test suite can
 * drive this exact function over a fabricated fixture, never a real
 * product count. */
export function captionsInText(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text)) !== null) {
    const style = m[2]!;
    const rawText = m[3]!;
    if (!MUTED_COLOR_RE.test(style)) continue;
    if (UPPERCASE_RE.test(style)) continue;
    if (rawText.includes('{{')) continue;
    const trimmed = rawText.trim();
    if (trimmed.length < 20) continue;
    if (/\d/.test(trimmed)) continue;
    if (trimmed.includes('@')) continue;
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ line, text: trimmed });
  }
  return out;
}

function captionsInFile(fileName: string): Caption[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  return captionsInText(content).map((c) => ({ fileName, line: c.line, text: c.text }));
}

export const ALL_CAPTIONS: Caption[] = designFiles().flatMap(captionsInFile);
