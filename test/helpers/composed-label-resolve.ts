// Composed-label resolution tier (DEC-393 wave-23 amendment; task w23-g).
//
// Both drawn-floor ledgers (test/frame-control-floor.scan.test.ts,
// test/desktop-control-floor.scan.test.ts) join a drawn frame label to a
// product rule via an OWN-TEXT-EQUAL match: the enclosing element's own
// text content must normalise to EXACTLY the label. That join can never
// match a label composed at render -- a shared copy helper's template
// literal, filled with live data (a ref, a clock time, a room name) -- so
// nearly half the pack's drawn controls carry NO floor verdict at all
// (`no-label-match`), which both files' own prose already names as this
// campaign's "a drained ledger measures citation, not conformance" failure.
//
// This module is the ONE place that resolution tier lives (DEC-613: never
// two copies of one join). Both scan files import it and pass their own
// `classTokensNear`/blob corpus in -- the algorithm is shared, the
// surrounding grade pipeline (control-shape corroboration, CSS resolution)
// stays each file's own, exactly as the wave-25 union join already did for
// the own-text tier.
//
// ALGORITHM:
//   1. POPULATION of composed helpers: readdirSync (never hand-listed)
//      every `src/domain/*-copy.ts` and `app/src/lib/*-vocabulary.ts` file,
//      and inside each, every `export function NAME(...): string { ... }`
//      whose body RETURNS at least one template literal containing a
//      `${...}` hole (a plain literal return, or a body with no template
//      literal at all, is not "composed" -- it is either already reachable
//      by the own-text tier, or not a copy helper this tier can use).
//   2. Each returned template literal is decomposed into its FIXED text
//      segments: `tpl.split(/\$\{[^}]*\}/)`, keeping the unfiltered parts
//      array (including empty strings) so the first/last part's emptiness
//      still records whether the template itself opens/closes on a hole.
//   3. MATCH: a drawn label matches a template when its fixed segments
//      occur in the label IN ORDER, the first NON-EMPTY segment anchored
//      to the label's start (only when the template itself opens on that
//      segment, i.e. it is parts[0]) and the last NON-EMPTY segment
//      anchored to the label's end (only when it is the template's last
//      part) -- e.g. `Move ${ref} to ${clockHMM(startMin)}` (parts:
//      `["Move ", " to ", ""]`) matches "Move DFC-047 to 11:30" because
//      "Move " opens the label and " to " occurs after it, and the
//      template's own last part is "" (ends on a hole) so no end-anchor is
//      required.
//   4. HONESTY (non-negotiable, this wave's own ruling): a label resolves
//      only when it matches EXACTLY ONE helper's template (never a
//      first-match pick -- two helpers matching the same label leaves the
//      row unresolved) AND that helper has EXACTLY ONE call-site in the
//      whole corpus whose enclosing tag's own text is nothing but that one
//      call expression (`{helperName(...)}`, no concatenation, no sibling
//      text) -- two call sites is left UNRESOLVED too, deliberately NOT
//      unioned the way the own-text tier unions multiple genuine render
//      sites of a literal label: a composed call site's ARGUMENTS differ
//      per call, so two call sites are not proof the same control renders
//      it, only that the same helper is invoked twice. The caller (each
//      scan file's own `gradeControl`) still applies its own
//      control-shape corroboration on top of whatever tokens this
//      resolves -- this module never grades OFFENDER/UNRESOLVED itself, it
//      only resolves a token set or returns null.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ComposedHelper {
  name: string;
  /** repo-relative-ish absolute file path the helper is defined in. */
  file: string;
  /** One entry per returned template literal containing at least one
   * `${...}` hole; each entry is that template's unfiltered `split` parts
   * (may include empty strings at either end). */
  templates: string[][];
}

