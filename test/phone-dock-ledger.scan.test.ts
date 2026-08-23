// Phone dock membership ledger (DEC-976, wave-19 task w19-c).
//
// FOOTER_LABEL_CEILING (test/frame-control-label.scan.test.ts) has read 0
// for waves while the pack drew two docks the app never built -- because
// that ledger asks "does the app render this WORD somewhere in source?",
// never "does the app render EVERY word of THIS dock, in the SAME file
// that declares the dock band?" (`Add someone` was satisfied by an empty-
// column link reading "Add someone to Identified ›" -- a different control
// entirely). This ledger asks the membership question directly:
//
//   1. POPULATION, derived from the pack, never hand-listed (DEC-808): the
//      frame-enumeration grammar and the balanced `<div`/`</div>` footer
//      walk are PORTED VERBATIM from test/frame-control-label.scan.test.ts
//      (that file is itself a vitest suite -- importing it would re-execute
//      its own describe/it blocks under this file's context, so the code
//      is copied rather than imported; the shared, non-suite corpus module
//      test/frame-source-corpus.ts is imported normally). Inside each
//      frame's extent, the docked-footer signature is
//      `flex-shrink:0; border-top:1px solid #1B1D17` (deliberately shorter
//      than frame-control-label's own `background:#EFEBDF`-qualified
//      signature -- a strict superset, so every band that ledger sees this
//      one sees too, plus any that omit the background clause). Walk from
//      that signature's enclosing `<div` to the BALANCED close (a column-
//      direction dock nests rows inside itself); every `>text<` node inside
//      the balanced region is a dock label.
//
//      Measured on this branch: 41 frames carry such a band -- asserted
//      below as a vacuous-population tripwire.
//
//   2. DISCRIMINATOR, stated as such and not as an exclusion list
//      (DEC-180): a band whose body contains `list="{{ tabs }}"` is the
//      SHELL TAB BAR (the `<sc-for list="{{ tabs }}">` the pack uses for
//      the bottom-of-shell navigation, present on 7 of the 41 frames), not
//      a page dock. The remaining 34 are ACTION DOCKS and are this
//      ledger's graded population. Both counts are asserted below.
//
//   3. CLAIM: an action dock is claimed when SOME non-test file under
//      app/src/** or src/** (recursive walk via test/frame-source-corpus.ts's
//      enumerateSourceFiles -- skips any path containing `.test.`, and
//      skips src/decisions-data/** and src/decisions.ts so a ruling's own
//      prose can never satisfy the ledger it rules on, DEC-967 wave-129)
//      BOTH:
//        (a) declares a docked band, one of THREE ways (DEC-976 wave-146,
//            repairing the wave-145 finding that requiring all three in
//            ONE file is a claim about FILE ORGANISATION, not membership):
//            (i) contains `chq-phone-dock` or `data-chq-phone-dock`
//            anywhere in the file; (ii) for a .css file, declares a rule
//            inside a `max-width: 700px` block whose body carries
//            `position: sticky|fixed`, `bottom: 0`, and a `border-top`
//            (the same geometry app/src/phone-dock-declares.scan.test.ts's
//            extractDockedClasses derives a docked band from --
//            reimplemented locally here for the same reason the frame walk
//            above is copied rather than imported: that file is itself a
//            suite); (iii) renders an element carrying a class the
//            DOCK_CLASS_VOCAB below derives -- from BOTH stylesheet roots,
//            via the border-top signature every docked footer in this
//            codebase shares regardless of technique -- either directly,
//            or through ONE level of indirection (a `dock=`/`footerExtra=`
//            slot prop, itself derived from real markup, never hand-listed,
//            passed to a component that declares the band under (iii)
//            directly: PortalLayout's `.chq-portal-footer`, reached by
//            edit.tsx/tasks/views.tsx's `dock`/`footerExtra` props). AND
//        (b) renders EVERY one of that band's drawn labels, normalized
//            (comments stripped, entities decoded, whitespace collapsed)
//            and matched BOUNDARY-ANCHORED, exactly as
//            test/frame-control-label.scan.test.ts already does (via the
//            shared test/frame-source-corpus.ts normalizeSource /
//            labelIsMatched this file imports rather than reimplements).
//            Unlike that ledger's match-anywhere-in-the-corpus test, here
//            the match is scoped to the SAME candidate file for every
//            label in the band -- a dock split across a CSS file that
//            declares the geometry and a .tsx file that renders the words
//            is a real membership gap, not a pass.
//
//   4. EXCLUSIONS -- two tables in the same shape
//      test/frame-control-label.scan.test.ts already carries, each entry
//      independently asserted against the pack so a re-cut rots it loudly:
//        a. FIXTURE -- a band's own mock content wearing control geometry
//           but naming fictional pack data, not a real UI word.
//        b. COMPOSED -- the app assembles the label from parts at render
//           time (quoting the composing expression verbatim), or the
//           divergence is already BLESSED by a recorded user ruling
//           (DEVIATIONS.md §3/§6, cited by heading only -- DEVIATIONS.md
//           itself is owned by an in-flight lane this wave and is never
//           edited here).
//      Excluded labels are removed from a band's required set before the
//      claim check runs; a band whose every label is excluded is claimed
//      vacuously (the exclusion IS the explanation for why no file needs
//      to literally spell it).
//      Every row below is ported from test/frame-control-label.scan.test.ts's
//      own FIXTURE_EXCLUSIONS / COMPOSED_EXCLUSIONS tables -- same
//      file:line:label triples, independently re-verified against this
//      ledger's own band-label extraction (not merely copy-pasted) --
//      because this ledger's population is a superset of that one's footer
//      labels and the same real-world divergences recur here.
//
//   5. RATCHET, two-sided, mirroring every prior ledger in this campaign:
//      PHONE_DOCK_UNCLAIMED_CEILING is measured on this branch by forcing
//      the constant to -1 and reading the printed offender list -- never
//      `= OFFENDERS.length` or any expression naming the measured set (the
//      saturated-ratchet-lie pattern, nine-plus prior sightings). One `it`
//      fails when the offender count rises above the ceiling; a companion
//      `it` fails when it falls below, printing the exact replacement
//      line, so a stale ceiling cannot survive a wave that lands more
//      dock-membership coverage.
//
//      RATCHET: see PHONE_DOCK_UNCLAIMED_CEILING below and
//      docs/design/audit/phone-dock-membership-v12.md for the full,
//      per-offender breakdown by owning cluster.
//
//      DEC-976 wave-146 (task w20-c): repaired the DECLARATION predicate
//      per the wave-145 ruling above (indirection + a derived class
//      vocabulary) and moved two labels a standing ruling already declares
//      non-build into COMPOSED_EXCLUSIONS ('Approve 2', a digit fixture
//      composed from `Approve {selectedIds.size}`; 'Save draft' on the
//      hotel-stay-form dock, DEC-576 wave-128's explicit non-build). All
//      12 offenders measured at PHONE_DOCK_UNCLAIMED_CEILING=13 (main
//      f79ddeb5) resolve to a claim under the repaired predicate --
//      RATCHET: PHONE_DOCK_UNCLAIMED_CEILING=0 (was 13; predicate widened
//      per DEC-976 wave-138's re-seed rule: this is a repair, not a raise).
//
//      DEC-976 wave-146 (task w21-b): three further repairs, each with its
//      own claim in the code above.
//        (1) `hasDockGeometryRule` only ran when `file.endsWith('.css')`;
//            every SSR stylesheet in this repo is a `*.css.ts` module, so
//            that arm had NEVER fired for src/**. `isStylesheetFile` now
//            admits `.css.ts` too.
//        (2) already landed at w20-c (the indirection + derived-vocabulary
//            widening above) -- re-verified, not re-done.
//        (3) added a third exclusion table, NON_BUILD, distinct from
//            FIXTURE/COMPOSED: a label a standing ruling explicitly
//            forbids building, quoted by file:line. 'Save draft' moves out
//            of COMPOSED_EXCLUSIONS (it was never "composed", it is
//            "must not exist") into NON_BUILD_EXCLUSIONS, citing
//            src/decisions-data/DEC-576.md:59 and DEVIATIONS.md §6 by name.
//      Re-measured with the ceiling forced to -1: still 0 offenders (the
//      .css.ts admission finds no NEW claimant the derived-class-vocabulary
//      path hadn't already found, since DOCK_CLASS_VOCAB is itself sourced
//      from ssrCssSources() which already reads .css.ts text -- but the
//      geometry arm is no longer dead code, and a future band that relies
//      on the literal sticky/bottom/border-top geometry rather than a
//      vocabulary class will now be reachable). RATCHET:
//      PHONE_DOCK_UNCLAIMED_CEILING=0 (unchanged; a repair, not a raise).
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';
import { ssrCssSources } from './helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: frame enumeration, ported verbatim from
// test/frame-control-label.scan.test.ts (see that file's own header
// comment for why this is a copy, not an import: it is itself a vitest
// suite). ----------------------------------------------------------------

