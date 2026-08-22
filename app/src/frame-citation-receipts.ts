// Frame-citation receipt logic: the "is this test-file citation actually
// proven" rule (backtick quote + nearby expect(, or a qualifying
// frame-verbatim helper call; header-block scope citations exempt, paid for
// by a companion check). Extracted verbatim from
// app/src/frame-citation.scan.test.ts's wave-87/wave-14m blocks as part of a
// contention decomposition (no behaviour change) -- see
// frame-citation-core.ts's header for the extraction rationale.
import { type Citation, quoteAfter } from './frame-citation-core';

/** How many source lines beneath a test-file citation's own line a real
 * `expect(` must appear within, to count as a receipted claim. */
export const EXPECT_PROXIMITY_LINES = 6;

export interface TestPhoneCitation extends Citation {
  sourceLine: number;
  flat: string;
  raw: string;
}

// ---------------------------------------------------------------------------
// Task w14-a (DEC-976 wave-14m amendment): two predicate changes to
// computeUnreceiptedCitations below.
//
// (1) CREDIT A FRAME-VERBATIM HELPER. The corpus's newer idiom -- see
// app/src/pages/Contacts-import.desktop-frame-verdicts.render.test.tsx:37-42
// for the canonical body -- reads DESIGN_FILE, indexes `lines[lineNo - 1]`,
// and calls `expect(line).toBe(literal)`. That is STRICTLY STRONGER than a
// comment quote plus a nearby `expect(`: it fails the owning test when the
// pack is re-cut, where a quote is inert prose. A citation is credited by a
// helper only when, within its own comment block plus EXPECT_PROXIMITY_LINES
// source lines beneath, there is a call to a helper that (a) is declared in
// the SAME file, (b) whose BODY both reads the design file and calls
// `expect(...).toBe(...)`, and (c) is invoked with the citation's cited
// FIRST line number as its first argument. All three are structural --
// derived from the helper's own body shape, never from its NAME (DEC-180: a
// name allowlist is not a population). Some files call it `frameLine`,
// others `verbatimLine`; both qualify by shape, neither by name.
//
// (2) EXEMPT HEADER-BLOCK SCOPE CITATIONS. A citation above the file's first
// `describe(` names the frame the FILE is about (DEC-808's already-
// adjudicated `.dc.html:<line>` naming shorthand) and no `expect(` can
// legally sit in a header, so it is exempt from the receipt check outright.
// The exemption is paid for by a companion assertion below: a file carrying
// a header-block citation into frame file F must also carry at least one
// FULLY receipted citation (quote+expect, or helper credit) into that same
// F elsewhere in the file -- otherwise the file declares a scope it verifies
// nothing about.
// ---------------------------------------------------------------------------

/** Every named `function NAME(...) { ... }` declaration in `raw`, with its
 * body extracted via a balanced-brace scan from the declaration's opening
 * `{` -- never a naive regex body capture, which breaks the instant a
 * helper's own body contains a nested `{}` (an object literal, an arrow
 * function, an `if`). */
export function extractFunctionDecls(raw: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const headRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = headRe.exec(raw))) {
    const braceStart = headRe.lastIndex - 1;
    let depth = 1;
    let i = braceStart + 1;
    while (i < raw.length && depth > 0) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') depth--;
      i++;
    }
    out.push({ name: m[1]!, body: raw.slice(braceStart + 1, i - 1) });
  }
  return out;
}

/** A helper body "reads the design file" when a `readFileSync(` call's
 * argument names `docs`/`design` inline, or resolves (via a same-file
 * `const`/`let`/`var` declaration) to a value that does. Never satisfied by
 * the helper's NAME -- a `verbatimLine`-named function whose body reads
 * something else entirely does not qualify. */
export function bodyReadsDesignFile(body: string, raw: string): boolean {
  const callIdx = body.search(/readFileSync\s*\(/);
  if (callIdx === -1) return false;
  const argWindow = body.slice(callIdx, callIdx + 200);
  if (/docs/i.test(argWindow) && /design/i.test(argWindow)) return true;
  const identMatch = argWindow.match(/readFileSync\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*[,)]/);
  if (!identMatch) return false;
  const varName = identMatch[1]!;
  const declRe = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=([^;]*);`, 's');
  const dm = raw.match(declRe);
  return !!dm && /docs/i.test(dm[1]!) && /design/i.test(dm[1]!);
}

/** A helper body "calls expect(...).toBe(...)" -- the shape that fails the
 * owning test outright when the cited literal stops matching, rather than
 * merely sitting beside an unrelated assertion. */
export function bodyCallsExpectToBe(body: string): boolean {
  return /expect\([\s\S]*?\)\s*\.toBe\(/.test(body);
}

/** Qualifying frame-verbatim helper names declared in `raw` (DEC-180:
 * derived from each function's BODY shape via extractFunctionDecls, never
 * from a name list). */
export function qualifyingHelperNames(raw: string): Set<string> {
  const names = new Set<string>();
  for (const fn of extractFunctionDecls(raw)) {
    if (bodyReadsDesignFile(fn.body, raw) && bodyCallsExpectToBe(fn.body)) {
      names.add(fn.name);
    }
  }
  return names;
}

const HELPER_NAMES_BY_RAW = new Map<string, Set<string>>();
export function helperNamesFor(raw: string): Set<string> {
  let names = HELPER_NAMES_BY_RAW.get(raw);
  if (!names) {
    names = qualifyingHelperNames(raw);
    HELPER_NAMES_BY_RAW.set(raw, names);
  }
  return names;
}

/** True when `windowText` contains a call to one of `helperNames` whose
 * FIRST argument is exactly `firstLine` -- `\s*` matches across the
 * newlines a multi-line call like `verbatimLine(\n  709,\n  '...'\n)`
 * wraps onto, so a wrapped call is found the same as an inline one. */
export function hasHelperCredit(
  windowText: string,
  helperNames: ReadonlySet<string>,
  firstLine: number
): boolean {
  for (const name of helperNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\s*\\(\\s*(\\d+)\\s*[,)]`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(windowText))) {
      if (Number(m[1]) === firstLine) return true;
    }
  }
  return false;
}