const HOLE_RE = /\$\{[^{}]*\}/g;
const HOLE_TEST_RE = /\$\{[^{}]*\}/; // non-global: safe to re-`.test()` in a loop
const FUNC_SIG_RE = /export function (\w+)\s*\([^)]*\)\s*:\s*string\s*\{/g;
// Only a BARE `return \`...\`;` counts -- this is deliberately narrower
// than "any template literal in the body": it excludes a `throw new
// Error(\`...\`)` validation message (never rendered UI copy) and any
// template literal that is merely an argument to a nested call rather than
// the function's own returned value.
const RETURNED_TEMPLATE_RE = /return\s+`([^`]*)`\s*;/g;
// A template whose only non-empty fixed segment is shorter than this is too
// weak to disambiguate a label from unrelated prose (e.g. countOf's lone
// " " joiner would otherwise "match" almost any two-word label).
const MIN_DISTINGUISHING_SEGMENT_LENGTH = 3;

function findMatchingBrace(text: string, openBraceIdx: number): number {
  let depth = 0;
  for (let i = openBraceIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`composed-label-resolve: unbalanced braces from offset ${openBraceIdx}`);
}

/** Every exported string-returning function across every `*-copy.ts` file
 * directly under `domainRoot` and every `*-vocabulary.ts` file directly
 * under `appLibRoot`, whose body returns at least one hole-bearing template
 * literal. `readdirSync`-derived (DEC-180/808: never a hand-listed helper
 * name), non-recursive by design -- both globs name files directly under
 * their root, matching every file that exists on this branch. */
export function discoverComposedHelpers(domainRoot: string, appLibRoot: string): ComposedHelper[] {
  const files: string[] = [
    ...readdirSync(domainRoot, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('-copy.ts'))
      .map((e) => join(domainRoot, e.name)),
    ...readdirSync(appLibRoot, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('-vocabulary.ts'))
      .map((e) => join(appLibRoot, e.name)),
  ].sort();

  const out: ComposedHelper[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf-8');
    FUNC_SIG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FUNC_SIG_RE.exec(text))) {
      const name = m[1]!;
      const bodyOpen = m.index + m[0].length - 1; // offset of the signature's own '{'
      const bodyClose = findMatchingBrace(text, bodyOpen);
      const body = text.slice(bodyOpen, bodyClose + 1);
      RETURNED_TEMPLATE_RE.lastIndex = 0;
      const templates: string[][] = [];
      let tm: RegExpExecArray | null;
      while ((tm = RETURNED_TEMPLATE_RE.exec(body))) {
        const tpl = tm[1]!;
        if (!HOLE_TEST_RE.test(tpl)) continue; // no hole -> not composed, skip
        const parts = tpl.split(HOLE_RE);
        if (!parts.some((p) => p.length >= MIN_DISTINGUISHING_SEGMENT_LENGTH)) continue; // too weak to disambiguate
        templates.push(parts);
      }
      if (templates.length === 0) continue;
      out.push({ name, file, templates });
    }
  }
  return out;
}

/** True when `label`'s fixed text follows `parts` (a template's unfiltered
 * `split` result) in order: the first part anchors the label's start when
 * it is non-empty (the template itself opens on literal text), the last
 * part anchors the label's end when it is non-empty (the template itself
 * closes on literal text), and every part in between (and an empty
 * first/last part) is simply required to occur, in order, without
 * overlapping the previous match. */
export function templateMatchesLabel(label: string, parts: string[]): boolean {
  if (parts.length < 2) return false; // no hole at all -- not a composed template
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]!;
    const isFirst = i === 0;
    const isLast = i === parts.length - 1;
    if (seg.length === 0) continue;
    if (isFirst) {
      if (!label.startsWith(seg)) return false;
      pos = seg.length;
      continue;
    }
    if (isLast) {
      if (!label.endsWith(seg)) return false;
      const idx = label.length - seg.length;
      if (idx < pos) return false;
      continue;
    }
    const idx = label.indexOf(seg, pos);
    if (idx === -1) return false;
    pos = idx + seg.length;
  }
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every position in `blob` where `helperName(...)` is called as the
 * WHOLE own text of its enclosing tag -- `{helperName(args)}`, nothing
 * concatenated before or after it in that tag's text-node span. Mirrors
 * each scan file's own `ownTextEquals` shape (nearest preceding `>` to
 * next `<` is the tag's own text), generalised from a literal label to a
 * call-expression shape. The returned offset points at the `{` so callers'
 * `classTokensNear(blob, idx)` (which itself only needs `idx` to sit
 * inside the enclosing tag's text-node span) resolves the SAME enclosing
 * tag's class tokens. */
export function ownExpressionCallSites(helperName: string, blob: string): number[] {
  const callRe = new RegExp(`\\{\\s*${escapeRegExp(helperName)}\\([^{}]*\\)\\s*\\}`, 'g');
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  callRe.lastIndex = 0;
  while ((m = callRe.exec(blob))) {
    const idx = m.index;
    const prevGt = blob.lastIndexOf('>', idx);
    if (prevGt === -1) continue;
    const afterPrevGt = blob.slice(prevGt + 1, idx);
    if (afterPrevGt.trim().length > 0) continue; // extra leading text -- not the tag's WHOLE own text
    if (afterPrevGt.includes('<')) continue; // idx sits inside an as-yet-unclosed tag's own attribute value
    const matchEnd = idx + m[0].length;
    const nextLt = blob.indexOf('<', matchEnd);
    const trailing = blob.slice(matchEnd, nextLt === -1 ? blob.length : nextLt);
    if (trailing.trim().length > 0) continue; // extra trailing text -- not the tag's WHOLE own text
    positions.push(idx);
  }
  return positions;
}

export interface ComposedResolution {
  tokens: string[];
  matchedHelper: string;
  matchedFile: string;
}

/**
 * Resolves a drawn label's `chq-` token set through the composed-label
 * tier, or returns `null` when the label does not resolve. `null` covers
 * every honesty-clause exit: no helper matches, more than one helper
 * matches (ambiguous), the matched helper has zero call sites shaped as
 * its own text, or it has more than one such call site (ambiguous -- see
 * file header, deliberately NOT unioned).
 *
 * `classTokensNear` is the CALLER's own primitive (each scan file already
 * has one, byte-identical in shape) so this module never re-implements the
 * class-attribute reader a third time (DEC-613).
 */
export function resolveComposedLabel(
  label: string,
  helpers: readonly ComposedHelper[],
  blobs: readonly string[],
  classTokensNear: (blob: string, idx: number) => string[],
): ComposedResolution | null {
  const matchingHelpers = helpers.filter((h) => h.templates.some((parts) => templateMatchesLabel(label, parts)));
  if (matchingHelpers.length !== 1) return null;
  const helper = matchingHelpers[0]!;

  const sites: { blob: string; idx: number }[] = [];
  for (const blob of blobs) {
    for (const idx of ownExpressionCallSites(helper.name, blob)) {
      sites.push({ blob, idx });
    }
  }
  if (sites.length !== 1) return null;

  const tokens = classTokensNear(sites[0]!.blob, sites[0]!.idx).filter((t) => t.startsWith('chq-'));
  return { tokens, matchedHelper: helper.name, matchedFile: helper.file };
}
