// Phone hidden-drawn-TEXT probe (DEC-725 wave-31 amendment; DEC-919).
//
// app/src/phone-capability-removal.scan.test.ts already grades phone
// `display:none` rules for CAPABILITY removal, but its own population is
// narrowed to INTERACTIVE selectors keyed on a `/* phone-hidden: <reason> */`
// receipt. A rule that hides plain TEXT the 390 frame draws (a section
// eyebrow, a column head, a caption) sits entirely outside that population,
// and the prose reason written above such a rule -- "never paints at this
// width", "there are no columns left to label" -- is a claim nothing checks.
// The worked example that motivated this file (DEC-725's wave-31 amendment):
// app/src/pages/review/review.css's terminal phone block sets
// `.chq-review-criteria-eyebrow { display: none; }` and
// `.chq-review-criteria-head-row { display: none; }` on the premise that
// "once the body rows below collapse to stacked cards there are no columns
// left to label" -- but `docs/design/Chautauqua Review.dc.html`'s
// "Plan editor · 390" frame draws `Weight` as a PER-CRITERION eyebrow
// INSIDE that very stacked card, and the head row's own static "Weight "
// column label (PlanEditor.tsx) is that exact literal.
//
// POPULATION (DEC-808, never a hand list):
//   1. CSS side: every phone (`max-width <= 700px`) `display: none` rule in
//      the product sheets -- REUSED verbatim from
//      app/src/phone-capability-removal.scan.test.ts's exported
//      `PHONE_DISPLAY_NONE_RULES` (its own sheet enumeration + brace-matched
//      media-block walk + comment-aware selector/body extraction is the
//      shared instrument every sibling CSS-side scan in this campaign already
//      imports rather than re-derives -- DEC-613; re-implementing that walk
//      privately here would be exactly the DEC-967 wave-138 failure this
//      task's own instructions name). Unlike that file, THIS ledger does not
//      narrow to "interactive" -- a bare `<span>`/`<div>` carrying static
//      prose is squarely this population's subject.
//   2. TSX side: every `chq-…` class token on every element
//      (`enumerateSourceFiles` from ./../../test/frame-source-corpus,
//      filtered to `.tsx`, comments stripped with that module's own
//      `stripComments` -- the ONE shared stripper, never a private regex),
//      walked to its BALANCED matching close tag (a token's own text may
//      sit behind further nested markup, e.g. a column-head literal inside
//      a nested cell span) and every text/JSX-expression run inside that
//      block, joined to the rule's selector by `chq-` token.
//   3. Frame side: every `width:390px`/`height:844` phone frame extent in
//      `docs/design/*.dc.html`, walked with the SAME
//      frame/label/extent-end grammar test/frame-eyebrow-label.scan.test.ts
//      and test/frame-control-label.scan.test.ts already share (ported, not
//      imported -- this campaign's standing convention: each sibling ledger
//      carries its own copy of the walk so a worker touching one population
//      never becomes a merge conflict on another's), then matched against a
//      candidate literal with `labelIsMatched`/`normalizeSource` imported
//      verbatim from ./../../test/frame-source-corpus (DEC-613: the ONE
//      stripper/matcher every sibling ledger already shares).
//
// GRADE (per CSS rule, DEC-725 wave-31 amendment clause (c)):
//   - PREMISE-FALSE: some static (non-composed) text child of a
//     token-matching element occurs verbatim in some width:390 frame's
//     extent -- the hide's own premise ("nothing left to draw here") is
//     contradicted by the pack.
//   - UNVERIFIABLE: no static text child resolves against a frame, but at
//     least one token-matching element's text child IS composed (a JSX
//     expression, e.g. `{criterion.weight}` or a template literal with
//     `${…}`) -- the join technique is a static substring test and can never
//     verify a value assembled at render time. Recorded WITH its reason in
//     the roster below, never a silent pass (DEC-180).
//   - PREMISE-OK: every text-bearing token match is static and none occurs
//     in any frame extent -- the hide's premise holds against the pack as
//     measured.
//   - (not counted): a rule whose `chq-` tokens carry no text-bearing
//     element at all is outside this population entirely (there is no text
//     for the hide to have removed) -- this is DISJOINT from
//     PHONE_HIDDEN_UNRECEIPTED_CEILING's own INTERACTIVE population by
//     construction (a bare prose `<span>`/`<div>` is never a bare
//     interactive element and is only counted there if some `chq-` token
//     also sits on an interactive tag elsewhere).
//
// RATCHET: two constants, both hand-measured on this branch by forcing them
// to `-1` and reading the printed offender list back (never `= COUNT` or
// any expression naming the measured set) --
// PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING (real, closeable hides) and
// PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING (composed-text misses the
// join cannot resolve). Both two-sided (an ABOVE it and a BELOW-companion
// it, mirroring every prior ledger in this campaign).
//
// MEGABATCH MERGE NOTE (Thunderdome): v12m-w31-a is repairing the two
// `.chq-review-criteria-*` rows named above (review.css) in this SAME
// batch, measured against a tree that does not yet contain that repair.
// Both ceiling constants below (PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_
// CEILING = 59, PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 35) include
// exactly one row each for `.chq-review-criteria-head-row` (PREMISE-FALSE)
// and `.chq-review-criteria-eyebrow` (UNVERIFIABLE), and are EXPECTED to
// drop by (at least) one each once the merge train lands both branches --
// read a lower measured count post-merge as the ratchet working, not as a
// broken gate, and tighten both constants in the same merge-train commit
// (mirrors docs/design/audit/frame-field-label-v12.md's own "Megabatch
// merge note" idiom).
//
// This file MEASURES AND RATCHETS ONLY -- it moves no product byte and no
// CSS (the review.css repair is v12m-w31-a's own lane, not this one's).
//
// WAVE-35 AMENDMENT (DEC-725): the join above was a VERBATIM LITERAL MATCH
// AGAINST EVERY WIDTH:390 FRAME EXTENT IN THE PACK, not scoped to the
// hidden rule's own page or feature -- docs/design/audit/
// phone-hidden-drawn-text-v12.md's own words for the gap this amendment
// closes. Two changes:
//
//   (1) CLUSTER SCOPING (DEC-808, derived by name normalisation, never a
//   hand list): a sheet under `app/src/pages/<cluster>/*` is joined only
//   against `docs/design/Chautauqua <Cluster>.dc.html`'s own frame extents
//   (title-cased directory name -> file name); an SSR sheet under
//   `src/routes/public/**` or `src/routes/portal/**` is joined only against
//   `Chautauqua Public and Portal.dc.html`; one under `src/routes/docs*`
//   only against `Chautauqua Docs.dc.html`. Two kinds of sheet EXPLICITLY
//   keep the old full-pack join rather than being silently narrowed: the
//   shared roots (`app/src/styles.css`, `src/views/theme.ts`, asserted by
//   name below) and any sheet whose derived cluster has no same-named frame
//   file in the pack (`app/src/pages/forms/forms.css` has no `Chautauqua
//   Forms.dc.html`; `src/routes/auth.css.ts` matches none of the three SSR
//   prefixes) -- `scopeBlobsForSheet`'s `kind` field names which case fired
//   so neither can happen by accident.
//
//   (2) TWIN DETECTION, reusing `phone-capability-removal.scan.test.ts`'s
//   own precedent for this exact shape (its closed-row prose: `.chq-
//   detail-back-full` was receipted "as a desktop twin: the SAME back
//   link's phone label is `.chq-detail-back-short`") rather than writing a
//   second copy of that judgment (DEC-613): a PREMISE-FALSE candidate
//   additionally resolves to TWIN-RESOLVED when some OTHER `chq-` token
//   that is NEVER phone-hidden anywhere in the tree carries the identical
//   static text on the SAME cluster surface (derived by the same
//   `clusterKeyForPath` normalisation cluster-scoping (1) above uses, so
//   the two mechanisms share one population key, DEC-613) -- the frame's
//   requirement is met by that still-visible twin, not by the element the
//   rule hid. TWIN-RESOLVED rows are graded, recorded and counted in
//   neither ratchet (DEC-180: a resolution is recorded, never a silent
//   drop).
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_180, DEC_393, DEC_613, DEC_725, DEC_808, DEC_919, DEC_967 } from '../../src/decisions';
import { enumerateSourceFiles, labelIsMatched, normalizeSource, stripComments } from '../../test/frame-source-corpus';
import { PHONE_DISPLAY_NONE_RULES } from './phone-capability-removal.scan.test';