const FIRST_DESCRIBE_LINE_BY_RAW = new Map<string, number>();
/** The line number of a file's first `describe(` call, or Infinity if it has
 * none -- a citation strictly above this line sits in the file's header
 * block, naming the frame the file is about rather than proving a claim. */
export function firstDescribeLine(raw: string): number {
  let line = FIRST_DESCRIBE_LINE_BY_RAW.get(raw);
  if (line === undefined) {
    const idx = raw.search(/\bdescribe\s*\(/);
    line = idx === -1 ? Infinity : lineNumberAt(raw, idx);
    FIRST_DESCRIBE_LINE_BY_RAW.set(raw, line);
  }
  return line;
}

// Local copy of lineNumberAt's arithmetic to avoid a circular import back
// into frame-citation-core (core has no dependency on receipts, and this is
// the only place receipts needs a raw-index -> line-number conversion that
// core's own exported lineNumberAt already performs identically).
function lineNumberAt(raw: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (raw.charCodeAt(i) === 10) n++;
  return n;
}

export function isHeaderBlockCitation(c: { sourceLine: number; raw: string }): boolean {
  return c.sourceLine < firstDescribeLine(c.raw);
}

/** True when `c` is receipted by EITHER the quote+nearby-expect( rule or a
 * qualifying helper call -- the two independent receipt shapes this file
 * now credits. Never applies the header-block exemption (that is a
 * separate, prior gate in computeUnreceiptedCitations and in the companion
 * check below -- a header citation that also happens to satisfy this
 * predicate should not be double-counted as its own companion). */
export function isFullyReceipted(c: Citation & { sourceLine: number; flat: string; raw: string }): boolean {
  const quote = quoteAfter(c.flat, c.index);
  const rawLines = c.raw.split('\n');
  const window = rawLines.slice(c.sourceLine - 1, c.sourceLine - 1 + EXPECT_PROXIMITY_LINES);
  if (quote && quote.length > 0 && window.some((l) => l.includes('expect('))) return true;
  const helperNames = helperNamesFor(c.raw);
  if (helperNames.size === 0) return false;
  return hasHelperCredit(window.join('\n'), helperNames, c.firstLine);
}

/** Shared receipt check (quote presence + nearby `expect(`, OR a qualifying
 * helper credit; header-block scope citations exempt), factored out so the
 * phone describe block and the desktop block (DEC-808 wave-107 task w3-v)
 * run the identical rule rather than each re-implementing it -- a second
 * copy of a vocabulary is a trap with a delay fuse (DEC-613). */
export function computeUnreceiptedCitations(
  citations: readonly (Citation & { sourceLine: number; flat: string; raw: string })[]
): string[] {
  const unreceipted: string[] = [];
  for (const c of citations) {
    if (isHeaderBlockCitation(c)) continue; // DEC-808 naming shorthand, exempt (paid for below)
    if (isFullyReceipted(c)) continue;
    const quote = quoteAfter(c.flat, c.index);
    if (!quote || quote.length === 0) {
      unreceipted.push(`${c.file}:${c.sourceLine} — ${c.matchText} (no backtick-quoted literal)`);
      continue;
    }
    unreceipted.push(`${c.file}:${c.sourceLine} — ${c.matchText} (no expect( within ${EXPECT_PROXIMITY_LINES} lines beneath)`);
  }
  return unreceipted;
}

/** The companion the header-block exemption is paid for with: every file
 * that carries a header-block citation into frame file F must carry at
 * least one FULLY receipted (non-header) citation into that same F
 * elsewhere in the file -- otherwise the file declares a scope it verifies
 * nothing about. Grouped by (file, frameFile) rather than by file alone, so
 * a file citing two different frames in its header is checked per frame. */
export function computeHeaderScopeWithoutReceiptOffenders(
  citations: readonly (Citation & { sourceLine: number; flat: string; raw: string })[]
): string[] {
  const byFileFrame = new Map<string, (Citation & { sourceLine: number; flat: string; raw: string })[]>();
  for (const c of citations) {
    const key = `${c.file}::${c.frameFile}`;
    const group = byFileFrame.get(key);
    if (group) group.push(c);
    else byFileFrame.set(key, [c]);
  }
  const offenders: string[] = [];
  for (const [key, group] of byFileFrame) {
    if (!group.some(isHeaderBlockCitation)) continue;
    const hasReceiptedNonHeader = group.some((c) => !isHeaderBlockCitation(c) && isFullyReceipted(c));
    if (!hasReceiptedNonHeader) {
      const [file, frameFile] = key.split('::');
      offenders.push(`${file} declares header-block scope into ${frameFile} but carries no fully-receipted (non-header) citation into it`);
    }
  }
  return offenders.sort();
}