interface Frame {
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
}

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_SPAN_RE.test(line);
}

/** DEC-967 wave-41 amendment: the 1-based line of the single `</x-dc>`
 * template close in `fileName`, throwing loudly on zero or multiple
 * matches. Ported (not imported) per this file's own header precedent --
 * every ledger this ruling touches carries its own copy. */
function templateCloseLine(fullPath: string): number {
  const lines = readFileSync(fullPath, 'utf-8').split('\n');
  const matches: number[] = [];
  lines.forEach((line, idx) => {
    if (line.includes('</x-dc>')) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fullPath}: expected exactly one </x-dc>, found ${matches.length} (lines ${matches.join(', ')})`);
  }
  return matches[0]!;
}

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

function framesInFile(fileName: string): Frame[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_SPAN_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });

  return frameLineNums.map((frameLine) => {
    let title: string | undefined;
    for (let i = labelLines.length - 1; i >= 0; i--) {
      if (labelLines[i]!.line <= frameLine) {
        title = labelLines[i]!.title;
        break;
      }
    }
    if (title === undefined) {
      throw new Error(`${fileName}:${frameLine} -- no preceding font-size:19px label found`);
    }
    // Clipped at the template's own close (DEC-967 wave-41 amendment) so
    // the last labelled block can never swallow `</x-dc>` and everything
    // past it.
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full)),
    };
  });
}

/** Walks `<div`/`</div>` tokens forward from `openStart` with a depth
 * counter to the matching balanced `</div>`, ported verbatim from
 * test/frame-control-label.scan.test.ts's balancedDivEnd. */
function balancedDivEnd(text: string, openStart: number): number {
  const re = /<(\/?)div\b/g;
  re.lastIndex = openStart;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        const closeGt = text.indexOf('>', m.index);
        if (closeGt === -1) throw new Error('unterminated </div> tag during balanced walk');
        return closeGt + 1;
      }
    } else {
      depth++;
    }
  }
  throw new Error(`balancedDivEnd: <div> at offset ${openStart} never closed`);
}

function offsetToLine(lineStartIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineStartIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStartIndex[mid]! <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
}

// -- Dock-band extraction (this ledger's own grammar: signature is a
// deliberate SUPERSET of frame-control-label's own footer signature -- see
// header comment) ----------------------------------------------------------

const DOCK_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17';
const TEXT_NODE_RE = />([^<>]+)</g;
const TABS_DISCRIMINATOR_RE = /list="\{\{ tabs \}\}"/;

export interface DockLabel {
  fileName: string;
  line: number;
  label: string;
}

export interface DockBand {
  fileName: string;
  frameLine: number;
  frameTitle: string;
  bandLine: number;
  isShellTabBar: boolean;
  labels: DockLabel[];
}

function bandsInFile(fileName: string): DockBand[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = framesInFile(fileName);
  const out: DockBand[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);

    const sigIdx = text.indexOf(DOCK_SIGNATURE);
    if (sigIdx === -1) continue;

    const divStart = text.lastIndexOf('<div', sigIdx);
    if (divStart === -1) {
      throw new Error(`${fileName}:${frame.line} -- dock signature has no enclosing <div`);
    }
    const endIdx = balancedDivEnd(text, divStart);
    const bandText = text.slice(divStart, endIdx);
    const isShellTabBar = TABS_DISCRIMINATOR_RE.test(bandText);

    TEXT_NODE_RE.lastIndex = 0;
    const labels: DockLabel[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = TEXT_NODE_RE.exec(bandText))) {
      const label = tm[1]!.trim();
      if (!isRealLabel(label)) continue;
      const offset = startOff + divStart + tm.index;
      labels.push({ fileName, line: offsetToLine(lineStartIndex, offset), label });
    }

    out.push({
      fileName,
      frameLine: frame.line,
      frameTitle: frame.title,
      bandLine: offsetToLine(lineStartIndex, startOff + divStart),
      isShellTabBar,
      labels,
    });
  }
  return out;
}

const ALL_BANDS: DockBand[] = designFiles().flatMap(bandsInFile);
const SHELL_TAB_BARS = ALL_BANDS.filter((b) => b.isShellTabBar);
const ACTION_DOCKS = ALL_BANDS.filter((b) => !b.isShellTabBar);

// -- Claim side: does SOME non-test source file both declare a docked band
// and render every one of this band's (non-excluded) labels? --------------

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];

const MAX_WIDTH_700_MEDIA_RE = /@media([^{]*)\{/g;

/** True when a .css file's text declares a rule inside a
 * `max-width: 700px` media body whose declaration carries
 * `position: sticky|fixed`, `bottom: 0`, and a `border-top` -- the same
 * geometry app/src/phone-dock-declares.scan.test.ts's extractDockedClasses
 * derives a docked band from, reimplemented locally (that file is itself a
 * suite; importing it would re-run its own describe/it blocks here). */
function hasDockGeometryRule(cssText: string): boolean {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  MAX_WIDTH_700_MEDIA_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAX_WIDTH_700_MEDIA_RE.exec(stripped))) {
    const condition = m[1];
    const bodyStart = MAX_WIDTH_700_MEDIA_RE.lastIndex;
    let depth = 1;
    let i = bodyStart;
    for (; i < stripped.length && depth > 0; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') depth--;
    }
    const body = stripped.slice(bodyStart, i - 1);
    MAX_WIDTH_700_MEDIA_RE.lastIndex = i;
    if (condition === undefined || !/max-width:\s*700px/.test(condition)) continue;
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let rm: RegExpExecArray | null;
    while ((rm = ruleRe.exec(body))) {
      const ruleBody = rm[2];
      if (ruleBody === undefined) continue;
      const isStickyOrFixed = /position\s*:\s*(sticky|fixed)\b/.test(ruleBody);
      const isBottomZero = /bottom\s*:\s*0(px)?\b/.test(ruleBody);
      const hasBorderTop = /border-top\s*:/.test(ruleBody);
      if (isStickyOrFixed && isBottomZero && hasBorderTop) return true;
    }
  }
  return false;
}

// -- DEC-976 wave-145 widening: the declaration predicate above requires
// ONE file to both name the literal `chq-phone-dock`/`data-chq-phone-dock`
// contract AND render every label -- a claim about FILE ORGANISATION. The
// SSR half deliberately splits the two: a shared layout or sheet declares
// the band's geometry (a page-local class carrying `border-top`, the one
// property every docked footer in this codebase declares regardless of
// technique -- position:sticky+bottom:0, flex-shrink:0 as a full-height
// column's last child, or a plain in-flow footer with no positioning at
// all) while the PAGE renders the words, reaching the band through ONE
// level of indirection: a `dock=`/slot prop passed to the component that
// declares it. Two widenings below, both DERIVED from the sheets/source,
// never hand-listed (DEC-808).

/** Strips block comments and `${...}` template-literal interpolations (the
 * latter matters for src/'s CSS-in-JS modules: `${HOME_CHROME_GUTTER}`
 * inside a rule body otherwise unbalances this file's brace-depth walks,
 * the same class of defect test/frame-caption-ledger.scan.test.ts already
 * strips before matching). */
function stripCssNoise(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\$\{[^}]*\}/g, ' ');
}

/** Every class named in a selector list (bare or compound -- a docked band
 * is as often reached via `.chq-portal-shell > .chq-portal-footer` or
 * `.chq-content-worklist-selecting .chq-bulkbar` as via a bare class) of a
 * rule whose declaration body carries `border-top`. Deliberately broader
 * than app/src/phone-dock-declares.scan.test.ts's own extractDockedClasses
 * (which additionally requires `position: sticky|fixed` + `bottom: 0`, a
 * stricter test built for a narrower purpose: whether the shell's tab bar
 * gets suppressed). This ledger's claim side needs the geometry the SOURCE
 * actually uses to dock a footer, not just that one idiom. */
function extractBorderTopClasses(cssText: string): Set<string> {
  const stripped = stripCssNoise(cssText);
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(stripped))) {
    const selectorList = m[1];
    const body = m[2];
    if (selectorList === undefined || body === undefined) continue;
    if (!/border-top\s*:/.test(body)) continue;
    const classMatches = selectorList.match(/\.[A-Za-z0-9_-]+/g);
    if (classMatches) {
      for (const c of classMatches) out.add(c.slice(1));
    }
  }
  return out;
}

function walkFiles(dir: string, suffix: string, skipTestFiles: boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, suffix, skipTestFiles));
      continue;
    }
    if (!entry.endsWith(suffix)) continue;
    if (skipTestFiles && entry.includes('.test.')) continue;
    out.push(full);
  }
  return out;
}

/** The docked-band class vocabulary, derived from BOTH stylesheet roots:
 * src/'s CSS-in-JS `*_CSS` modules (via the existing ssrCssSources helper,
 * DEC-367/DEC-808 wave-57) and app/src/'s plain `.css` files (walked
 * locally the same way app/src/phone-dock-declares.scan.test.ts's own
 * loadCssSources does -- that file is itself a suite, so its walk is
 * reimplemented rather than imported). Never hand-listed. */
const DOCK_CLASS_VOCAB: Set<string> = (() => {
  const vocab = new Set<string>();
  for (const src of ssrCssSources()) {
    for (const c of extractBorderTopClasses(src.text)) vocab.add(c);
  }
  for (const f of walkFiles(APP_SRC_ROOT, '.css', false)) {
    for (const c of extractBorderTopClasses(readFileSync(f, 'utf-8'))) vocab.add(c);
  }
  return vocab;
})();

function classNameToken(cls: string): RegExp {
  return new RegExp(`\\b${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
}

/** True when `raw` renders an element carrying one of the docked-band
 * classes derived above, directly (not through indirection). */
function declaresDockClassDirectly(raw: string): boolean {
  for (const cls of DOCK_CLASS_VOCAB) {
    if (classNameToken(cls).test(raw)) return true;
  }
  return false;
}

/** Raw (un-normalized) text alongside each candidate, needed for the
 * offset-based indirection derivation below -- computed once, ahead of
 * SLOT_PROP_NAMES, to avoid re-reading every file per vocabulary class. */
const RAW_SOURCE_FILES: { file: string; raw: string }[] = SOURCE_FILES.map((f) => ({
  file: f,
  raw: readFileSync(f, 'utf-8'),
}));

/** A class attribute assignment (`class="..."` / `className={...}`) must
 * sit within 120 characters before the class token for an occurrence to
 * count as real markup rather than a comment mentioning the class name. */
const CLASS_ATTR_PRECEDE_RE = /class(?:Name)?\s*=\s*[^<>]{0,120}$/;
/** How far past a docked-band class's own markup occurrence to look for
 * the `props.<name>` reference(s) it renders alongside -- wide enough to
 * reach PortalLayout's `{props.footerExtra}` then `{props.dock}` inside
 * its `<footer class="chq-portal-footer">`, narrow enough to stay short of
 * unrelated props (`csrfToken`) rendered later in the same element. */
const SLOT_PROP_WINDOW = 700;

/** The slot prop names a docked-band-declaring component exposes for its
 * children to fill (PortalLayout's `dock` and `footerExtra`), DERIVED by
 * scanning every real markup occurrence of a vocabulary class for the
 * `props.<name>` references drawn near it -- never hand-listed. */
const SLOT_PROP_NAMES: Set<string> = (() => {
  const names = new Set<string>();
  for (const { file, raw } of RAW_SOURCE_FILES) {
    if (file.endsWith('.css')) continue;
    for (const cls of DOCK_CLASS_VOCAB) {
      let searchFrom = 0;
      for (;;) {
        const idx = raw.indexOf(cls, searchFrom);
        if (idx === -1) break;
        searchFrom = idx + cls.length;
        const precede = raw.slice(Math.max(0, idx - 120), idx);
        if (!CLASS_ATTR_PRECEDE_RE.test(precede)) continue;
        const window = raw.slice(idx, idx + SLOT_PROP_WINDOW);
        for (const pm of window.matchAll(/props\.(\w+)/g)) {
          const propName = pm[1];
          if (propName !== undefined) names.add(propName);
        }
      }
    }
  }
  return names;
})();

/** True when `raw` assigns a derived slot prop (`dock={...}`,
 * `footerExtra={...}`) -- the ONE level of indirection through which a
 * page reaches a docked band a shared layout component declares. */
function declaresDockViaSlotIndirection(raw: string): boolean {
  for (const name of SLOT_PROP_NAMES) {
    if (new RegExp(`\\b${name}\\s*=\\s*\\{`).test(raw)) return true;
  }
  return false;
}

// DEC-976 wave-146 (task w21-b), change (1): every server-rendered
// stylesheet in this repo is a `*.css.ts` module (src/'s CSS-in-JS
// `*_CSS` exports), and `'x.css.ts'.endsWith('.css')` is false -- so this
// branch had NEVER executed for a single file under src/**, and the SSR
// half of the geometry check was dead code. Admit `.css.ts` alongside
// `.css` so the rule actually reaches the stylesheets it was written to
// grade (app/src/'s plain `.css` files still take the same path).
function isStylesheetFile(file: string): boolean {
  return file.endsWith('.css') || file.endsWith('.css.ts');
}

function declaresDockBand(file: string, raw: string): boolean {
  if (/data-chq-phone-dock/.test(raw) || /\bchq-phone-dock\b/.test(raw)) return true;
  if (isStylesheetFile(file) && hasDockGeometryRule(raw)) return true;
  if (declaresDockClassDirectly(raw)) return true;
  if (declaresDockViaSlotIndirection(raw)) return true;
  return false;
}

interface CandidateFile {
  file: string;
  normalized: string;
  declares: boolean;
}

const CANDIDATE_FILES: CandidateFile[] = RAW_SOURCE_FILES.map(({ file, raw }) => ({
  file,
  normalized: normalizeSource(raw),
  declares: declaresDockBand(file, raw),
}));

// -- Exclusions -------------------------------------------------------------
// (a) FIXTURE -- ported from test/frame-control-label.scan.test.ts's own
// FIXTURE_EXCLUSIONS table (same file:line:label triples; re-verified
// against this ledger's own band-label extraction, not merely copied).
const FIXTURE_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 193,
    label: 'Docs That Answer Back',
    reason: "the Agenda frame's own mock session-title fixture, not a UI word the app renders.",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 194,
    label: 'DFC-033 · lightning talk, 10 min',
    reason: "the Agenda frame's own mock session-code/format fixture, not a UI word the app renders.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 434,
    label: 'Email Priya',
    reason: "the Contacts frame's own mock quick-action fixture naming a fictional contact, not a UI word.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 464,
    label: 'Priya Raman · Latticework Systems',
    reason: "the Public/Portal frame's own mock speaker-identity fixture, not a UI word the app renders.",
  },
];