// Compile-checked dependency markers (CLAUDE.md: code depending on a
// decision must reference its constant so the dependency is compile-
// checked).
void DEC_725; // this ledger's own ruling: the wave-31 amendment naming the population, the grades and the anti-vacuity requirement.
void DEC_919; // the mandate this amendment sits one CSS property over from: "a 390 frame re-lines, it never removes a control" -- this file's subject is the TEXT half of the same claim.
void DEC_808; // every population below is derived by directory walk at test time, never hand-listed.
void DEC_613; // the CSS-side rule population, the TSX-side stripper, and the frame-side matcher are all IMPORTED, never re-implemented.
void DEC_180; // a composed-text miss narrows the GRADE (UNVERIFIABLE, with its reason recorded), it never silently drops the row from the roster.
void DEC_967; // wave-138: a ledger that re-derives corpus enumeration privately is the failure this file's imports avoid; wave-143: the anti-vacuity guard is proved on a synthetic fixture, never anchored on a real offender a sibling lane may fix.
void DEC_393; // wave-30's tap-floor-exempt ruling ("a receipt asserts a fact about markup, and no instrument checks it") is the same failure shape this file answers for phone-hidden receipts, one CSS property over.

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// ---------------------------------------------------------------------------
// TSX side: every chq- token on a text-bearing element, static-vs-composed.
// ---------------------------------------------------------------------------

export interface TextFinding {
  file: string; // relative to REPO_ROOT
  token: string;
  text: string; // trimmed raw text child
  composed: boolean; // a JSX expression (`{…}`) rather than literal prose
}

// Opening tag `<TAG attrs>` (self-closing tags carry no children and are
// skipped) whose class/className attribute carries a chq- token; DEC-613
// idiom shared with test/frame-control-label.scan.test.ts's own
// TAG_RE/SPAN_RE style. Unlike a single-level sibling regex, a token-bearing
// element's own text may sit BEHIND further nested markup (the worked
// example: `.chq-review-criteria-head-row`'s "Weight " column-head literal
// sits inside a nested `<span className="chq-review-criteria-head-cell">`,
// not as the head-row `<div>`'s own direct child) -- so once a token-bearing
// OPEN tag is found, its content is walked to the matching BALANCED close
// tag (depth-counted on that exact tag name, mirrors
// test/frame-control-label.scan.test.ts's `balancedDivEnd`, generalised to
// any tag) and every text/JSX-expression run inside that whole block is
// extracted as a candidate finding for the token(s) on the outer tag.
const OPEN_TAG_RE = /<([A-Za-z][\w.]*)\b([^>]*?)(\/?)>/g;
const CLASS_ATTR_RE = /(?:class|className)\s*=\s*(\{[^}]*\}|"[^"]*"|`[^`]*`)/;
const CHQ_TOKEN_RE = /chq-[a-z0-9-]+/g;
const TEXT_RUN_RE = />([^<>]+)</g;
// A candidate must carry at least 3 consecutive letters to count as real
// prose (mirrors the campaign's standing `isRealLabel`-shaped filter --
// test/frame-control-label.scan.test.ts's own `isRealLabel` -- generalised
// from "length >= 2" to "contains real letters" so bare punctuation/interp
// noise (`(`, `}`, `{  }`) coming out of the balanced-block text-run walk
// can never manufacture a match or an UNVERIFIABLE row).
const MEANINGFUL_TEXT_RE = /[A-Za-z]{3,}/;

/** Start offset (the `<` of `</tagName>`) of the balanced closing tag
 * matching the open tag `tagName` whose own `>` sits at `openTagEnd`.
 * Depth-counted so a nested occurrence of the same tag name can never
 * truncate the walk early. */
function balancedCloseStart(src: string, tagName: string, openTagEnd: number): number {
  const re = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, 'g');
  re.lastIndex = openTagEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const isClose = m[1] === '/';
    const selfClosing = !isClose && m[2] === '/';
    if (selfClosing) continue;
    if (isClose) {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  throw new Error(`balancedCloseStart: <${tagName}> at offset ${openTagEnd} never closed`);
}

/** Every distinct `chq-…` text-bearing finding across `root`'s non-test
 * `.tsx` files, comments stripped with the ONE shared stripper
 * (test/frame-source-corpus.ts's `stripComments`, DEC-613). */
