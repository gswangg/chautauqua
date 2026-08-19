// Cascade-shadow sweep (DEC-385 amendment, wave 85; task w3-j).
//
// DEC-385 is single-direction responsive: a phone override lives in exactly
// one `@media (max-width: ...)` block, and that block wins its
// equal-specificity tie against a same-selector desktop rule ONLY by
// SOURCE ORDER -- the phone block must be declared textually after every
// desktop rule touching the same (selector, property) pair, since neither
// side carries extra specificity. content.css and comms.css each silently
// lost that tie once: a `@media (max-width: 700px)` block sat above a
// later desktop rule that re-declared the same selector/property, so the
// "later" desktop rule won the cascade and the phone override was DEAD --
// present in the stylesheet, absorbed by the build, asserted by no test,
// and never applied in a browser. Each was fixed one file at a time with
// one bespoke pin (`SessionList.render.test.tsx:1297`'s content.css note;
// comms.css carries its own). Nothing swept the rest of the tree.
//
// This scan is that sweep, generalised:
//
//   POPULATION (DEC-808, enumerated, never a manifest of names):
//   readdirSync over every `*.css` under `app/src` and every `*.css.ts`
//   under `src/routes`. Not four files, not a curated list -- the field
//   guide's own measured citations (portal.css.ts, settings.css,
//   review.css, speakers.css) are a snapshot of one earlier reading, not a
//   population; this scan re-derives it from the directories every run so
//   it self-corrects as other lanes move files under it.
//
//   METHOD: a small brace-matching parser (comments stripped first) walks
//   each file's raw text and records every `{...}` block as a node with a
//   header (selector or at-rule prelude), a depth, a parent, and a
//   start/close line. A "phone block" is any DEPTH-0 node whose header
//   matches `@media (max-width: ...)`. For each of ITS direct children
//   (the selector rules one level inside it), every declaration
//   (selector, property) pair is recorded. A pair is SHADOWED when a
//   DEPTH-0 top-level rule -- declared strictly AFTER the phone block's
//   own closing brace -- carries the identical (normalised) selector and
//   sets the same property. That later desktop rule wins the cascade tie
//   and the phone declaration never reaches the browser.
//
//   Interpolated selectors (`.${SOME_CONST}`) are a known artefact of the
//   `*.css.ts` template-literal modules: the `${` / `}` pair is itself a
//   balanced brace pair in the raw text, so the parser sees it and would
//   otherwise mis-attribute the following real selector's header. Any
//   header containing `$` or a backtick, or that is blank after trimming,
//   is treated as not-a-selector and excluded from both sides of the
//   comparison -- this can only make the scan UNDER-count (a missed
//   shadow behind an interpolated selector), never fabricate one, so it
//   cannot inflate SHADOWED_CEILING.
//
//   RATCHET, never an allowlist populated from the failure output (the
//   house rule stated verbatim in app/src/phone-tap-target.scan.test.ts:
//   30-32): SHADOWED_CEILING is a single exported const, seeded at the
//   count actually measured on this branch. It is a CEILING, the mirror
//   of the ledger's FLOOR (test/phone-frame-ledger.scan.test.ts) -- it may
//   only SHRINK as shadowed declarations get fixed (moved after the
//   desktop rule they collide with, or the desktop rule folded away), and
//   must never be RAISED to paper over a new regression introduced on some
//   other lane. Bumping it down is a plain edit any lane may make once it
//   fixes a shadow; bumping it up is the one thing this file must never
//   do.
//
//   FALSIFIABILITY CONTROL: content.css and comms.css -- the two files
//   with a real, already-fixed shadow and a bespoke pin proving the fix
//   holds -- must read exactly 0 shadowed pairs each. If either reads
//   nonzero, the parser itself has regressed (it would mean the existing
//   fix stopped working, or the scan is misreading the file); if the
//   scan's zero-count logic is broken, running it against a KNOWN-CLEAN
//   file would not go green by accident the way a hand-picked assertion
//   could.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/
const REPO_ROOT = join(HERE, '..', '..');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const ROUTES_ROOT = join(REPO_ROOT, 'src', 'routes');

// -- Population: every *.css under app/src, every *.css.ts under src/routes,
// enumerated via readdirSync rather than named (DEC-808). ------------------

function enumerateFiles(root: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(suffix)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CSS_FILES = enumerateFiles(APP_SRC_ROOT, '.css').filter((f) => !f.endsWith('.css.ts'));
const CSS_TS_FILES = enumerateFiles(ROUTES_ROOT, '.css.ts');
const ALL_FILES = [...CSS_FILES, ...CSS_TS_FILES];

// -- Brace-matching parser ---------------------------------------------------

interface BlockNode {
  header: string;
  depth: number;
  parent: BlockNode | null;
  openIdx: number;
  closeIdx: number;
  bodyStart: number;
  bodyEnd: number;
  startLine: number;
  closeLine: number;
}

/** Blanks out /* ... *\/ comments in place (keeps newlines, so line numbers
 * of everything after a comment are unaffected). */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function indexToLine(lineStarts: number[], idx: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Walks the (comment-stripped) text and returns every `{...}` block as a
 * BlockNode, brace-matched top to bottom. Throws on unbalanced braces --
 * a malformed CSS file should fail loudly, not be silently skipped. */
function parseBlocks(text: string): BlockNode[] {
  const clean = stripComments(text);
  const lineStarts = buildLineStarts(clean);
  const nodes: BlockNode[] = [];
  const stack: BlockNode[] = [];
  let bufStart = 0;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      const header = clean.slice(bufStart, i);
      const node: BlockNode = {
        header,
        depth: stack.length,
        parent: stack.length ? stack[stack.length - 1]! : null,
        openIdx: i,
        closeIdx: -1,
        bodyStart: i + 1,
        bodyEnd: -1,
        startLine: indexToLine(lineStarts, i),
        closeLine: -1,
      };
      nodes.push(node);
      stack.push(node);
      bufStart = i + 1;
    } else if (c === '}') {
      const node = stack.pop();
      if (!node) throw new Error('unbalanced braces (unmatched "}")');
      node.closeIdx = i;
      node.bodyEnd = i;
      node.closeLine = indexToLine(lineStarts, i);
      bufStart = i + 1;
    }
  }
  if (stack.length) throw new Error('unbalanced braces at EOF (unmatched "{")');
  return nodes;
}