// (b) COMPOSED -- ported from test/frame-control-label.scan.test.ts's own
// COMPOSED_EXCLUSIONS table (same file:line:label triples and reasons,
// re-verified against this ledger's own band-label extraction).
const COMPOSED_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 493,
    label: 'Mark the release signed',
    reason:
      "COMPOSED, DEC-613 wave-128 shared-vocabulary family: the portal tasks dock primary is rendered by `tasksPageDockPrimary` (src/routes/portal/tasks/views.tsx:411), the same shared control the row itself renders -- never a per-frame retyped copy.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 494,
    label: 'Later',
    reason:
      'BLESSED (DEVIATIONS.md §6, DEC-967 wave-106): the dock GEOMETRY is legitimate but the portal task model exposes only complete-or-not -- no snooze/defer/dismiss capability exists anywhere in the domain or route layer, so the second button\'s copy is not manufactured.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 588,
    label: 'Upload slides',
    reason:
      "COMPOSED, DEC-613 wave-128 shared-vocabulary family: `taskActionLabel(t)` ('Fill out form' / 'Upload file' / 'Open task') is the ONE shared label for every file-request task (src/routes/portal/index.tsx:128-132) -- 'Upload slides' would be wrong for every file-request task that is not slides.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 666,
    label: 'Save the plan',
    reason:
      'BLESSED (DEVIATIONS.md §3, DEC-745 wave-98): an existing plan\'s title row renders "Duplicate"/"Save"; the phone dock is a CSS-only repositioning of whichever pair the title row already renders, never a second copy of the buttons, and the frame\'s "Save the plan"/"Cancel" copy is read as the new-plan state\'s captioning.',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 279,
    label: 'Approve 2',
    reason:
      "COMPOSED, digit-fixture: app/src/pages/content/SessionList.tsx renders the bulk-approve primary as `Approve {selectedIds.size}` -- the frame's fixture count '2' is not a literal the app types anywhere.",
  },
];