export function textBearingFindingsIn(root: string): TextFinding[] {
  const out: TextFinding[] = [];
  for (const abs of enumerateSourceFiles(root)) {
    if (!abs.endsWith('.tsx')) continue;
    const rel = abs.slice(REPO_ROOT.length + 1);
    const src = stripComments(readFileSync(abs, 'utf-8'));
    OPEN_TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = OPEN_TAG_RE.exec(src)) !== null) {
      if (m[3] === '/') continue; // self-closing: no children
      const attrs = m[2] ?? '';
      const classMatch = attrs.match(CLASS_ATTR_RE);
      if (!classMatch) continue;
      const classText = classMatch[1] ?? '';
      const tokens = [...classText.matchAll(CHQ_TOKEN_RE)].map((t) => t[0]);
      if (tokens.length === 0) continue;
      const tagName = m[1]!;
      const openTagEnd = m.index + m[0].length;
      let closeStart: number;
      try {
        closeStart = balancedCloseStart(src, tagName, openTagEnd);
      } catch {
        continue; // malformed/unbalanced in this narrow slice -- skip, never invent a block
      }
      // `block` is the raw text strictly BETWEEN the open tag's `>` and the
      // close tag's `<` -- for a LEAF element (no nested markup at all,
      // e.g. `<span className="chq-x">Plain text</span>`) that means the
      // block carries no `>`/`<` delimiter of its own, so TEXT_RUN_RE's
      // `>(...)<` shape would find nothing even though the whole block IS
      // one text run. Wrapping it back in its own boundary characters
      // unifies the leaf case with the nested-container case (where the
      // block's OWN interior `>`/`<` pairs, from its nested children,
      // already delimit each run) under one regex pass.
      const block = src.slice(openTagEnd, closeStart);
      const wrapped = `>${block}<`;
      TEXT_RUN_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      while ((tm = TEXT_RUN_RE.exec(wrapped)) !== null) {
        const text = (tm[1] ?? '').trim();
        if (!MEANINGFUL_TEXT_RE.test(text)) continue;
        const composed = text.includes('{');
        for (const token of tokens) out.push({ file: rel, token, text, composed });
      }
    }
  }
  return out;
}

function findingsInRealTree(): TextFinding[] {
  return [...textBearingFindingsIn(APP_SRC_ROOT), ...textBearingFindingsIn(SRC_ROOT)];
}

const TEXT_FINDINGS = findingsInRealTree();

// ---------------------------------------------------------------------------
// Frame side: every width:390/height:844 phone frame extent (ported from
// test/frame-eyebrow-label.scan.test.ts / test/frame-control-label.scan.test.ts's
// own Frame walk -- this campaign's standing "port, don't cross-import a
// population walk" convention, so a worker touching one ledger's population
// never becomes a merge-conflict on another's).
// ---------------------------------------------------------------------------

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

export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** DEC-967 wave-42 amendment (porting v12m-w41-c's shape in
 * test/phone-frame-ledger.scan.test.ts verbatim, per this file's own "port,
 * don't cross-import a population walk" convention): the 1-based line of
 * the single `</x-dc>` template close in `fullPath`, throwing loudly on
 * zero or multiple matches. A frame's extent is never allowed to reach
 * past this line -- without the clip, the last labelled block of a file
 * swallows the template's own closing tag and everything after it
 * (fixture `data-dc-script` bodies, trailing markup). */
export function templateCloseLine(fullPath: string): number {
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
    // Extent end: next label line strictly after this frame's own line, or
    // EOF -- clipped at the template's own close (DEC-967 wave-42
    // amendment) so the last labelled block can never swallow `</x-dc>`
    // and everything past it (fixture `data-dc-script` bodies included).
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full)),
    };
  });
}

interface FrameBlob {
  fileName: string;
  line: number;
  title: string;
  normalized: string;
}

function frameBlobsInFile(fileName: string): FrameBlob[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);

  return framesInFile(fileName).map((frame) => {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    return {
      fileName,
      line: frame.line,
      title: frame.title,
      normalized: normalizeSource(content.slice(startOff, endOff)),
    };
  });
}

const FRAME_BLOBS: FrameBlob[] = designFiles().flatMap(frameBlobsInFile);

/** The first phone frame whose extent contains `text` verbatim, or
 * `undefined` if none does. Uses `labelIsMatched`/`normalizeSource`
 * verbatim from test/frame-source-corpus.ts (DEC-613). */
function matchingFrame(text: string, blobs: readonly FrameBlob[] = FRAME_BLOBS): FrameBlob | undefined {
  return blobs.find((b) => labelIsMatched(text, [b.normalized]));
}

// ---------------------------------------------------------------------------
// Cluster scoping (wave-35 amendment, DEC-725/DEC-808): a sheet's frame
// join is narrowed to the ONE frame file its cluster owns, with an
// explicit, asserted fallback to the full pack for shared roots and for
// clusters the pack draws no same-named frame for. The SAME normalisation
// (`clusterKeyForPath`) also keys twin-detection's "same phone surface"
// test below, so the two amendments share one population key rather than
// growing two private notions of "surface" (DEC-613).
// ---------------------------------------------------------------------------

const PAGES_PREFIX = 'app/src/pages/';

/** The cluster key a REPO_ROOT-relative path belongs to, or `undefined` if
 * the path names no cluster (a shared root, or a tree this ledger's
 * mapping does not cover). Derived purely from the path string -- never a
 * hand list (DEC-808). */
export function clusterKeyForPath(relPath: string): string | undefined {
  if (relPath.startsWith(PAGES_PREFIX)) {
    const rest = relPath.slice(PAGES_PREFIX.length);
    const firstSeg = rest.split('/')[0]!;
    // A root-level file directly under app/src/pages (no cluster
    // subdirectory, e.g. `Agenda.tsx` or `not-found.css`) still names its
    // own cluster by its own base name (`Agenda.tsx` -> `agenda`, matching
    // `app/src/pages/agenda/*`'s own key) -- this is what lets a TSX
    // finding in the top-level page component join the same surface as its
    // subcomponents' findings and its cluster's CSS sheet.
    const base = firstSeg.includes('.') ? firstSeg.split('.')[0]! : firstSeg;
    return base.toLowerCase();
  }
  if (relPath.startsWith('src/routes/public/') || relPath.startsWith('src/routes/portal/')) return 'public-portal';
  if (relPath.startsWith('src/routes/docs')) return 'docs';
  return undefined;
}

/** The `docs/design/*.dc.html` file name a cluster key's OWN frame would
 * carry, were one to exist -- existence against the pack's real file list
 * is checked by the caller (`scopeBlobsForSheet`), never assumed here. */
function frameFileNameForClusterKey(key: string): string {
  if (key === 'public-portal') return 'Chautauqua Public and Portal.dc.html';
  if (key === 'docs') return 'Chautauqua Docs.dc.html';
  return `Chautauqua ${key.charAt(0).toUpperCase()}${key.slice(1)}.dc.html`;
}