function normalizeSelector(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Excludes at-rule preludes, blank headers, and template-literal
 * interpolation artefacts (`${...}` contributes a balanced-but-spurious
 * brace pair in `*.css.ts` files -- see file header). */
function isSelectorHeader(header: string): boolean {
  const t = header.trim();
  if (!t) return false;
  if (t.includes('$') || t.includes('`')) return false;
  if (t.startsWith('@')) return false;
  return true;
}

function isMediaMaxWidth(header: string): boolean {
  return /@media\s*\(\s*max-width\s*:/.test(header);
}

/** Declarations are separated by `;` at the block's own nesting level; this
 * is only ever called on a leaf-ish rule body (no further real nested
 * rules exist in these plain-CSS files), so a naive split is safe. */
function declaredProperties(bodyText: string): Set<string> {
  const props = new Set<string>();
  for (const part of bodyText.split(';')) {
    const t = part.trim();
    if (!t) continue;
    const idx = t.indexOf(':');
    if (idx === -1) continue;
    const prop = t.slice(0, idx).trim();
    if (prop) props.add(prop);
  }
  return props;
}

export interface ShadowFinding {
  file: string; // repo-relative
  selector: string;
  property: string;
  phoneLine: number;
  shadowLine: number;
}

function scanFile(absPath: string): ShadowFinding[] {
  const relFile = relative(REPO_ROOT, absPath);
  const text = readFileSync(absPath, 'utf-8');
  const nodes = parseBlocks(text);
  const findings: ShadowFinding[] = [];

  const mediaBlocks = nodes.filter((n) => n.depth === 0 && isMediaMaxWidth(n.header));

  for (const media of mediaBlocks) {
    const phoneRules = nodes.filter(
      (n) => n.parent === media && n.depth === 1 && isSelectorHeader(n.header)
    );
    const topLevelAfter = nodes.filter(
      (n) =>
        n.depth === 0 &&
        n.parent === null &&
        n.startLine > media.closeLine &&
        isSelectorHeader(n.header)
    );

    for (const rule of phoneRules) {
      const sel = normalizeSelector(rule.header);
      const props = declaredProperties(text.slice(rule.bodyStart, rule.bodyEnd));
      for (const top of topLevelAfter) {
        if (normalizeSelector(top.header) !== sel) continue;
        const topProps = declaredProperties(text.slice(top.bodyStart, top.bodyEnd));
        for (const p of props) {
          if (topProps.has(p)) {
            findings.push({
              file: relFile,
              selector: sel,
              property: p,
              phoneLine: rule.startLine,
              shadowLine: top.startLine,
            });
          }
        }
      }
    }
  }
  return findings;
}

const ALL_FINDINGS: ShadowFinding[] = ALL_FILES.flatMap((f) => scanFile(f));

// -- Ratchet -----------------------------------------------------------------
// Measured on this branch (v12m-w3-j): 20 shadowed (selector, property)
// pairs across the enumerated tree. A CEILING, the mirror of the ledger's
// floor: it may only SHRINK as shadows get fixed, and raising it to paper
// over a new regression is the one edit this file must never accept.
export const SHADOWED_CEILING = 20;

describe('cascade-shadow sweep -- phone overrides dead against a later desktop rule (DEC-385 amendment wave 85)', () => {
  it('enumerates a non-empty population of stylesheets (vacuous-population guard)', () => {
    expect(CSS_FILES.length).toBeGreaterThan(0);
    expect(CSS_TS_FILES.length).toBeGreaterThan(0);
  });

  it('content.css and comms.css read exactly 0 shadowed pairs (falsifiability control)', () => {
    const contentFindings = ALL_FINDINGS.filter((f) => f.file.endsWith('/content/content.css'));
    const commsFindings = ALL_FINDINGS.filter((f) => f.file.endsWith('/comms/comms.css'));
    expect(contentFindings).toEqual([]);
    expect(commsFindings).toEqual([]);
  });

  it(`never exceeds SHADOWED_CEILING (${SHADOWED_CEILING}) shadowed (selector, property) pairs`, () => {
    if (ALL_FINDINGS.length > SHADOWED_CEILING) {
      const lines = ALL_FINDINGS.map(
        (f) => `${f.file} · ${f.selector} · ${f.property} · shadowed by the top-level rule at line ${f.shadowLine}`
      );
      throw new Error(
        `found ${ALL_FINDINGS.length} shadowed (selector, property) pairs, above SHADOWED_CEILING ` +
          `(${SHADOWED_CEILING}). The ceiling may only SHRINK (fix the shadow: move the phone ` +
          `declaration after the desktop rule it collides with, in the file's single trailing ` +
          `@media block) -- never raise it to cover a new regression:\n${lines.join('\n')}`
      );
    }
    expect(ALL_FINDINGS.length).toBeLessThanOrEqual(SHADOWED_CEILING);
  });
});