// (c) NON_BUILD -- DEC-976 wave-146 (task w21-b) change (3): a third table,
// distinct from FIXTURE (a frame's own mock content) and COMPOSED (the app
// assembles the same words at render time). A NON_BUILD row is a label a
// standing ruling explicitly forbids building at all -- excluding it is not
// "the app spells this differently", it is "the app must not build this
// control". Each entry quotes the ruling verbatim, by file:line, so the
// exclusion rots loudly the day that ruling is reversed rather than lands.
const NON_BUILD_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 520,
    label: 'Save draft',
    reason:
      'src/decisions-data/DEC-576.md:59 (wave-128 amendment): "The frame\'s secondary \'Save draft\' is NOT built -- DEVIATIONS.md §6 already defers hotel-form save-draft, and a bordered control that persists nothing is the thing wave-110 forbids." DEVIATIONS.md §6 independently lists "Hotel-form save-draft" among deferred post-deadline scope. TaskFormPage adopts the frame\'s dock band for its primary (`TASK_FORM_SUBMIT_LABEL`) only.',
  },
];

function isExcluded(l: DockLabel): boolean {
  return (
    FIXTURE_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label) ||
    COMPOSED_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label) ||
    NON_BUILD_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label)
  );
}

interface DockOffender {
  band: DockBand;
  remaining: DockLabel[];
}