// Sheets whose join EXPLICITLY stays full-pack -- never narrowed, because
// their rules are not owned by any one cluster's frame (asserted by name in
// the non-vacuity section below, so a future shared root can't silently
// inherit whichever behaviour this set's absence would produce).
const SHARED_ROOT_SHEETS = new Set(['app/src/styles.css', 'src/views/theme.ts']);

export interface SheetScope {
  blobs: FrameBlob[];
  kind: 'cluster' | 'shared-root' | 'no-frame-fallback';
  frameFile: string | undefined;
}

/** The frame-extent population a CSS rule from `sheet` is graded against.
 * Pure over its `allBlobs`/`knownFrameFiles` inputs so the non-vacuity
 * section can drive it over synthetic fixtures without touching the real
 * design pack. */
export function scopeBlobsForSheet(
  sheet: string,
  allBlobs: readonly FrameBlob[],
  knownFrameFiles: ReadonlySet<string>
): SheetScope {
  if (SHARED_ROOT_SHEETS.has(sheet)) {
    return { blobs: [...allBlobs], kind: 'shared-root', frameFile: undefined };
  }
  const key = clusterKeyForPath(sheet);
  const frameFile = key === undefined ? undefined : frameFileNameForClusterKey(key);
  if (frameFile === undefined || !knownFrameFiles.has(frameFile)) {
    return { blobs: [...allBlobs], kind: 'no-frame-fallback', frameFile: undefined };
  }
  return { blobs: allBlobs.filter((b) => b.fileName === frameFile), kind: 'cluster', frameFile };
}

// ---------------------------------------------------------------------------
// Join: CSS rule -> chq- tokens -> TSX text findings -> frame extents.
// ---------------------------------------------------------------------------

export type Grade = 'PREMISE-FALSE' | 'UNVERIFIABLE' | 'PREMISE-OK' | 'TWIN-RESOLVED';

export interface GradedRule {
  sheet: string;
  selector: string;
  grade: Grade;
  reason: string;
}

function tokensOf(selector: string): string[] {
  return [...new Set([...selector.matchAll(CHQ_TOKEN_RE)].map((m) => m[0]))];
}

// Every `chq-` token that is phone-hidden by SOME rule, anywhere in the
// tree -- the population `findTwin` excludes a candidate twin from (a twin
// must itself remain VISIBLE at phone width). Derived once from the same
// `PHONE_DISPLAY_NONE_RULES` population this whole file joins against
// (DEC-613: reusing `phone-capability-removal.scan.test.ts`'s own rule
// enumeration rather than re-deriving it).
const HIDDEN_TOKENS: ReadonlySet<string> = new Set(PHONE_DISPLAY_NONE_RULES.flatMap((r) => tokensOf(r.selector)));

/** The wave-35 twin-detection clause (`phone-capability-removal.scan.
 * test.ts`'s own "desktop twin" receipt precedent, reused rather than
 * re-derived, DEC-613): some OTHER `chq-` token, never itself phone-hidden
 * anywhere in the tree, carrying the IDENTICAL static text on the SAME
 * cluster surface as `finding`. Pure over its inputs so the non-vacuity
 * section can drive it over synthetic fixtures. */
export function findTwin(
  finding: TextFinding,
  findings: readonly TextFinding[],
  hiddenTokens: ReadonlySet<string> = HIDDEN_TOKENS,
  surfaceKeyOf: (file: string) => string | undefined = clusterKeyForPath
): TextFinding | undefined {
  const surface = surfaceKeyOf(finding.file);
  if (surface === undefined) return undefined; // no surface to key a twin match on -- never treat two unrelated "undefined" surfaces as the same one
  return findings.find((t) => {
    if (t === finding || t.composed || t.text !== finding.text) return false;
    if (hiddenTokens.has(t.token)) return false;
    if (surfaceKeyOf(t.file) !== surface) return false;
    // A twin must be a SPECIFIC element, not a bulk container: the
    // balanced-close-tag walk above deliberately attributes NESTED text up
    // to an outer token (so a token hidden BEHIND further markup is still
    // found), which means a coarse outer wrapper token (e.g. a page-root
    // `chq-page`) absorbs every distinct string nested anywhere inside it.
    // A genuine twin label -- `.chq-detail-back-short` for a hidden
    // `.chq-detail-back-full`, this scan's own worked precedent -- names
    // exactly ONE static text in the whole findings population; requiring
    // that here (rather than hand-listing wrapper token names, DEC-808)
    // disqualifies the container case by what it measurably does, not by
    // what it is called.
    const distinctTextsForToken = new Set(
      findings.filter((o) => o.token === t.token && !o.composed).map((o) => o.text)
    );
    return distinctTextsForToken.size === 1;
  });
}

/** Grades one CSS rule's selector against a set of already-gathered text
 * findings and frame blobs -- pure, so the non-vacuity section below can
 * drive it over fabricated inputs. Returns `undefined` if the selector's
 * tokens carry no text-bearing finding at all (outside this population). */
export function gradeRule(
  selector: string,
  findings: readonly TextFinding[],
  blobs: readonly FrameBlob[],
  hiddenTokens: ReadonlySet<string> = HIDDEN_TOKENS,
  surfaceKeyOf: (file: string) => string | undefined = clusterKeyForPath
): GradedRule | undefined {
  const tokens = tokensOf(selector);
  const matches = findings.filter((f) => tokens.includes(f.token));
  if (matches.length === 0) return undefined;

  for (const f of matches) {
    if (f.composed) continue;
    const frame = matchingFrame(f.text, blobs);
    if (frame) {
      const twin = findTwin(f, findings, hiddenTokens, surfaceKeyOf);
      if (twin) {
        return {
          sheet: '',
          selector,
          grade: 'TWIN-RESOLVED',
          reason:
            `"${f.text}" (${f.file}) is drawn verbatim at ${frame.fileName}:${frame.line} "${frame.title}", ` +
            `but an identical, still-visible text child exists on the same phone surface: "${twin.text}" ` +
            `(${twin.file} :: ${twin.token}) -- the frame's requirement is met by that twin, not by the hidden element`,
        };
      }
      return {
        sheet: '',
        selector,
        grade: 'PREMISE-FALSE',
        reason: `"${f.text}" (${f.file}) is drawn verbatim at ${frame.fileName}:${frame.line} "${frame.title}"`,
      };
    }
  }

  const composedFinding = matches.find((f) => f.composed);
  if (composedFinding) {
    return {
      sheet: '',
      selector,
      grade: 'UNVERIFIABLE',
      reason: `${composedFinding.file} :: ${composedFinding.token} renders a composed (non-static) text child: "${composedFinding.text}" -- a static substring join can never verify a value assembled at render time`,
    };
  }

  return {
    sheet: '',
    selector,
    grade: 'PREMISE-OK',
    reason: `every static text child of [${tokens.join(', ')}] was checked against every width:390 frame extent and none matched`,
  };
}

const KNOWN_FRAME_FILES: ReadonlySet<string> = new Set(designFiles());

const GRADED_RULES: GradedRule[] = PHONE_DISPLAY_NONE_RULES.map((r) => {
  const scope = scopeBlobsForSheet(r.sheet, FRAME_BLOBS, KNOWN_FRAME_FILES);
  const g = gradeRule(r.selector, TEXT_FINDINGS, scope.blobs);
  return g ? { ...g, sheet: r.sheet } : undefined;
}).filter((g): g is GradedRule => g !== undefined);

const PREMISE_FALSE_ROWS = GRADED_RULES.filter((g) => g.grade === 'PREMISE-FALSE');
const UNVERIFIABLE_ROWS = GRADED_RULES.filter((g) => g.grade === 'UNVERIFIABLE');
const TWIN_RESOLVED_ROWS = GRADED_RULES.filter((g) => g.grade === 'TWIN-RESOLVED');

// Measured on this branch by forcing both constants to -1 and reading the
// printed offender roster back (never an expression naming the measured
// set). The full per-row roster is recorded in
// docs/design/audit/phone-hidden-drawn-text-v12.md. Wave-35 amendment
// (DEC-725): both counts DROPPED once the join was scoped to each sheet's
// own cluster frame (docs/design/audit/phone-hidden-drawn-text-v12.md's own
// words for the prior gap: "a verbatim literal match against every
// width:390 frame extent in the pack, not scoped to the hidden rule's own
// page or feature") and twin-detection resolved rows whose text is still
// drawn, visibly, by an unhidden sibling on the same cluster surface.
export const PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = 28;
export const PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 40;

// ---------------------------------------------------------------------------
// DEC-967 wave-42 amendment: a two-sided completeness ratchet over every
// `.ts`/`.tsx` file in the tree that derives an `extentEnd` from a
// `.dc.html` label scan (the shape this file's own `framesInFile` and its
// eleven siblings across app/src/test/src/scripts all share) WITHOUT
// clipping that extent at its file's own template close. This is what
// makes DEC-967's ruling self-enforcing instead of a twelve-file reading
// exercise: every sibling ledger that ports the clip in makes this count
// go down; a future ledger that copies the OLD unclipped shape makes it go
// back up, and this scan catches it.
// ---------------------------------------------------------------------------

const EXTENT_SCAN_ROOTS = [APP_SRC_ROOT, SRC_ROOT, join(REPO_ROOT, 'test'), join(REPO_ROOT, 'scripts')];

/** Every `.ts`/`.tsx` file under `root`, enumerated via readdirSync rather
 * than named (DEC-808) -- unlike test/frame-source-corpus.ts's own
 * `enumerateSourceFiles`, this walk deliberately does NOT exclude
 * `.test.`/`.test.tsx` files: the population this ratchet grades is
 * exactly the scan/ledger files DEC-967 names, which are almost entirely
 * `*.scan.test.ts` files. */
function enumerateTsFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// A file is IN this population if it both (a) derives an `extentEnd` value
// and (b) scans for the SAME `font-size:19px` frame-label marker every
// `.dc.html` frame walk in this campaign keys on -- the combination that
// distinguishes an actual frame-extent derivation from an unrelated use of
// either token alone (e.g. a CSS `font-size:19px` declaration in product
// code, or an unrelated `extentEnd`-named field in a different shape).
const EXTENT_DERIVATION_RE = /extentEnd/;
const FRAME_LABEL_MARKER_RE = /font-size:19px/;

/** True if `absFile` derives a frame `extentEnd` from a `.dc.html` label
 * scan without clipping it at that file's own template close. */
function isUnclippedExtentDerivation(absFile: string): boolean {
  const src = readFileSync(absFile, 'utf-8');
  if (!EXTENT_DERIVATION_RE.test(src)) return false;
  if (!FRAME_LABEL_MARKER_RE.test(src)) return false;
  return !src.includes('templateCloseLine');
}

const UNCLIPPED_EXTENT_DERIVATION_FILES: string[] = EXTENT_SCAN_ROOTS.flatMap((root) =>
  enumerateTsFiles(root).filter(isUnclippedExtentDerivation)
).sort();

// Measured on this branch (v12m-w42-d) by forcing to -1 and reading the
// printed offender list back (never an expression naming the measured
// set): 10 files still derive extentEnd from a .dc.html label scan without
// the DEC-967 template-close clip (app/src/frame-citation-frames.ts and
// nine test/*.scan.test.ts siblings). This file itself is now clipped and
// so does not appear. May only be RAISED if the ratchet is proved stale by
// a re-measurement; a merge-train commit that lands one of the in-flight
// w41 clip lanes must TIGHTEN it in the same commit (mirrors every other
// ratchet in this campaign).
export const UNCLIPPED_EXTENT_DERIVATION_CEILING = 10;