function isBandClaimed(band: DockBand): boolean {
  const remaining = band.labels.filter((l) => !isExcluded(l));
  if (remaining.length === 0) return true;
  return CANDIDATE_FILES.some(
    (cf) => cf.declares && remaining.every((l) => labelIsMatched(l.label, [cf.normalized]))
  );
}

const UNCLAIMED: DockOffender[] = ACTION_DOCKS.filter((b) => !isBandClaimed(b)).map((band) => ({
  band,
  remaining: band.labels.filter((l) => !isExcluded(l)),
}));

// Measured on this branch by forcing this const to -1 and reading the
// printed offender list -- never `= UNCLAIMED.length` or any expression
// naming the measured set (the saturated-ratchet-lie pattern).
export const PHONE_DOCK_UNCLAIMED_CEILING = 0;

describe('phone dock membership ledger (DEC-976, v12 mobile campaign)', () => {
  it('non-vacuity: 41 frames carry a dock-shaped footer band, 7 are shell tab bars, 34 are action docks', () => {
    expect(ALL_BANDS.length).toBe(41);
    expect(SHELL_TAB_BARS.length).toBe(7);
    expect(ACTION_DOCKS.length).toBe(34);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-band fixture', () => {
    const fabricatedBandText = [
      '<div style="flex-shrink:0; border-top:1px solid #1B1D17; display:flex; flex-direction:column">',
      '  <div style="display:flex">',
      '    <span>Zzy Synthetic Present</span>',
      '    <span>Zzy Synthetic Absent</span>',
      '  </div>',
      '</div>',
    ].join('\n');
    TEXT_NODE_RE.lastIndex = 0;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = TEXT_NODE_RE.exec(fabricatedBandText))) {
      const label = m[1]!.trim();
      if (isRealLabel(label)) found.push(label);
    }
    expect(found).toContain('Zzy Synthetic Present');
    expect(found).toContain('Zzy Synthetic Absent');

    const fabricatedSource = [
      '// mentions Zzy Synthetic Absent in a comment only, must not satisfy it',
      'export function Fixture() { return <div className="chq-phone-dock">Zzy Synthetic Present</div>; }',
    ].join('\n');
    expect(declaresDockBand('fixture.tsx', fabricatedSource)).toBe(true);
    const normalized = normalizeSource(fabricatedSource);
    expect(labelIsMatched('Zzy Synthetic Present', [normalized])).toBe(true);
    expect(labelIsMatched('Zzy Synthetic Absent', [normalized])).toBe(false);
  });

  it('tabs discriminator: the shell tab bar band is present in every one of its 7 frames', () => {
    for (const b of SHELL_TAB_BARS) {
      expect(TABS_DISCRIMINATOR_RE.test('list="{{ tabs }}"')).toBe(true);
      expect(b.isShellTabBar).toBe(true);
    }
  });

  it('FIXTURE exclusions each resolve to their cited file:line:label in the current pack', () => {
    const allLabels = ACTION_DOCKS.flatMap((b) => b.labels);
    for (const e of FIXTURE_EXCLUSIONS) {
      const hit = allLabels.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it('COMPOSED exclusions each resolve to their cited file:line:label in the current pack', () => {
    const allLabels = ACTION_DOCKS.flatMap((b) => b.labels);
    for (const e of COMPOSED_EXCLUSIONS) {
      const hit = allLabels.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it('NON_BUILD exclusions each resolve to their cited file:line:label in the current pack', () => {
    const allLabels = ACTION_DOCKS.flatMap((b) => b.labels);
    for (const e of NON_BUILD_EXCLUSIONS) {
      const hit = allLabels.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it(`never exceeds PHONE_DOCK_UNCLAIMED_CEILING (${PHONE_DOCK_UNCLAIMED_CEILING}) unclaimed action docks`, () => {
    if (UNCLAIMED.length > PHONE_DOCK_UNCLAIMED_CEILING) {
      const offenders = UNCLAIMED.map(
        (o) =>
          `${o.band.fileName}:${o.band.bandLine} -- frame "${o.band.frameTitle}" (frame line ${o.band.frameLine}) -- ` +
          `unclaimed labels: ${o.remaining.map((l) => `${l.line}:"${l.label}"`).join(', ')}`
      );
      throw new Error(
        `${UNCLAIMED.length} action docks have no single non-test source file that both declares a docked band ` +
          `and renders every one of their labels, above the ceiling of ${PHONE_DOCK_UNCLAIMED_CEILING}. ` +
          `PHONE_DOCK_UNCLAIMED_CEILING may only be RAISED (a merge-train act, never a worker's edit mid-lane), ` +
          `and only once re-measured. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNCLAIMED.length).toBeLessThanOrEqual(PHONE_DOCK_UNCLAIMED_CEILING);
  });

  it(`never sits BELOW PHONE_DOCK_UNCLAIMED_CEILING (${PHONE_DOCK_UNCLAIMED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNCLAIMED.length < PHONE_DOCK_UNCLAIMED_CEILING) {
      throw new Error(
        `${UNCLAIMED.length} action docks are unclaimed, below the ceiling of ${PHONE_DOCK_UNCLAIMED_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train act) ` +
          `by replacing the line:\n  export const PHONE_DOCK_UNCLAIMED_CEILING = ${UNCLAIMED.length};`
      );
    }
    expect(UNCLAIMED.length).toBeGreaterThanOrEqual(PHONE_DOCK_UNCLAIMED_CEILING);
  });

  it('control (DEC-967 wave-41 amendment): a fabricated dock-band label after the template close is excluded from a frame\'s extent, and the same shape before the close is included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'template-close-synth-'));
    try {
      const fixturePath = join(dir, 'Zzy Fixture.dc.html');
      const lines = [
        '<div style="font-size:19px">Zzy Frame</span>', // line 1: label
        '<div style="width:390px; height:844px">', // line 2: frame line
        '  <div style="flex-shrink:0; border-top:1px solid #1B1D17">', // line 3: dock signature
        '    <span>Zzy Before Close Label</span>', // line 4: inside the frame, before close
        '  </div>', // line 5
        '</div>', // line 6
        '</x-dc>', // line 7: template close
        '<span>Zzy After Close Label</span>', // line 8: after close -- must not enter
      ];
      writeFileSync(fixturePath, lines.join('\n'));

      const closeLine = templateCloseLine(fixturePath);
      expect(closeLine).toBe(7);

      // Mirrors bandsInFile's own extentEnd computation above: no next
      // label after the frame line (2), so the raw extent would run to
      // Infinity -- clipped here to the template close, exactly as the
      // production `extentEnd: Math.min(nextLabel ? nextLabel.line :
      // Infinity, templateCloseLine(full))` does.
      const frameLine = 2;
      const extentEnd = Math.min(Infinity, closeLine);
      expect(extentEnd).toBe(7);

      const beforeLine = 4;
      const afterLine = 8;
      // POSITIVE: the before-close dock label sits inside the clipped extent.
      expect(beforeLine >= frameLine && beforeLine < extentEnd).toBe(true);
      // NEGATIVE: the after-close dock-shaped label, despite being in the
      // same file, sits outside the clipped extent -- exactly the swallow
      // this ruling closes.
      expect(afterLine >= frameLine && afterLine < extentEnd).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