describe('DEC-725 phone hidden-drawn-text probe', () => {
  it('finds more than one phone display:none rule (vacuous-population tripwire, CSS side)', () => {
    expect(PHONE_DISPLAY_NONE_RULES.length).toBeGreaterThan(5);
  });

  it('finds more than zero text-bearing chq- findings in the real tree (vacuous-population tripwire, TSX side)', () => {
    expect(TEXT_FINDINGS.length).toBeGreaterThan(20);
  });

  it('finds more than zero phone frame extents (vacuous-population tripwire, frame side)', () => {
    expect(FRAME_BLOBS.length).toBeGreaterThan(5);
  });

  it('the graded-rule population is a strict subset of PHONE_DISPLAY_NONE_RULES (monotone population floor: this ledger can only ever be as large as its source rule set, never larger)', () => {
    expect(GRADED_RULES.length).toBeGreaterThan(0);
    expect(GRADED_RULES.length).toBeLessThanOrEqual(PHONE_DISPLAY_NONE_RULES.length);
  });

  // --- wave-35 amendment: cluster scoping (DEC-725/DEC-808) --------------

  it('clusterKeyForPath derives the same cluster key for a top-level page component and its cluster-directory subcomponents (the join that lets Agenda.tsx and pages/agenda/DayGrid.tsx share one surface)', () => {
    expect(clusterKeyForPath('app/src/pages/Agenda.tsx')).toBe('agenda');
    expect(clusterKeyForPath('app/src/pages/agenda/DayGrid.tsx')).toBe('agenda');
    expect(clusterKeyForPath('app/src/pages/agenda/agenda.css')).toBe('agenda');
  });

  it('clusterKeyForPath keys SSR public/portal sheets and docs sheets on their own shared clusters, never a per-file guess', () => {
    expect(clusterKeyForPath('src/routes/public/cfp.css.ts')).toBe('public-portal');
    expect(clusterKeyForPath('src/routes/portal/portal.css.ts')).toBe('public-portal');
    expect(clusterKeyForPath('src/routes/docs-site.css.ts')).toBe('docs');
  });

  it('shared roots (app/src/styles.css, src/views/theme.ts) are EXPLICITLY scoped full-pack, never silently narrowed (asserted, not dropped)', () => {
    const blobs = [{ fileName: 'Any.dc.html', line: 1, title: 't', normalized: 'x' }];
    expect(scopeBlobsForSheet('app/src/styles.css', blobs, new Set(['Any.dc.html']))).toEqual({
      blobs,
      kind: 'shared-root',
      frameFile: undefined,
    });
    expect(scopeBlobsForSheet('src/views/theme.ts', blobs, new Set(['Any.dc.html']))).toEqual({
      blobs,
      kind: 'shared-root',
      frameFile: undefined,
    });
  });

  it('a cluster with no same-named frame file (forms) and an SSR sheet matching no public/portal/docs prefix (auth.css.ts) EXPLICITLY fall back to full-pack, never silently narrowed to an empty set', () => {
    const blobs = [{ fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 't', normalized: 'x' }];
    const known = new Set(['Chautauqua Agenda.dc.html']); // deliberately no "Chautauqua Forms.dc.html"
    expect(scopeBlobsForSheet('app/src/pages/forms/forms.css', blobs, known)).toEqual({
      blobs,
      kind: 'no-frame-fallback',
      frameFile: undefined,
    });
    expect(scopeBlobsForSheet('src/routes/auth.css.ts', blobs, known)).toEqual({
      blobs,
      kind: 'no-frame-fallback',
      frameFile: undefined,
    });
  });

  it('every sheet PHONE_DISPLAY_NONE_RULES actually carries resolves to exactly one scope kind against the real pack (no sheet silently falls through undefined)', () => {
    const sheets = [...new Set(PHONE_DISPLAY_NONE_RULES.map((r) => r.sheet))];
    expect(sheets.length).toBeGreaterThan(5);
    for (const sheet of sheets) {
      const scope = scopeBlobsForSheet(sheet, FRAME_BLOBS, KNOWN_FRAME_FILES);
      expect(['cluster', 'shared-root', 'no-frame-fallback']).toContain(scope.kind);
      if (scope.kind === 'cluster') expect(scope.blobs.length).toBeGreaterThan(0);
    }
  });

  it('non-vacuity: a cluster-scoped synthetic match against its OWN cluster frame hits PREMISE-FALSE', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Fixture.tsx', token: 'chq-x-fake-scope-hit', text: 'Scoped Fixture Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Scoped Fixture Label</span>') },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/fixture.css', blobs, known);
    expect(scope.kind).toBe('cluster');
    const graded = gradeRule('.chq-x-fake-scope-hit', findings, scope.blobs);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: the SAME synthetic text drawn only in a DIFFERENT cluster frame no longer matches once scoped (proves the scoping does not empty the population by accident, only by design)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Fixture.tsx', token: 'chq-x-fake-scope-miss', text: 'Cross Cluster Fixture Label', composed: false },
    ];
    // Drawn ONLY in the Overview frame -- a different cluster from the
    // agenda.css sheet under test.
    const blobs: FrameBlob[] = [
      {
        fileName: 'Chautauqua Overview.dc.html',
        line: 1,
        title: 'Fixture frame',
        normalized: normalizeSource('<span>Cross Cluster Fixture Label</span>'),
      },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html', 'Chautauqua Overview.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/fixture.css', blobs, known);
    expect(scope.kind).toBe('cluster');
    expect(scope.blobs).toEqual([]); // Agenda's own frame carries none of this synthetic Overview-only text
    const graded = gradeRule('.chq-x-fake-scope-miss', findings, scope.blobs);
    expect(graded?.grade).toBe('PREMISE-OK'); // unscoped, this would have wrongly graded PREMISE-FALSE
  });

  // --- wave-35 amendment: twin detection (DEC-725, reusing DEC-919's
  // "desktop twin" receipt precedent rather than a second copy, DEC-613) --

  it('non-vacuity: a PREMISE-FALSE candidate whose text is ALSO drawn by another, never-hidden token on the same cluster surface resolves to TWIN-RESOLVED', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden', text: 'Twin Fixture Label', composed: false },
      { file: 'app/src/pages/agenda/Visible.tsx', token: 'chq-x-fake-twin-visible', text: 'Twin Fixture Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Twin Fixture Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden']); // the visible twin's OWN token is never hidden
    const graded = gradeRule('.chq-x-fake-twin-hidden', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('TWIN-RESOLVED');
    expect(graded?.reason).toContain('chq-x-fake-twin-visible');
  });

  it('non-vacuity: the same shape with the candidate twin on a DIFFERENT cluster surface stays PREMISE-FALSE (a twin must share the surface, not just the text)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden-2', text: 'Cross Surface Twin Label', composed: false },
      { file: 'app/src/pages/overview/Visible.tsx', token: 'chq-x-fake-twin-visible-2', text: 'Cross Surface Twin Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Cross Surface Twin Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden-2']);
    const graded = gradeRule('.chq-x-fake-twin-hidden-2', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: a candidate twin whose OWN token is also phone-hidden elsewhere is not a twin (it is not actually visible at phone width)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden-3', text: 'Both Hidden Label', composed: false },
      { file: 'app/src/pages/agenda/AlsoHidden.tsx', token: 'chq-x-fake-twin-also-hidden-3', text: 'Both Hidden Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Both Hidden Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden-3', 'chq-x-fake-twin-also-hidden-3']);
    const graded = gradeRule('.chq-x-fake-twin-hidden-3', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: a candidate token that carries MANY distinct static texts (a bulk container, e.g. a page-root wrapper) is disqualified as a twin even though it happens to also carry the matching text', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden-4', text: 'Container Twin Label', composed: false },
      { file: 'app/src/pages/agenda/Container.tsx', token: 'chq-x-fake-container', text: 'Container Twin Label', composed: false },
      { file: 'app/src/pages/agenda/Container.tsx', token: 'chq-x-fake-container', text: 'Some Other Unrelated Text', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Container Twin Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden-4']); // chq-x-fake-container is never hidden either -- the container itself must still be excluded
    const graded = gradeRule('.chq-x-fake-twin-hidden-4', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('findTwin never matches a finding against itself, and treats two undefined surfaces as never the same surface', () => {
    const lone: TextFinding = { file: 'app/src/pages/agenda/Solo.tsx', token: 'chq-x-fake-solo', text: 'Solo Label', composed: false };
    expect(findTwin(lone, [lone])).toBeUndefined();
    const outsideA: TextFinding = { file: 'app/src/components/A.tsx', token: 'chq-x-fake-outside-a', text: 'Outside Label', composed: false };
    const outsideB: TextFinding = { file: 'app/src/components/B.tsx', token: 'chq-x-fake-outside-b', text: 'Outside Label', composed: false };
    expect(clusterKeyForPath(outsideA.file)).toBeUndefined();
    expect(findTwin(outsideA, [outsideA, outsideB])).toBeUndefined();
  });

  it('the worked-example row (.chq-review-criteria-head-row) is graded TWIN-RESOLVED against the live tree (wave-35: PlanEditor.tsx\'s .chq-review-criterion-weight now carries a real, still-visible per-criterion "Weight" eyebrow, DEC-745 -- the frame\'s requirement is met there, not by the still-hidden head-row)', () => {
    const row = GRADED_RULES.find((g) => g.selector.includes('chq-review-criteria-head-row'));
    expect(row?.grade).toBe('TWIN-RESOLVED');
    expect(row?.reason).toContain('chq-review-criterion-weight');
  });

  it('the worked-example row (.chq-review-criteria-eyebrow) is graded UNVERIFIABLE against the live tree', () => {
    const row = GRADED_RULES.find((g) => g.selector.includes('chq-review-criteria-eyebrow'));
    expect(row?.grade).toBe('UNVERIFIABLE');
  });

  // --- non-vacuity: the classifier is proved on a SYNTHETIC fixture, never
  // anchored on a real offender a sibling lane may fix (DEC-967 wave-143).
  it('non-vacuity: a synthetic static literal that IS drawn in a synthetic frame extent grades PREMISE-FALSE', () => {
    const findings: TextFinding[] = [
      { file: 'fixture.tsx', token: 'chq-x-fake-eyebrow', text: 'Fixture Only Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      {
        fileName: 'Fixture.dc.html',
        line: 1,
        title: 'Fixture frame',
        normalized: normalizeSource('<span>Fixture Only Label</span>'),
      },
    ];
    const graded = gradeRule('.chq-x-fake-eyebrow', findings, blobs);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: a synthetic static literal that is NOT drawn in any synthetic frame extent grades PREMISE-OK', () => {
    const findings: TextFinding[] = [
      { file: 'fixture.tsx', token: 'chq-x-fake-ok', text: 'Fixture Absent Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Something else entirely</span>') },
    ];
    const graded = gradeRule('.chq-x-fake-ok', findings, blobs);
    expect(graded?.grade).toBe('PREMISE-OK');
  });

  it('non-vacuity: a synthetic composed-only text child grades UNVERIFIABLE, never a silent pass', () => {
    const findings: TextFinding[] = [
      { file: 'fixture.tsx', token: 'chq-x-fake-composed', text: '{fixture.value}', composed: true },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Unrelated</span>') },
    ];
    const graded = gradeRule('.chq-x-fake-composed', findings, blobs);
    expect(graded?.grade).toBe('UNVERIFIABLE');
    expect(graded?.reason).toContain('composed');
  });

  it('non-vacuity: a selector whose token has no text-bearing finding at all is OUTSIDE this population (undefined, not PREMISE-OK)', () => {
    const graded = gradeRule('.chq-x-fake-no-text', [], []);
    expect(graded).toBeUndefined();
  });

  it('non-vacuity: findingsInRealTree/textBearingFindingsIn parses a real fixture .tsx-shaped file written to a tmpdir (proves the walk itself, not just the pure classifier)', async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'phone-hidden-drawn-text-fixture-'));
    try {
      mkdirSync(join(dir, 'nested'), { recursive: true });
      writeFileSync(
        join(dir, 'nested', 'Fixture.tsx'),
        [
          '// a comment naming chq-x-fake-comment-only should never be picked up',
          '/* chq-x-fake-block-comment also must never be picked up */',
          'export function Fixture() {',
          '  return (',
          '    <div>',
          '      <span className="chq-x-fake-static">Static Fixture Text</span>',
          '      <span className="chq-x-fake-dynamic">{value}</span>',
          '      <span className="not-chq">Irrelevant</span>',
          '    </div>',
          '  );',
          '}',
          '',
        ].join('\n'),
        'utf-8'
      );
      const found = textBearingFindingsIn(dir);
      const tokens = found.map((f) => f.token);
      expect(tokens).toContain('chq-x-fake-static');
      expect(tokens).toContain('chq-x-fake-dynamic');
      expect(tokens).not.toContain('chq-x-fake-comment-only');
      expect(tokens).not.toContain('chq-x-fake-block-comment');
      const staticFinding = found.find((f) => f.token === 'chq-x-fake-static');
      expect(staticFinding?.composed).toBe(false);
      expect(staticFinding?.text).toBe('Static Fixture Text');
      const dynamicFinding = found.find((f) => f.token === 'chq-x-fake-dynamic');
      expect(dynamicFinding?.composed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // --- DEC-967 wave-42 amendment: the frame-extent derivation is clipped at
  // the template's own close, not just at the next label / EOF -----------

  it('control (DEC-967 wave-42 amendment): a fabricated label-shaped string after the template close is excluded from a frame\'s extent, and the same shape before the close is included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'phone-hidden-drawn-text-template-close-'));
    try {
      const fixturePath = join(dir, 'Zzy Fixture.dc.html');
      const lines = [
        '<div style="font-size:19px">Zzy Frame</span>', // line 1: label
        '<div style="width:390px; height:844px">', // line 2: frame line
        '  <span>Zzy Before Close Label</span>', // line 3: inside the frame, before close
        '</div>', // line 4
        '</x-dc>', // line 5: template close
        '<span>Zzy After Close Label</span>', // line 6: after close -- must not enter
      ];
      writeFileSync(fixturePath, lines.join('\n'));

      const closeLine = templateCloseLine(fixturePath);
      expect(closeLine).toBe(5);

      // Mirrors framesInFile's own extentEnd computation above: no next
      // label after the frame line (2), so the raw extent would run to
      // Infinity -- clipped here to the template close, exactly as the
      // production `extentEnd: Math.min(nextLabel ? nextLabel.line :
      // Infinity, templateCloseLine(full))` does.
      const frameLine = 2;
      const extentEnd = Math.min(Infinity, templateCloseLine(fixturePath));
      expect(extentEnd).toBe(5);

      const beforeLine = 3;
      const afterLine = 6;
      // POSITIVE: the before-close label sits inside the clipped extent.
      expect(beforeLine >= frameLine && beforeLine < extentEnd).toBe(true);
      // NEGATIVE: the after-close label, despite being label-shaped and in
      // the same file, sits outside the clipped extent -- exactly the
      // swallow this ruling closes (a frame's extent can never reach past
      // its own template's `</x-dc>`).
      expect(afterLine >= frameLine && afterLine < extentEnd).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PREMISE-FALSE rows never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = PREMISE_FALSE_ROWS.map((r) => `${r.sheet} :: ${r.selector} -- ${r.reason}`).join('\n');
    expect(
      PREMISE_FALSE_ROWS.length,
      `PREMISE-FALSE phone hidden-drawn-text rows (${PREMISE_FALSE_ROWS.length}, ceiling ${PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING}):\n${detail}`
    ).toBeLessThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING);
  });

  it('never sits ABOVE the measured PREMISE-FALSE truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (PREMISE_FALSE_ROWS.length < PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING) {
      throw new Error(
        `${PREMISE_FALSE_ROWS.length} PREMISE-FALSE row(s), below the ratchet ceiling of ` +
          `${PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING}. This is the ratchet working -- ` +
          `tighten the ceiling in the same commit by replacing the line:\n` +
          `  export const PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = ${PREMISE_FALSE_ROWS.length};`
      );
    }
    expect(PREMISE_FALSE_ROWS.length).toBeGreaterThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING);
  });

  it('UNVERIFIABLE rows never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = UNVERIFIABLE_ROWS.map((r) => `${r.sheet} :: ${r.selector} -- ${r.reason}`).join('\n');
    expect(
      UNVERIFIABLE_ROWS.length,
      `UNVERIFIABLE phone hidden-drawn-text rows (${UNVERIFIABLE_ROWS.length}, ceiling ${PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING}):\n${detail}`
    ).toBeLessThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING);
  });

  it('never sits ABOVE the measured UNVERIFIABLE truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (UNVERIFIABLE_ROWS.length < PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING) {
      throw new Error(
        `${UNVERIFIABLE_ROWS.length} UNVERIFIABLE row(s), below the ratchet ceiling of ` +
          `${PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING}. Tighten the ceiling in the same ` +
          `merge-train commit by replacing the line:\n` +
          `  export const PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = ${UNVERIFIABLE_ROWS.length};`
      );
    }
    expect(UNVERIFIABLE_ROWS.length).toBeGreaterThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING);
  });

  it('TWIN-RESOLVED rows are graded and recorded, never a silent drop from the roster (DEC-180) -- neither ceiling counts them', () => {
    for (const row of TWIN_RESOLVED_ROWS) {
      expect(PREMISE_FALSE_ROWS).not.toContain(row);
      expect(UNVERIFIABLE_ROWS).not.toContain(row);
      expect(row.reason).toContain('still-visible');
    }
  });

  // --- DEC-967 wave-42 amendment: the completeness ratchet over every
  // still-unclipped frame-extent derivation in the tree --------------------

  it('non-vacuity: this scan actually finds at least one file (itself, before the fix, or a sibling) that would trip a naive positive-only check', () => {
    // Sanity: the marker combination alone (extentEnd + font-size:19px) is
    // not vacuous -- it currently matches this very file (which passes
    // ONLY because it also contains templateCloseLine) plus its siblings.
    const rootsHaveAnyMarkerFile = EXTENT_SCAN_ROOTS.some((root) =>
      enumerateTsFiles(root).some((f) => {
        const src = readFileSync(f, 'utf-8');
        return EXTENT_DERIVATION_RE.test(src) && FRAME_LABEL_MARKER_RE.test(src);
      })
    );
    expect(rootsHaveAnyMarkerFile).toBe(true);
  });

  it('this file itself is no longer in the unclipped population (it derives extentEnd from a .dc.html label scan but clips it with templateCloseLine)', () => {
    const here = fileURLToPath(import.meta.url);
    expect(UNCLIPPED_EXTENT_DERIVATION_FILES).not.toContain(here);
  });

  it('unclipped extent-derivation files never exceed the ceiling (one-sided ratchet: may only fall as sibling clip lanes land)', () => {
    const detail = UNCLIPPED_EXTENT_DERIVATION_FILES.join('\n');
    expect(
      UNCLIPPED_EXTENT_DERIVATION_FILES.length,
      `unclipped extent-derivation files (${UNCLIPPED_EXTENT_DERIVATION_FILES.length}, ceiling ${UNCLIPPED_EXTENT_DERIVATION_CEILING}):\n${detail}`
    ).toBeLessThanOrEqual(UNCLIPPED_EXTENT_DERIVATION_CEILING);
  });

  it('never sits ABOVE the measured unclipped-file truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (UNCLIPPED_EXTENT_DERIVATION_FILES.length < UNCLIPPED_EXTENT_DERIVATION_CEILING) {
      throw new Error(
        `${UNCLIPPED_EXTENT_DERIVATION_FILES.length} unclipped extent-derivation file(s), below the ` +
          `ratchet ceiling of ${UNCLIPPED_EXTENT_DERIVATION_CEILING}. This is the ratchet working -- ` +
          `tighten the ceiling in the same merge-train commit by replacing the line:\n` +
          `  export const UNCLIPPED_EXTENT_DERIVATION_CEILING = ${UNCLIPPED_EXTENT_DERIVATION_FILES.length};`
      );
    }
    expect(UNCLIPPED_EXTENT_DERIVATION_FILES.length).toBeGreaterThanOrEqual(UNCLIPPED_EXTENT_DERIVATION_CEILING);
  });
});

export {
  FRAME_BLOBS,
  GRADED_RULES,
  PREMISE_FALSE_ROWS,
  TEXT_FINDINGS,
  TWIN_RESOLVED_ROWS,
  UNVERIFIABLE_ROWS,
};
